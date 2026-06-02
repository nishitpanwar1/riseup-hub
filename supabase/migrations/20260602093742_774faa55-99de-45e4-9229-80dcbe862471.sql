ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.video_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are public" ON public.video_comments;
CREATE POLICY "Comments are public"
ON public.video_comments
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users comment as themselves" ON public.video_comments;
CREATE POLICY "Users comment as themselves"
ON public.video_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users edit own comments" ON public.video_comments;
CREATE POLICY "Users edit own comments"
ON public.video_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own comments" ON public.video_comments;
CREATE POLICY "Users delete own comments"
ON public.video_comments
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_comments_video_created ON public.video_comments(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_views_video_created ON public.video_views(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_user_created ON public.videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_video_comments_updated_at ON public.video_comments;
CREATE TRIGGER trg_video_comments_updated_at
BEFORE UPDATE ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.bump_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET like_count = COALESCE(like_count, 0) + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET like_count = GREATEST(0, COALESCE(like_count, 0) - 1) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_save_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET save_count = COALESCE(save_count, 0) + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET save_count = GREATEST(0, COALESCE(save_count, 0) - 1) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET follower_count = COALESCE(follower_count, 0) + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count, 0) + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET follower_count = GREATEST(0, COALESCE(follower_count, 0) - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_room_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.accountability_rooms SET member_count = COALESCE(member_count, 0) + 1 WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.accountability_rooms SET member_count = GREATEST(0, COALESCE(member_count, 0) - 1) WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comment_count = GREATEST(0, COALESCE(comment_count, 0) - 1) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner_id uuid;
BEGIN
  UPDATE public.videos
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = NEW.video_id
  RETURNING user_id INTO owner_id;

  IF owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_views = COALESCE(total_views, 0) + 1
    WHERE id = owner_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_count ON public.video_likes;
CREATE TRIGGER trg_like_count AFTER INSERT OR DELETE ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

DROP TRIGGER IF EXISTS trg_save_count ON public.video_saves;
CREATE TRIGGER trg_save_count AFTER INSERT OR DELETE ON public.video_saves
FOR EACH ROW EXECUTE FUNCTION public.bump_save_count();

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.bump_follow_counts();

DROP TRIGGER IF EXISTS trg_room_members ON public.room_members;
CREATE TRIGGER trg_room_members AFTER INSERT OR DELETE ON public.room_members
FOR EACH ROW EXECUTE FUNCTION public.bump_room_members();

DROP TRIGGER IF EXISTS trg_comment_count ON public.video_comments;
CREATE TRIGGER trg_comment_count AFTER INSERT OR DELETE ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_comment_count();

DROP TRIGGER IF EXISTS trg_view_count ON public.video_views;
CREATE TRIGGER trg_view_count AFTER INSERT ON public.video_views
FOR EACH ROW EXECUTE FUNCTION public.bump_view_count();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner uuid;
  vtitle text;
  cname text;
BEGIN
  SELECT user_id, title INTO owner, vtitle FROM public.videos WHERE id = NEW.video_id;
  IF owner IS NULL OR owner = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username) INTO cname FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, title, message, related_id)
  VALUES (owner, 'comment', 'New comment', COALESCE(cname, 'Someone') || ' commented on ' || COALESCE(vtitle, 'your video'), NEW.video_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.video_comments;
CREATE TRIGGER trg_notify_on_comment AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['videos','profiles','follows','video_likes','video_saves','video_views','video_comments','accountability_rooms','room_members','room_checkins','notifications']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;