
CREATE TABLE public.focus_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  target_minutes integer NOT NULL DEFAULT 25,
  minutes_done integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_tasks TO authenticated;
GRANT ALL ON public.focus_tasks TO service_role;
ALTER TABLE public.focus_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own focus tasks" ON public.focus_tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_focus_tasks_updated_at BEFORE UPDATE ON public.focus_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intent_date date NOT NULL DEFAULT (now() at time zone 'utc')::date,
  categories text[] NOT NULL DEFAULT '{}',
  minutes_budget integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, intent_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_intent TO authenticated;
GRANT ALL ON public.user_intent TO service_role;
ALTER TABLE public.user_intent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intent" ON public.user_intent FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7 uploads per day limit
CREATE OR REPLACE FUNCTION public.enforce_daily_upload_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_count int;
BEGIN
  SELECT count(*) INTO today_count
  FROM public.videos
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', now() at time zone 'utc');
  IF today_count >= 7 THEN
    RAISE EXCEPTION 'Daily upload limit reached: you can publish 7 videos or shorts per day.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_daily_upload_limit BEFORE INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_upload_limit();

-- token reward for completed focus sessions (max 3/day)
ALTER TABLE public.token_transactions DROP CONSTRAINT IF EXISTS token_transactions_type_check;
ALTER TABLE public.token_transactions ADD CONSTRAINT token_transactions_type_check
  CHECK (type = ANY (ARRAY['tip','purchase','withdrawal','upload_short','upload_long','product_purchase','refund','bonus','admin_grant','focus_task']));

CREATE OR REPLACE FUNCTION public.award_focus_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rewarded_today int;
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.minutes_done < NEW.target_minutes THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO rewarded_today
  FROM public.token_transactions
  WHERE to_user_id = NEW.user_id
    AND type = 'focus_task'
    AND created_at >= date_trunc('day', now() at time zone 'utc');

  IF rewarded_today >= 3 THEN RETURN NEW; END IF;

  INSERT INTO public.user_tokens(user_id) VALUES (NEW.user_id) ON CONFLICT DO NOTHING;
  UPDATE public.user_tokens
    SET balance = COALESCE(balance,0) + 15,
        total_earned = COALESCE(total_earned,0) + 15,
        updated_at = now()
    WHERE user_id = NEW.user_id;

  INSERT INTO public.token_transactions(from_user_id, to_user_id, amount, type, status)
  VALUES (NULL, NEW.user_id, 15, 'focus_task', 'completed');

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_award_focus_tokens AFTER UPDATE ON public.focus_tasks
  FOR EACH ROW EXECUTE FUNCTION public.award_focus_tokens();
