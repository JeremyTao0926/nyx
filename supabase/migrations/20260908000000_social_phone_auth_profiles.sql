-- Allow OAuth and phone identities to be created before NYX collects the
-- mandatory 18+ profile fields. The app blocks access until birthday, name,
-- and username are completed; the profiles trigger still rejects known
-- underage dates at the database boundary.

alter table public.profiles alter column birthday drop not null;
alter table public.profiles alter column email drop not null;

create or replace function public.handle_new_user()
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

  generated_username := coalesce(
    requested_username,
    'nyx_' || left(replace(new.id::text, '-', ''), 10)
  );
  display_value := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    case when new.phone is not null then 'NYX ' || right(new.phone, 4) end,
    'NYX Member'
  );

  insert into public.profiles (
    id, username, display_name, email, birthday, gender, mbti,
    avatar_url, onboarding_done
  ) values (
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
  for each row execute procedure public.handle_new_user();
