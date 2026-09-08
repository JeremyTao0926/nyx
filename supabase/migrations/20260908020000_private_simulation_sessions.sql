-- Private AI simulation sessions and server-authoritative daily usage.
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
