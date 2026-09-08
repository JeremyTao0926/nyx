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
