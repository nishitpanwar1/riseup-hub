
-- =================== PROFILES ===================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null,
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  category_focus text[] default '{}',
  follower_count integer default 0,
  following_count integer default 0,
  total_views bigint default 0,
  creator_tier text default 'new' check (creator_tier in ('new','verified','rising','elite')),
  trust_score integer default 50 check (trust_score >= 0 and trust_score <= 100),
  is_creator boolean default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- =================== VIDEOS ===================
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 100),
  description text check (char_length(description) <= 500),
  category text not null check (category in ('discipline','fitness','study','entrepreneur','mindset','finance','morning','sports')),
  video_url text not null,
  thumbnail_url text not null,
  duration integer not null,
  view_count bigint default 0,
  like_count integer default 0,
  save_count integer default 0,
  share_count integer default 0,
  status text default 'active' check (status in ('processing','active','rejected')),
  is_short boolean default true,
  tags text[] default '{}',
  created_at timestamptz default now()
);
alter table public.videos enable row level security;
create policy "Active videos are viewable by everyone" on public.videos for select using (status = 'active' or auth.uid() = user_id);
create policy "Users insert own videos" on public.videos for insert with check (auth.uid() = user_id);
create policy "Users update own videos" on public.videos for update using (auth.uid() = user_id);
create policy "Users delete own videos" on public.videos for delete using (auth.uid() = user_id);
create index videos_category_idx on public.videos(category);
create index videos_user_idx on public.videos(user_id);
create index videos_created_idx on public.videos(created_at desc);

-- =================== LIKES ===================
create table public.video_likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(video_id, user_id)
);
alter table public.video_likes enable row level security;
create policy "Likes viewable by everyone" on public.video_likes for select using (true);
create policy "Users like as themselves" on public.video_likes for insert with check (auth.uid() = user_id);
create policy "Users unlike own" on public.video_likes for delete using (auth.uid() = user_id);

-- =================== SAVES ===================
create table public.video_saves (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  playlist_name text default 'Saved',
  note text check (char_length(note) <= 200),
  created_at timestamptz default now()
);
alter table public.video_saves enable row level security;
create policy "Users view own saves" on public.video_saves for select using (auth.uid() = user_id);
create policy "Users save as themselves" on public.video_saves for insert with check (auth.uid() = user_id);
create policy "Users delete own saves" on public.video_saves for delete using (auth.uid() = user_id);

-- =================== VIEWS ===================
create table public.video_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  seconds_watched integer not null,
  total_seconds integer not null,
  completion_rate float check (completion_rate >= 0 and completion_rate <= 1),
  created_at timestamptz default now()
);
alter table public.video_views enable row level security;
create policy "Anyone can record a view" on public.video_views for insert with check (true);
create policy "Owner reads own views" on public.video_views for select using (auth.uid() = user_id);

-- =================== FOLLOWS ===================
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows enable row level security;
create policy "Follows are public" on public.follows for select using (true);
create policy "Users follow as themselves" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users unfollow own" on public.follows for delete using (auth.uid() = follower_id);

-- =================== STREAKS ===================
create table public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_watch_date date,
  last_upload_date date,
  total_watch_days integer default 0,
  updated_at timestamptz default now()
);
alter table public.streaks enable row level security;
create policy "Streaks viewable by everyone" on public.streaks for select using (true);
create policy "Users update own streak" on public.streaks for update using (auth.uid() = user_id);
create policy "Users insert own streak" on public.streaks for insert with check (auth.uid() = user_id);

-- =================== ROOMS ===================
create table public.accountability_rooms (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete set null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 60),
  description text check (char_length(description) <= 300),
  challenge_days integer default 7,
  member_count integer default 1,
  max_members integer default 50,
  is_active boolean default true,
  created_at timestamptz default now()
);
alter table public.accountability_rooms enable row level security;
create policy "Rooms are public" on public.accountability_rooms for select using (true);
create policy "Users create own rooms" on public.accountability_rooms for insert with check (auth.uid() = creator_id);
create policy "Creator updates room" on public.accountability_rooms for update using (auth.uid() = creator_id);
create policy "Creator deletes room" on public.accountability_rooms for delete using (auth.uid() = creator_id);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.accountability_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  check_in_count integer default 0,
  completed boolean default false,
  unique(room_id, user_id)
);
alter table public.room_members enable row level security;
create policy "Members are public" on public.room_members for select using (true);
create policy "Users join as themselves" on public.room_members for insert with check (auth.uid() = user_id);
create policy "Users update own membership" on public.room_members for update using (auth.uid() = user_id);
create policy "Users leave own membership" on public.room_members for delete using (auth.uid() = user_id);

