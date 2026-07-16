-- =============================================
-- NYX v3 Schema — 在 SQL Editor 執行
-- =============================================

-- 更新 handle_new_user 支持 email + metadata
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, display_name, birthday, gender, mbti)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    (new.raw_user_meta_data->>'birthday')::date,
    'male', 'INFP'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

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
alter publication supabase_realtime add table chat_messages;

-- Enable Realtime for profiles (needed so the chat screen sees the other
-- person's last_active / hide_online_status update live, not just on open)
-- （還需要在 Supabase Dashboard → Database → Replication → 開啟 profiles）
alter publication supabase_realtime add table profiles;

-- Indexes
create index if not exists idx_notif_user on notifications(user_id, read, created_at);
create index if not exists idx_blocks on blocked_users(blocker_id);

-- Update check_match function to also create notifications
create or replace function check_match(p_swiper uuid, p_swiped uuid)
returns boolean as $$
declare v_mutual boolean;
begin
  select exists(
    select 1 from swipes where swiper_id=p_swiped and swiped_id=p_swiper and direction in ('like','superlike')
  ) into v_mutual;
  if v_mutual then
    insert into matches (user1_id, user2_id)
    values (least(p_swiper,p_swiped), greatest(p_swiper,p_swiped))
    on conflict do nothing;
    -- Notify both users
    insert into notifications (user_id, type, content, from_user_id)
    values (p_swiper,'match','你們配對成功了！',p_swiped),
           (p_swiped,'match','你們配對成功了！',p_swiper)
    on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$ language plpgsql security definer;

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
