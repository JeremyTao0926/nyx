-- =============================================
-- NYX v3 Schema — 在 SQL Editor 執行
-- =============================================

-- 更新 handle_new_user 支持 email、OAuth、手機登入與 metadata。
-- OAuth／手機首次登入時可以先建立空生日資料，但 App 會在進入主頁前
-- 強制完成姓名、用戶名與 18+ 生日；已提供的未成年生日仍由 DB 拒絕。
alter table profiles alter column birthday drop not null;
alter table profiles alter column email drop not null;

create or replace function handle_new_user()
returns trigger as $$
declare
  birth_text text;
  birth_date date;
  auth_provider text;
  requested_username text;
  generated_username text;
  display_value text;
begin
  birth_text := coalesce(
    nullif(new.raw_user_meta_data->>'birthday', ''),
    nullif(new.raw_user_meta_data->'registration_profile'->>'birthday', '')
  );
  auth_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
  if birth_text is not null then
    begin
      birth_date := birth_text::date;
    exception when others then
      raise exception 'Invalid birthday';
    end;
    if birth_date > (current_date - interval '18 years')::date then
      raise exception 'NYX is only available to users aged 18 or older';
    end if;
  elsif auth_provider = 'email' then
    raise exception 'Birthday is required for email registration';
  end if;

  requested_username := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  if requested_username is not null and requested_username !~ '^[a-z0-9_]{3,20}$' then
    requested_username := null;
  end if;
  generated_username := coalesce(requested_username, 'nyx_' || left(replace(new.id::text, '-', ''), 10));
  display_value := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    case when new.phone is not null then 'NYX ' || right(new.phone, 4) end,
    'NYX Member'
  );

  insert into profiles (id, username, display_name, email, birthday, gender, mbti, avatar_url, onboarding_done)
  values (
    new.id,
    generated_username,
    display_value,
    new.email,
    birth_date,
    coalesce(new.raw_user_meta_data->>'gender', 'male'),
    coalesce(new.raw_user_meta_data->>'mbti', 'INFP'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Blocked users
create table if not exists blocked_users (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

-- Reports
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references profiles(id) on delete cascade,
  reported_id uuid references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

-- Notifications
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  type text check (type in ('match','message','like')),
  content text,
  from_user_id uuid references profiles(id),
  read boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table blocked_users enable row level security;
alter table reports enable row level security;
alter table notifications enable row level security;

drop policy if exists "own blocks" on blocked_users;
drop policy if exists "own reports" on reports;
drop policy if exists "own notifications" on notifications;

create policy "own blocks" on blocked_users for all using (auth.uid()=blocker_id);
create policy "own reports" on reports for all using (auth.uid()=reporter_id);
create policy "own notifications" on notifications for all using (auth.uid()=user_id);

-- Enable Realtime for chat_messages
-- （還需要在 Supabase Dashboard → Database → Replication → 開啟 chat_messages）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;

-- Enable Realtime for profiles (needed so the chat screen sees the other
-- person's last_active / hide_online_status update live, not just on open)
-- （還需要在 Supabase Dashboard → Database → Replication → 開啟 profiles）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table profiles;
  end if;
end $$;

-- Indexes
create index if not exists idx_notif_user on notifications(user_id, read, created_at);

-- One active push destination per account. Web uses endpoint/key fields;
-- native iOS uses the APNs device_token field.
create table if not exists push_subscriptions (
  user_id uuid primary key references profiles(id) on delete cascade,
  platform text not null default 'web' check (platform in ('web','ios')),
  endpoint text,
  p256dh text,
  auth text,
  device_token text,
  updated_at timestamptz not null default now()
);
alter table push_subscriptions add column if not exists platform text not null default 'web';
alter table push_subscriptions add column if not exists device_token text;
alter table push_subscriptions alter column endpoint drop not null;
alter table push_subscriptions alter column p256dh drop not null;
alter table push_subscriptions alter column auth drop not null;
alter table push_subscriptions enable row level security;
drop policy if exists "manage own push subscription" on push_subscriptions;
create policy "manage own push subscription" on push_subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_blocks on blocked_users(blocker_id);

-- Update check_match function to also create notifications
create or replace function check_match(p_swiper uuid, p_swiped uuid)
returns boolean as $$
declare
  v_mutual boolean;
  new_match_id uuid;
begin
  if auth.uid() is null or p_swiper <> auth.uid() then
    raise exception 'Not authorized to create this match';
  end if;
  select exists(
    select 1 from swipes where swiper_id=p_swiped and swiped_id=p_swiper and direction in ('like','superlike')
  ) into v_mutual;
  if v_mutual then
    insert into matches (user1_id, user2_id)
    values (least(p_swiper,p_swiped), greatest(p_swiper,p_swiped))
    on conflict do nothing
    returning id into new_match_id;
    -- Only notify once, when the match row was actually created.
    if new_match_id is not null then
      insert into notifications (user_id, type, content, from_user_id)
      values (p_swiper,'match','你們配對成功了！',p_swiped),
             (p_swiped,'match','你們配對成功了！',p_swiper);
    end if;
    return true;
  end if;
  return false;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function check_match(uuid, uuid) from public;
grant execute on function check_match(uuid, uuid) to authenticated;

-- Record usage, the swipe, and a possible match in one transaction. This
-- prevents reloads or concurrent taps from bypassing daily limits.
create or replace function record_swipe_action(p_swiped uuid, p_direction text)
returns boolean as $$
declare
  caller uuid := auth.uid();
  premium boolean;
  likes_used integer;
  superlikes_used integer;
  existing_direction text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_swiped is null or p_swiped = caller then raise exception 'Invalid swipe target'; end if;
  if p_direction not in ('like', 'pass', 'superlike') then raise exception 'Invalid swipe direction'; end if;

  perform reset_daily_likes_if_needed(caller);
  select coalesce(is_premium, false), coalesce(daily_likes_used, 0), coalesce(superlike_used_today, 0)
    into premium, likes_used, superlikes_used
    from profiles where id = caller for update;

  if not found then raise exception 'Profile not found'; end if;
  select direction into existing_direction from swipes where swiper_id = caller and swiped_id = p_swiped;
  if found and existing_direction = p_direction then
    if p_direction = 'pass' then return false; end if;
    return check_match(caller, p_swiped);
  end if;
  if p_direction = 'like' then
    if not premium and likes_used >= 30 then raise exception 'DAILY_LIKE_LIMIT_REACHED'; end if;
    update profiles set daily_likes_used = likes_used + 1 where id = caller;
  elsif p_direction = 'superlike' then
    if superlikes_used >= case when premium then 5 else 1 end then raise exception 'DAILY_SUPERLIKE_LIMIT_REACHED'; end if;
    update profiles set superlike_used_today = superlikes_used + 1 where id = caller;
  end if;

  insert into swipes (swiper_id, swiped_id, direction)
  values (caller, p_swiped, p_direction)
  on conflict (swiper_id, swiped_id) do update set direction = excluded.direction;

  if p_direction = 'pass' then return false; end if;
  return check_match(caller, p_swiped);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function record_swipe_action(uuid, text) from public;
grant execute on function record_swipe_action(uuid, text) to authenticated;

-- Profile views ("誰看過我" stat on the profile page)
create table if not exists profile_views (
  id uuid default gen_random_uuid() primary key,
  viewer_id uuid references profiles(id) on delete cascade,
  viewed_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists idx_profile_views_viewed on profile_views(viewed_id);

alter table profile_views enable row level security;
drop policy if exists "insert own profile views" on profile_views;
drop policy if exists "read profile views involving you" on profile_views;
create policy "insert own profile views" on profile_views for insert with check (auth.uid() = viewer_id);
create policy "read profile views involving you" on profile_views for select using (auth.uid() = viewed_id or auth.uid() = viewer_id);

-- reportUser() has always sent a `category`, but the reports table never
-- had the column (schema drift) — add it so those calls stop silently
-- dropping the category.
alter table reports add column if not exists category text default 'other';

-- iOS review (and basic safety) requires more than a client-side age
-- check on signup — enforce 18+ at the database level too.
alter table profiles drop constraint if exists profiles_age_check;
create or replace function enforce_adult_profile()
returns trigger as $$
begin
  if new.birthday is not null and new.birthday > (current_date - interval '18 years') then
    raise exception 'NYX is only available to users aged 18 or older';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_enforce_adult on profiles;
create trigger profiles_enforce_adult
before insert or update of birthday on profiles
for each row execute function enforce_adult_profile();

-- Use the database clock for presence. Client clocks can be wrong, and a
-- hidden browser tab must not make someone appear online indefinitely.
create or replace function touch_last_active()
returns timestamptz as $$
declare
  touched_at timestamptz := now();
begin
  update profiles set last_active = touched_at where id = auth.uid();
  return touched_at;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function touch_last_active() from public;
grant execute on function touch_last_active() to authenticated;

-- =============================================
-- Private Premium favorites
-- =============================================
-- Private Premium favorites.
-- A favorite is deliberately NOT a like: it never creates a match,
-- notification, message permission, ranking signal, or profile-view event.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  favorite_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, favorite_user_id),
  constraint favorites_not_self check (user_id <> favorite_user_id)
);

create index if not exists favorites_owner_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create or replace function public.has_active_nyx_premium(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and coalesce(is_premium, false)
      and (premium_expires_at is null or premium_expires_at > now())
  );
$$;

revoke all on function public.has_active_nyx_premium(uuid) from public;
grant execute on function public.has_active_nyx_premium(uuid) to authenticated;

create schema if not exists nyx_private;
revoke all on schema nyx_private from public;
grant usage on schema nyx_private to authenticated;

create or replace function nyx_private.can_read_private_favorite(
  p_owner_id uuid,
  p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    and public.has_active_nyx_premium(p_owner_id)
    and exists (
      select 1 from public.profiles
      where id = p_target_id
        and not coalesce(is_banned, false)
        and deleted_at is null
    )
    and not exists (
      select 1 from public.blocked_users
      where (blocker_id = p_owner_id and blocked_id = p_target_id)
         or (blocker_id = p_target_id and blocked_id = p_owner_id)
    );
$$;

revoke all on function nyx_private.can_read_private_favorite(uuid, uuid) from public;
grant execute on function nyx_private.can_read_private_favorite(uuid, uuid) to authenticated;


drop policy if exists "owners read active premium favorites" on public.favorites;
drop policy if exists "owners remove favorites" on public.favorites;

create policy "owners read active premium favorites"
on public.favorites
for select
to authenticated
using (nyx_private.can_read_private_favorite(user_id, favorite_user_id));

create policy "owners remove favorites"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.favorites from anon;
revoke insert, update on table public.favorites from authenticated;
grant select, delete on table public.favorites to authenticated;

create or replace function public.toggle_private_favorite(
  p_target_id uuid,
  p_should_favorite boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  premium_active boolean;
  caller_plan text;
  favorite_limit integer;
  favorite_count integer;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_target_id is null or p_target_id = caller then
    raise exception 'FAVORITE_NOT_ALLOWED';
  end if;

  -- Removing is always allowed, including after a subscription expires.
  if not coalesce(p_should_favorite, false) then
    delete from public.favorites
    where user_id = caller and favorite_user_id = p_target_id;
    return false;
  end if;

  -- The row lock serializes adds for this owner so the cap cannot be
  -- bypassed with concurrent requests.
  select
    coalesce(is_premium, false)
      and (premium_expires_at is null or premium_expires_at > now()),
    coalesce(premium_plan, 'premium')
  into premium_active, caller_plan
  from public.profiles
  where id = caller
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if not premium_active then
    raise exception 'PREMIUM_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_target_id
      and not coalesce(is_banned, false)
      and deleted_at is null
  ) then
    raise exception 'FAVORITE_NOT_ALLOWED';
  end if;

  -- A block in either direction makes the pair ineligible. The caller
  -- cannot infer which direction caused the generic error.
  if exists (
    select 1
    from public.blocked_users
    where (blocker_id = caller and blocked_id = p_target_id)
       or (blocker_id = p_target_id and blocked_id = caller)
  ) then
    raise exception 'FAVORITE_NOT_ALLOWED';
  end if;

  if exists (
    select 1 from public.favorites
    where user_id = caller and favorite_user_id = p_target_id
  ) then
    return true;
  end if;

  favorite_limit := case when caller_plan = 'premium_plus' then 250 else 100 end;
  select count(*) into favorite_count
  from public.favorites
  where user_id = caller;

  if favorite_count >= favorite_limit then
    raise exception 'FAVORITE_LIMIT_REACHED';
  end if;

  insert into public.favorites (user_id, favorite_user_id)
  values (caller, p_target_id)
  on conflict (user_id, favorite_user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.toggle_private_favorite(uuid, boolean) from public;
grant execute on function public.toggle_private_favorite(uuid, boolean) to authenticated;

-- Blocking either direction removes any private bookmarks for the pair.
create or replace function public.remove_pair_favorites_after_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.favorites
  where (user_id = new.blocker_id and favorite_user_id = new.blocked_id)
     or (user_id = new.blocked_id and favorite_user_id = new.blocker_id);
  return new;
end;
$$;

revoke all on function public.remove_pair_favorites_after_block() from public;

drop trigger if exists remove_pair_favorites_on_block on public.blocked_users;
create trigger remove_pair_favorites_on_block
after insert on public.blocked_users
for each row execute function public.remove_pair_favorites_after_block();

-- =============================================
-- Private AI simulation sessions
-- =============================================
-- Persona profiles may contain excerpts derived from private conversations,
-- so neither the simulated person nor other users can read them.
create table if not exists public.simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  clone_user_id uuid references public.profiles(id) on delete set null,
  clone_name text not null default '',
  clone_avatar text,
  persona_profile jsonb not null default '{}'::jsonb,
  messages_used integer not null default 0 check (messages_used >= 0),
  source_batch_count integer not null default 0 check (source_batch_count >= 0),
  model_version smallint not null default 2,
  mode text not null default 'fresh' check (mode in ('fresh', 'continue')),
  source_kind text not null default 'matched_chat' check (source_kind in ('matched_chat', 'imported_chat')),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.simulation_sessions add column if not exists source_batch_count integer not null default 0;
alter table public.simulation_sessions add column if not exists model_version smallint not null default 2;
alter table public.simulation_sessions add column if not exists mode text not null default 'fresh';
alter table public.simulation_sessions add column if not exists source_kind text not null default 'matched_chat';

create table if not exists public.simulation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.simulation_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'clone')),
  content text not null check (char_length(content) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index if not exists simulation_sessions_owner_active_idx
  on public.simulation_sessions (user_id, last_active_at desc);
create index if not exists simulation_messages_session_created_idx
  on public.simulation_messages (session_id, created_at);

alter table public.simulation_sessions enable row level security;
alter table public.simulation_messages enable row level security;

drop policy if exists "owners read simulation sessions" on public.simulation_sessions;
drop policy if exists "owners update simulation sessions" on public.simulation_sessions;
drop policy if exists "owners delete simulation sessions" on public.simulation_sessions;
drop policy if exists "owners read simulation messages" on public.simulation_messages;
drop policy if exists "owners add simulation messages" on public.simulation_messages;
drop policy if exists "owners delete simulation messages" on public.simulation_messages;

create policy "owners read simulation sessions"
on public.simulation_sessions for select to authenticated
using (auth.uid() = user_id);

create policy "owners update simulation sessions"
on public.simulation_sessions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "owners delete simulation sessions"
on public.simulation_sessions for delete to authenticated
using (auth.uid() = user_id);

create policy "owners read simulation messages"
on public.simulation_messages for select to authenticated
using (
  exists (
    select 1 from public.simulation_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
);

create policy "owners add simulation messages"
on public.simulation_messages for insert to authenticated
with check (
  exists (
    select 1 from public.simulation_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
);

create policy "owners delete simulation messages"
on public.simulation_messages for delete to authenticated
using (
  exists (
    select 1 from public.simulation_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
);

revoke all on table public.simulation_sessions from anon;
revoke all on table public.simulation_messages from anon;
revoke insert on table public.simulation_sessions from authenticated;
grant select, update, delete on table public.simulation_sessions to authenticated;
grant select, insert, delete on table public.simulation_messages to authenticated;

create or replace function public.create_private_simulation_session(
  p_match_id uuid,
  p_clone_user_id uuid,
  p_clone_name text,
  p_clone_avatar text,
  p_persona_profile jsonb,
  p_messages_used integer,
  p_source_batch_count integer default 0,
  p_mode text default 'fresh'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  premium_active boolean;
  caller_plan text;
  used_today integer;
  daily_limit integer;
  new_session_id uuid;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_messages_used < 0 or p_source_batch_count < 0 then
    raise exception 'INVALID_SIMULATION_SOURCE_COUNT';
  end if;
  if p_mode not in ('fresh', 'continue') then
    raise exception 'INVALID_SIMULATION_MODE';
  end if;
  if jsonb_typeof(coalesce(p_persona_profile, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_persona_profile, '{}'::jsonb)::text) > 250000 then
    raise exception 'INVALID_SIMULATION_PERSONA';
  end if;

  if p_match_id is null then
    if p_clone_user_id is not null then
      raise exception 'SIMULATION_NOT_ALLOWED';
    end if;
  else
    if p_clone_user_id is null or not exists (
      select 1
      from public.matches match_row
      where match_row.id = p_match_id
        and (match_row.user1_id = caller or match_row.user2_id = caller)
        and (match_row.user1_id = p_clone_user_id or match_row.user2_id = p_clone_user_id)
        and p_clone_user_id <> caller
    ) then
      raise exception 'SIMULATION_NOT_ALLOWED';
    end if;
    if exists (
      select 1 from public.blocked_users
      where (blocker_id = caller and blocked_id = p_clone_user_id)
         or (blocker_id = p_clone_user_id and blocked_id = caller)
    ) then
      raise exception 'SIMULATION_NOT_ALLOWED';
    end if;
  end if;

  perform public.reset_daily_likes_if_needed(caller);
  select
    coalesce(is_premium, false)
      and (premium_expires_at is null or premium_expires_at > now()),
    coalesce(premium_plan, 'premium'),
    coalesce(clone_used_today, 0)
  into premium_active, caller_plan, used_today
  from public.profiles
  where id = caller
  for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  daily_limit := case
    when premium_active and caller_plan = 'premium_plus' then 50
    when premium_active then 20
    else 3
  end;
  if used_today >= daily_limit then
    raise exception 'CLONE_DAILY_LIMIT_REACHED';
  end if;

  insert into public.simulation_sessions (
    user_id, match_id, clone_user_id, clone_name, clone_avatar,
    persona_profile, messages_used, source_batch_count, model_version, mode, source_kind
  ) values (
    caller, p_match_id, p_clone_user_id, left(coalesce(p_clone_name, ''), 120),
    left(p_clone_avatar, 2048), coalesce(p_persona_profile, '{}'::jsonb), p_messages_used,
    p_source_batch_count, 2, p_mode,
    case when p_match_id is null then 'imported_chat' else 'matched_chat' end
  ) returning id into new_session_id;

  update public.profiles
  set clone_used_today = used_today + 1
  where id = caller;

  return new_session_id;
end;
$$;

revoke all on function public.create_private_simulation_session(uuid, uuid, text, text, jsonb, integer, integer, text) from public;
grant execute on function public.create_private_simulation_session(uuid, uuid, text, text, jsonb, integer, integer, text) to authenticated;

-- =============================================
-- Subscription security, private viewer lists, atomic Spark answers
-- =============================================
-- Subscription integrity, Premium-gated profile viewers, and atomic Daily Spark answers.
-- This migration assumes the existing NYX profiles/matches/daily_sparks tables.

-- Server-only idempotency log: one notification delivery per chat message.
create table if not exists public.push_delivery_log (
  message_id text primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.push_delivery_log enable row level security;
revoke all on table public.push_delivery_log from anon, authenticated;
grant select, insert, delete on table public.push_delivery_log to service_role;
create index if not exists idx_push_delivery_created_at
  on public.push_delivery_log(created_at);

alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists premium_plan text;
alter table public.profiles add column if not exists premium_expires_at timestamptz;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

create unique index if not exists profiles_stripe_subscription_unique
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Stripe identifiers are billing secrets, not public dating-profile fields.
-- Keep them behind RLS in a service-role-only table and migrate legacy values.
create table if not exists public.billing_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.billing_accounts enable row level security;
revoke all on table public.billing_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.billing_accounts to service_role;

insert into public.billing_accounts (user_id, stripe_customer_id, stripe_subscription_id)
select id, stripe_customer_id, stripe_subscription_id
from public.profiles
where stripe_customer_id is not null or stripe_subscription_id is not null
on conflict (user_id) do update
set stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    updated_at = now();

select set_config('nyx.allow_subscription_write', 'on', true);
update public.profiles
set stripe_customer_id = null,
    stripe_subscription_id = null
where stripe_customer_id is not null or stripe_subscription_id is not null;
select set_config('nyx.allow_subscription_write', 'off', true);

create or replace function public.protect_server_managed_subscription_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
     or current_setting('nyx.allow_subscription_write', true) = 'on' then
    return new;
  end if;

  if (to_jsonb(new)->'is_premium') is distinct from (to_jsonb(old)->'is_premium')
     or (to_jsonb(new)->'premium_plan') is distinct from (to_jsonb(old)->'premium_plan')
     or (to_jsonb(new)->'premium_expires_at') is distinct from (to_jsonb(old)->'premium_expires_at')
     or (to_jsonb(new)->'stripe_customer_id') is distinct from (to_jsonb(old)->'stripe_customer_id')
     or (to_jsonb(new)->'stripe_subscription_id') is distinct from (to_jsonb(old)->'stripe_subscription_id') then
    raise exception 'SUBSCRIPTION_FIELDS_ARE_SERVER_MANAGED';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_server_managed_subscription_fields() from public;

drop trigger if exists profiles_protect_subscription_fields on public.profiles;
create trigger profiles_protect_subscription_fields
before update of is_premium, premium_plan, premium_expires_at, stripe_customer_id, stripe_subscription_id
on public.profiles
for each row execute function public.protect_server_managed_subscription_fields();

-- The admin UI uses this checked RPC instead of writing paid status directly.
create or replace function public.admin_set_premium(
  p_user_id uuid,
  p_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_super_admin boolean := false;
begin
  if p_plan is not null and p_plan not in ('premium', 'premium_plus') then
    raise exception 'INVALID_PREMIUM_PLAN';
  end if;
  if to_regclass('public.admin_users') is null then
    raise exception 'ADMIN_CONFIGURATION_MISSING';
  end if;

  execute $admin$
    select exists (
      select 1
      from public.admin_users admin_row
      where admin_row.user_id = $1
        and admin_row.role = 'super_admin'
        and coalesce((to_jsonb(admin_row)->>'is_active')::boolean, true)
    )
  $admin$ into caller_is_super_admin using auth.uid();

  if not caller_is_super_admin then
    raise exception 'ADMIN_REQUIRED';
  end if;

  perform set_config('nyx.allow_subscription_write', 'on', true);
  update public.profiles
  set
    is_premium = p_plan is not null,
    premium_plan = p_plan,
    premium_expires_at = case
      when p_plan is null then null
      else now() + interval '30 days'
    end
  where id = p_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_set_premium(uuid, text) from public;
grant execute on function public.admin_set_premium(uuid, text) to authenticated;


-- Enforce block relationships and active paid access at the transaction boundary.
-- The client no longer needs direct write access to swipes.
create or replace function public.check_match(p_swiper uuid, p_swiped uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mutual boolean;
  new_match_id uuid;
begin
  if auth.uid() is null or p_swiper <> auth.uid() then
    raise exception 'NOT_AUTHORIZED_TO_MATCH';
  end if;
  if exists (
    select 1
    from public.blocked_users block_row
    where (block_row.blocker_id = p_swiper and block_row.blocked_id = p_swiped)
       or (block_row.blocker_id = p_swiped and block_row.blocked_id = p_swiper)
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  select exists (
    select 1
    from public.swipes
    where swiper_id = p_swiped
      and swiped_id = p_swiper
      and direction in ('like', 'superlike')
  ) into v_mutual;

  if v_mutual then
    insert into public.matches (user1_id, user2_id)
    values (least(p_swiper, p_swiped), greatest(p_swiper, p_swiped))
    on conflict do nothing
    returning id into new_match_id;

    if new_match_id is not null then
      insert into public.notifications (user_id, type, content, from_user_id)
      values
        (p_swiper, 'match', '你們配對成功了！', p_swiped),
        (p_swiped, 'match', '你們配對成功了！', p_swiper);
    end if;
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.check_match(uuid, uuid) from public;
revoke execute on function public.check_match(uuid, uuid) from authenticated;

-- Replace the legacy counter reset helper with an owner-only implementation.
-- Without this check, a client could call the RPC with another user's UUID.
create or replace function public.reset_daily_likes_if_needed(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> uid then
    raise exception 'NOT_AUTHORIZED_TO_RESET_USAGE';
  end if;

  update public.profiles
  set daily_likes_used = 0,
      superlike_used_today = 0,
      clone_used_today = 0,
      daily_likes_reset_at = pg_catalog.now() + interval '24 hours'
  where id = uid
    and (daily_likes_reset_at is null or daily_likes_reset_at <= pg_catalog.now());
end;
$$;

revoke all on function public.reset_daily_likes_if_needed(uuid) from public;
grant execute on function public.reset_daily_likes_if_needed(uuid) to authenticated;

create or replace function public.record_swipe_action(p_swiped uuid, p_direction text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  premium boolean;
  likes_used integer;
  superlikes_used integer;
  existing_direction text;
begin
  if caller is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_swiped is null or p_swiped = caller then raise exception 'INVALID_SWIPE_TARGET'; end if;
  if p_direction not in ('like', 'pass', 'superlike') then raise exception 'INVALID_SWIPE_DIRECTION'; end if;

  if not exists (
    select 1 from public.profiles target
    where target.id = p_swiped
      and not coalesce(target.is_banned, false)
      and target.deleted_at is null
      and coalesce(target.is_active, true)
  ) then
    raise exception 'INVALID_SWIPE_TARGET';
  end if;
  if exists (
    select 1
    from public.blocked_users block_row
    where (block_row.blocker_id = caller and block_row.blocked_id = p_swiped)
       or (block_row.blocker_id = p_swiped and block_row.blocked_id = caller)
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  perform public.reset_daily_likes_if_needed(caller);
  select
    public.has_active_nyx_premium(caller),
    coalesce(daily_likes_used, 0),
    coalesce(superlike_used_today, 0)
  into premium, likes_used, superlikes_used
  from public.profiles
  where id = caller
  for update;

  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  select direction
  into existing_direction
  from public.swipes
  where swiper_id = caller and swiped_id = p_swiped;

  if found and existing_direction = p_direction then
    if p_direction = 'pass' then return false; end if;
    return public.check_match(caller, p_swiped);
  end if;

  if p_direction = 'like' then
    if not premium and likes_used >= 30 then raise exception 'DAILY_LIKE_LIMIT_REACHED'; end if;
    update public.profiles set daily_likes_used = likes_used + 1 where id = caller;
  elsif p_direction = 'superlike' then
    if superlikes_used >= case when premium then 5 else 1 end then
      raise exception 'DAILY_SUPERLIKE_LIMIT_REACHED';
    end if;
    update public.profiles set superlike_used_today = superlikes_used + 1 where id = caller;
  end if;

  insert into public.swipes (swiper_id, swiped_id, direction)
  values (caller, p_swiped, p_direction)
  on conflict (swiper_id, swiped_id)
  do update set direction = excluded.direction;

  if p_direction = 'pass' then return false; end if;
  return public.check_match(caller, p_swiped);
end;
$$;

revoke all on function public.record_swipe_action(uuid, text) from public;
grant execute on function public.record_swipe_action(uuid, text) to authenticated;
revoke insert, update, delete on public.swipes from anon, authenticated;

-- A blocked account must disappear in both directions without revealing a
-- separate list of who blocked whom to either client.
create or replace function nyx_private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_profile_id = auth.uid()
    or not exists (
      select 1
      from public.blocked_users block_row
      where (block_row.blocker_id = auth.uid() and block_row.blocked_id = p_profile_id)
         or (block_row.blocker_id = p_profile_id and block_row.blocked_id = auth.uid())
    );
$$;

revoke all on function nyx_private.can_view_profile(uuid) from public;
grant execute on function nyx_private.can_view_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "blocked relationships cannot read profiles" on public.profiles;
create policy "blocked relationships cannot read profiles"
on public.profiles
as restrictive
for select
to authenticated
using (
  nyx_private.can_view_profile(id)
);


-- Profile-view rows remain private. Paid users consume only these checked RPCs.
create index if not exists profile_views_viewed_created_idx
  on public.profile_views (viewed_id, created_at desc);

drop policy if exists "read profile views involving you" on public.profile_views;
drop policy if exists "viewers read their own profile view history" on public.profile_views;
create policy "viewers read their own profile view history"
on public.profile_views
for select
to authenticated
using (auth.uid() = viewer_id);

create or replace function public.get_my_profile_view_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  result bigint;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_active_nyx_premium(caller) then
    raise exception 'PREMIUM_REQUIRED';
  end if;

  select count(distinct viewer_id)
  into result
  from public.profile_views
  where viewed_id = caller
    and viewer_id <> caller;

  return coalesce(result, 0);
end;
$$;

revoke all on function public.get_my_profile_view_count() from public;
grant execute on function public.get_my_profile_view_count() to authenticated;

create or replace function public.get_my_profile_viewers()
returns table (
  viewer_id uuid,
  display_name text,
  username text,
  avatar_url text,
  gender text,
  birthday date,
  mbti text,
  viewed_at timestamptz,
  is_premium boolean,
  premium_plan text,
  premium_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_active_nyx_premium(caller) then
    raise exception 'PREMIUM_REQUIRED';
  end if;

  return query
  select
    profile.id,
    profile.display_name::text,
    profile.username::text,
    profile.avatar_url::text,
    profile.gender::text,
    profile.birthday::date,
    profile.mbti::text,
    max(view_row.created_at) as viewed_at,
    coalesce(profile.is_premium, false),
    profile.premium_plan::text,
    profile.premium_expires_at::timestamptz
  from public.profile_views view_row
  join public.profiles profile on profile.id = view_row.viewer_id
  where view_row.viewed_id = caller
    and view_row.viewer_id <> caller
    and not coalesce(profile.is_banned, false)
    and profile.deleted_at is null
    and not exists (
      select 1
      from public.blocked_users block_row
      where (block_row.blocker_id = caller and block_row.blocked_id = profile.id)
         or (block_row.blocker_id = profile.id and block_row.blocked_id = caller)
    )
  group by
    profile.id, profile.display_name, profile.username, profile.avatar_url,
    profile.gender, profile.birthday, profile.mbti, profile.is_premium,
    profile.premium_plan, profile.premium_expires_at
  order by max(view_row.created_at) desc
  limit 200;
end;
$$;

revoke all on function public.get_my_profile_viewers() from public;
grant execute on function public.get_my_profile_viewers() to authenticated;

-- Recalculate the shared bond score from server-owned counters. Keeping this
-- server-side prevents clients from writing arbitrary chemistry values.
create or replace function public.update_chemistry(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  match_row public.matches%rowtype;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into match_row
  from public.matches
  where id = p_match_id;

  if not found or caller not in (match_row.user1_id, match_row.user2_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  update public.matches
  set chemistry_score = least(
    100,
    50 + coalesce(encounter_count, 0) * 3 + coalesce(spark_count, 0) * 4
  )
  where id = p_match_id;
end;
$$;

revoke all on function public.update_chemistry(uuid) from public;
grant execute on function public.update_chemistry(uuid) to authenticated;

-- Create exactly one curated Daily Spark per match/day. The advisory lock
-- prevents both people opening chat simultaneously from creating duplicates.
create or replace function public.get_or_create_daily_spark(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  match_row public.matches%rowtype;
  spark_row public.daily_sparks%rowtype;
  completed_count integer := 0;
  question_pool text[];
  selected_question text;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into match_row from public.matches where id = p_match_id;
  if not found or caller not in (match_row.user1_id, match_row.user2_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_match_id::text || ':' || current_date::text, 0)
  );

  select * into spark_row
  from public.daily_sparks
  where match_id = p_match_id and spark_date = current_date
  order by created_at desc
  limit 1;
  if found then
    return to_jsonb(spark_row);
  end if;

  select count(*)::integer into completed_count
  from public.daily_sparks
  where match_id = p_match_id and revealed_at is not null;

  if completed_count < 5 then
    question_pool := array[
      '你手機裡最常聽的一首歌是什麼？它讓你想到什麼？',
      '最近一件讓你意外開心的小事是什麼？',
      '你有沒有一個只有你自己知道的小習慣？',
      '最近讓你笑得最開心的一件事是什麼？',
      '如果今晚可以去任何地方吃晚飯，你想去哪裡？',
      '你現在手機桌面是什麼？為什麼是它？',
      '你覺得自己有什麼別人不知道的才能？',
      '最近有沒有一首歌或一部劇讓你停不下來？'
    ];
  elsif completed_count < 15 then
    question_pool := array[
      '你最近一次說謊是什麼？說的什麼？',
      '你覺得自己最被低估的地方是什麼？',
      '什麼時候你覺得自己最像自己？',
      '你有沒有一件事做了之後覺得自己很勇敢？',
      '你最捨不得的一段記憶是什麼？',
      '什麼樣的人讓你第一眼就有好感？具體說說。',
      '你現在生活裡最享受的一個時刻是什麼？',
      '你有沒有一個地方，去了就會很安靜下來？',
      '最近有沒有一件你意外發現自己很在乎的事？',
      '你覺得自己和大多數人最不一樣的地方是什麼？'
    ];
  else
    question_pool := array[
      '你什麼時候覺得最孤獨？',
      '有沒有一個夢想，從來沒跟任何人說過？',
      '你覺得自己值得被好好愛嗎？為什麼這樣覺得？',
      '如果要對五年前的自己說一句話，你說什麼？',
      '你現在最缺少的是什麼？',
      '你有沒有一段關係，讓你學到了一些東西，但說出來很難？',
      '你什麼時候覺得最接近自己想成為的那個人？',
      '有沒有一件事，你一直覺得自己應該更勇敢去做？',
      '你覺得現在的自己，和你想象中的自己差多遠？',
      '如果你可以讓某個人真正了解你，你最想讓他們知道什麼？'
    ];
  end if;

  select q.candidate into selected_question
  from unnest(question_pool) as q(candidate)
  where not exists (
    select 1 from public.daily_sparks used
    where used.match_id = p_match_id and used.question = q.candidate
  )
  order by pg_catalog.random()
  limit 1;

  if selected_question is null then
    selected_question := question_pool[
      1 + floor(pg_catalog.random() * array_length(question_pool, 1))::integer
    ];
  end if;

  insert into public.daily_sparks (
    match_id, user1_id, user2_id, question, spark_date
  ) values (
    p_match_id, match_row.user1_id, match_row.user2_id,
    selected_question, current_date
  ) returning * into spark_row;

  return to_jsonb(spark_row);
end;
$$;

revoke all on function public.get_or_create_daily_spark(uuid) from public;
grant execute on function public.get_or_create_daily_spark(uuid) to authenticated;
revoke insert, update, delete on table public.daily_sparks from authenticated;

-- One transaction owns answer authorization, reveal, memory creation, and counters.
create or replace function public.submit_daily_spark_answer(
  p_spark_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  spark_row public.daily_sparks%rowtype;
  clean_answer text := trim(coalesce(p_answer, ''));
  newly_revealed boolean := false;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if char_length(clean_answer) < 1 or char_length(clean_answer) > 2000 then
    raise exception 'INVALID_SPARK_ANSWER';
  end if;

  select *
  into spark_row
  from public.daily_sparks
  where id = p_spark_id
  for update;

  if not found or caller not in (spark_row.user1_id, spark_row.user2_id) then
    raise exception 'SPARK_NOT_FOUND';
  end if;

  if spark_row.revealed_at is null then
    if caller = spark_row.user1_id then
      update public.daily_sparks
      set answer_user1 = clean_answer
      where id = p_spark_id;
    else
      update public.daily_sparks
      set answer_user2 = clean_answer
      where id = p_spark_id;
    end if;

    select *
    into spark_row
    from public.daily_sparks
    where id = p_spark_id;

    if spark_row.answer_user1 is not null
       and spark_row.answer_user2 is not null
       and spark_row.revealed_at is null then
      newly_revealed := true;
      update public.daily_sparks
      set revealed_at = now()
      where id = p_spark_id
      returning * into spark_row;

      insert into public.memories (
        match_id, user1_id, user2_id, type, title, content
      ) values (
        spark_row.match_id,
        spark_row.user1_id,
        spark_row.user2_id,
        'spark',
        left(spark_row.question, 25) || '...',
        jsonb_build_object(
          'question', spark_row.question,
          'answerA', spark_row.answer_user1,
          'answerB', spark_row.answer_user2
        )
      );

      update public.matches
      set spark_count = coalesce(spark_count, 0) + 1
      where id = spark_row.match_id;

      perform public.update_chemistry(spark_row.match_id);
    end if;
  end if;

  return to_jsonb(spark_row) || jsonb_build_object('newly_revealed', newly_revealed);
end;
$$;

revoke all on function public.submit_daily_spark_answer(uuid, text) from public;
grant execute on function public.submit_daily_spark_answer(uuid, text) to authenticated;

-- Store one AI-generated encounter per match/day after validating that the
-- caller belongs to the match. Generation can happen concurrently on both
-- devices, but only the first accepted scene is persisted.
create or replace function public.create_daily_encounter(
  p_match_id uuid,
  p_scene text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  match_row public.matches%rowtype;
  encounter_row public.encounters%rowtype;
  clean_scene text := trim(coalesce(p_scene, ''));
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if char_length(clean_scene) < 1 or char_length(clean_scene) > 200 then
    raise exception 'INVALID_ENCOUNTER_SCENE';
  end if;

  select * into match_row from public.matches where id = p_match_id;
  if not found or caller not in (match_row.user1_id, match_row.user2_id) then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('encounter:' || p_match_id::text || ':' || current_date::text, 0)
  );

  select * into encounter_row
  from public.encounters
  where match_id = p_match_id
    and created_at >= current_date
    and created_at < current_date + 1
  order by created_at desc
  limit 1;
  if found then
    return to_jsonb(encounter_row);
  end if;

  insert into public.encounters (
    match_id, user1_id, user2_id, scene_text, option_a, option_b
  ) values (
    p_match_id, match_row.user1_id, match_row.user2_id,
    clean_scene, '', ''
  ) returning * into encounter_row;

  return to_jsonb(encounter_row);
end;
$$;

revoke all on function public.create_daily_encounter(uuid, text) from public;
grant execute on function public.create_daily_encounter(uuid, text) to authenticated;
revoke insert, update, delete on table public.encounters from authenticated;

-- Encounter answers follow the same atomic pattern as Daily Spark. The old
-- client attempted to write an RPC result into an integer counter, and two
-- simultaneous answers could create duplicate memories.
create or replace function public.submit_encounter_choice(
  p_encounter_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  encounter_row public.encounters%rowtype;
  clean_choice text := trim(coalesce(p_choice, ''));
  newly_revealed boolean := false;
begin
  if caller is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if char_length(clean_choice) < 1 or char_length(clean_choice) > 2000 then
    raise exception 'INVALID_ENCOUNTER_CHOICE';
  end if;

  select * into encounter_row
  from public.encounters
  where id = p_encounter_id
  for update;

  if not found or caller not in (encounter_row.user1_id, encounter_row.user2_id) then
    raise exception 'ENCOUNTER_NOT_FOUND';
  end if;

  if encounter_row.revealed_at is null then
    if caller = encounter_row.user1_id and encounter_row.choice_user1 is null then
      update public.encounters
      set choice_user1 = clean_choice
      where id = p_encounter_id;
    elsif caller = encounter_row.user2_id and encounter_row.choice_user2 is null then
      update public.encounters
      set choice_user2 = clean_choice
      where id = p_encounter_id;
    end if;

    select * into encounter_row
    from public.encounters
    where id = p_encounter_id;

    if encounter_row.choice_user1 is not null
       and encounter_row.choice_user2 is not null
       and encounter_row.revealed_at is null then
      newly_revealed := true;
      update public.encounters
      set revealed_at = now()
      where id = p_encounter_id
      returning * into encounter_row;

      insert into public.memories (
        match_id, user1_id, user2_id, type, title, content
      ) values (
        encounter_row.match_id,
        encounter_row.user1_id,
        encounter_row.user2_id,
        'encounter',
        left(encounter_row.scene_text, 20) || '...',
        jsonb_build_object(
          'scene', encounter_row.scene_text,
          'choiceA', encounter_row.choice_user1,
          'choiceB', encounter_row.choice_user2
        )
      );

      update public.matches
      set encounter_count = coalesce(encounter_count, 0) + 1,
          last_encounter_at = now()
      where id = encounter_row.match_id;

      perform public.update_chemistry(encounter_row.match_id);
    end if;
  end if;

  return jsonb_build_object(
    'revealed', encounter_row.revealed_at is not null,
    'newly_revealed', newly_revealed,
    'encounter', to_jsonb(encounter_row)
  );
end;
$$;

revoke all on function public.submit_encounter_choice(uuid, text) from public;
grant execute on function public.submit_encounter_choice(uuid, text) to authenticated;
