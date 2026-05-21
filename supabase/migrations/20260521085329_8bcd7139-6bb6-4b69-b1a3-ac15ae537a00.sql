
-- Function search paths
alter function public.bump_like_count() set search_path = public;
alter function public.bump_save_count() set search_path = public;
alter function public.bump_follow_counts() set search_path = public;
alter function public.bump_room_members() set search_path = public;

-- Restrict handle_new_user from being public callable
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Tighten video_views insert: must be self or anonymous null user
drop policy if exists "Anyone can record a view" on public.video_views;
create policy "Record view as self or anon" on public.video_views for insert
  with check (user_id is null or auth.uid() = user_id);

-- Restrict storage object listing: only owner can list their folder
drop policy if exists "Public read videos" on storage.objects;
drop policy if exists "Public read thumbs" on storage.objects;
drop policy if exists "Public read avatars" on storage.objects;

-- Files are still publicly served via the public URL (CDN) since buckets are public,
-- but LIST operations are restricted to the owner's prefix.
create policy "Owner lists own video files" on storage.objects for select
  using (bucket_id = 'videos' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner lists own thumb files" on storage.objects for select
  using (bucket_id = 'thumbnails' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Owner lists own avatar files" on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid() is not null and auth.uid()::text = (storage.foldername(name))[1]);
