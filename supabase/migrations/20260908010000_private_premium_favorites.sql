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
