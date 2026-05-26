
-- ============ STREAK CHECK-IN RPC ============
create or replace function public.check_in_streak()
returns table(current_streak int, longest_streak int, total_watch_days int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s record;
  today date := (now() at time zone 'utc')::date;
  new_streak int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into s from public.streaks where user_id = uid;
  if not found then
    insert into public.streaks(user_id, current_streak, longest_streak, last_watch_date, total_watch_days)
    values (uid, 1, 1, today, 1)
    returning streaks.current_streak, streaks.longest_streak, streaks.total_watch_days
    into current_streak, longest_streak, total_watch_days;
    return next; return;
  end if;

  if s.last_watch_date = today then
    current_streak := s.current_streak;
    longest_streak := s.longest_streak;
    total_watch_days := s.total_watch_days;
    return next; return;
  end if;

  if s.last_watch_date = today - 1 then
    new_streak := coalesce(s.current_streak,0) + 1;
  else
    new_streak := 1;
  end if;

  update public.streaks
  set current_streak = new_streak,
      longest_streak = greatest(coalesce(s.longest_streak,0), new_streak),
      last_watch_date = today,
      total_watch_days = coalesce(s.total_watch_days,0) + 1,
      updated_at = now()
  where user_id = uid
  returning streaks.current_streak, streaks.longest_streak, streaks.total_watch_days
  into current_streak, longest_streak, total_watch_days;
  return next;
end; $$;

grant execute on function public.check_in_streak() to authenticated;

-- ============ NOTIFICATION TRIGGERS ============
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fname text;
begin
  select coalesce(display_name, username) into fname from public.profiles where id = new.follower_id;
  insert into public.notifications(user_id, type, title, message, related_id)
  values (new.following_id, 'follow', 'New follower', coalesce(fname,'Someone') || ' started following you', new.follower_id);
  return new;
end; $$;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow after insert on public.follows
for each row execute function public.notify_on_follow();

create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; vtitle text; lname text;
begin
  select user_id, title into owner, vtitle from public.videos where id = new.video_id;
  if owner is null or owner = new.user_id then return new; end if;
  select coalesce(display_name, username) into lname from public.profiles where id = new.user_id;
  insert into public.notifications(user_id, type, title, message, related_id)
  values (owner, 'like', 'New like', coalesce(lname,'Someone') || ' liked your video — ' || coalesce(vtitle,''), new.video_id);
  return new;
end; $$;

drop trigger if exists trg_notify_on_like on public.video_likes;
create trigger trg_notify_on_like after insert on public.video_likes
for each row execute function public.notify_on_like();

create or replace function public.notify_on_room_checkin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; rtitle text; pname text;
begin
  select creator_id, title into owner, rtitle from public.accountability_rooms where id = new.room_id;
  if owner is null or owner = new.user_id then return new; end if;
  select coalesce(display_name, username) into pname from public.profiles where id = new.user_id;
  insert into public.notifications(user_id, type, title, message, related_id)
  values (owner, 'room', 'Room check-in', coalesce(pname,'Someone') || ' checked in to ' || coalesce(rtitle,'your room') || ' — Day ' || coalesce(new.day_number,0)::text, new.room_id);
  return new;
end; $$;

drop trigger if exists trg_notify_on_room_checkin on public.room_checkins;
create trigger trg_notify_on_room_checkin after insert on public.room_checkins
for each row execute function public.notify_on_room_checkin();

-- enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
