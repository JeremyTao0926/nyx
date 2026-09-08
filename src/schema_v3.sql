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