create table public.room_checkins (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.accountability_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  day_number integer,
  created_at timestamptz default now()
);
alter table public.room_checkins enable row level security;
create policy "Checkins viewable by everyone" on public.room_checkins for select using (true);
create policy "Users checkin as themselves" on public.room_checkins for insert with check (auth.uid() = user_id);
create policy "Users delete own checkins" on public.room_checkins for delete using (auth.uid() = user_id);

-- =================== TOKENS ===================
create table public.user_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  balance integer default 0,
  total_earned integer default 0,
  total_spent integer default 0,
  updated_at timestamptz default now()
);
alter table public.user_tokens enable row level security;
create policy "Owner reads tokens" on public.user_tokens for select using (auth.uid() = user_id);

create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references public.profiles(id) on delete set null,
  to_user_id uuid references public.profiles(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  amount integer not null,
  type text check (type in ('tip','purchase','withdrawal')),
  status text default 'completed',
  created_at timestamptz default now()
);
alter table public.token_transactions enable row level security;
create policy "Parties read own tx" on public.token_transactions for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "Sender creates tx" on public.token_transactions for insert with check (auth.uid() = from_user_id);

-- =================== NOTIFICATIONS ===================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text check (type in ('new_follower','video_like','tip_received','room_checkin','streak_milestone','new_video')),
  title text not null,
  message text not null,
  is_read boolean default false,
  related_id uuid,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Owner reads notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Owner updates notifications" on public.notifications for update using (auth.uid() = user_id);

-- =================== GOALS ===================
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  categories text[] default '{}',
  updated_at timestamptz default now()
);
alter table public.user_goals enable row level security;
create policy "Owner reads goals" on public.user_goals for select using (auth.uid() = user_id);
create policy "Owner upserts goals" on public.user_goals for insert with check (auth.uid() = user_id);
create policy "Owner updates goals" on public.user_goals for update using (auth.uid() = user_id);

-- =================== NEW USER TRIGGER ===================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uname text;
begin
  uname := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-z0-9_]', '', 'g'));
  if char_length(uname) < 3 then uname := 'user_' || substr(new.id::text, 1, 8); end if;
  -- ensure uniqueness
  while exists(select 1 from public.profiles where username = uname) loop
    uname := uname || floor(random()*1000)::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));

  insert into public.streaks (user_id) values (new.id);
  insert into public.user_tokens (user_id) values (new.id);
  insert into public.user_goals (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =================== COUNTER TRIGGERS ===================
create or replace function public.bump_like_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.videos set like_count = like_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then update public.videos set like_count = greatest(0, like_count - 1) where id = old.video_id; end if;
  return null;
end; $$;
create trigger trg_like_count after insert or delete on public.video_likes for each row execute function public.bump_like_count();

create or replace function public.bump_save_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.videos set save_count = save_count + 1 where id = new.video_id;
  elsif tg_op = 'DELETE' then update public.videos set save_count = greatest(0, save_count - 1) where id = old.video_id; end if;
  return null;
end; $$;
create trigger trg_save_count after insert or delete on public.video_saves for each row execute function public.bump_save_count();

create or replace function public.bump_follow_counts() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set follower_count = greatest(0, follower_count - 1) where id = old.following_id;
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
  end if;
  return null;
end; $$;
create trigger trg_follow_counts after insert or delete on public.follows for each row execute function public.bump_follow_counts();

create or replace function public.bump_room_members() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then update public.accountability_rooms set member_count = member_count + 1 where id = new.room_id;
  elsif tg_op = 'DELETE' then update public.accountability_rooms set member_count = greatest(0, member_count - 1) where id = old.room_id; end if;
  return null;
end; $$;
create trigger trg_room_members after insert or delete on public.room_members for each row execute function public.bump_room_members();

-- =================== STORAGE BUCKETS ===================
insert into storage.buckets (id, name, public) values
  ('videos','videos',true),
  ('thumbnails','thumbnails',true),
  ('avatars','avatars',true)
on conflict (id) do nothing;

create policy "Public read videos" on storage.objects for select using (bucket_id = 'videos');
create policy "Auth upload videos" on storage.objects for insert with check (bucket_id = 'videos' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner delete videos" on storage.objects for delete using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read thumbs" on storage.objects for select using (bucket_id = 'thumbnails');
create policy "Auth upload thumbs" on storage.objects for insert with check (bucket_id = 'thumbnails' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner delete thumbs" on storage.objects for delete using (bucket_id = 'thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Auth upload avatars" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner update avatars" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner delete avatars" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
