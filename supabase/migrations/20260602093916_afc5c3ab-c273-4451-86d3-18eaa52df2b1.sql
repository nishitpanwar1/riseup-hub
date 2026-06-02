CREATE OR REPLACE FUNCTION public.check_in_streak()
RETURNS TABLE(current_streak integer, longest_streak integer, total_watch_days integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  s record;
  today date := (now() at time zone 'utc')::date;
  new_streak int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO s FROM public.streaks WHERE user_id = uid;
  IF NOT FOUND THEN
    INSERT INTO public.streaks(user_id, current_streak, longest_streak, last_watch_date, total_watch_days)
    VALUES (uid, 1, 1, today, 1)
    RETURNING streaks.current_streak, streaks.longest_streak, streaks.total_watch_days
    INTO current_streak, longest_streak, total_watch_days;
    RETURN NEXT;
    RETURN;
  END IF;

  IF s.last_watch_date = today THEN
    current_streak := s.current_streak;
    longest_streak := s.longest_streak;
    total_watch_days := s.total_watch_days;
    RETURN NEXT;
    RETURN;
  END IF;

  IF s.last_watch_date = today - 1 THEN
    new_streak := COALESCE(s.current_streak, 0) + 1;
  ELSE
    new_streak := 1;
  END IF;

  UPDATE public.streaks
  SET current_streak = new_streak,
      longest_streak = GREATEST(COALESCE(s.longest_streak, 0), new_streak),
      last_watch_date = today,
      total_watch_days = COALESCE(s.total_watch_days, 0) + 1,
      updated_at = now()
  WHERE user_id = uid
  RETURNING streaks.current_streak, streaks.longest_streak, streaks.total_watch_days
  INTO current_streak, longest_streak, total_watch_days;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_streak() TO authenticated;