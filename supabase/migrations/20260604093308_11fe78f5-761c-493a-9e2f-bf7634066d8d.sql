DROP TRIGGER IF EXISTS video_likes_bump_count ON public.video_likes;
DROP TRIGGER IF EXISTS video_saves_bump_count ON public.video_saves;
DROP TRIGGER IF EXISTS video_views_bump_count ON public.video_views;
DROP TRIGGER IF EXISTS video_comments_bump_count ON public.video_comments;
DROP TRIGGER IF EXISTS follows_bump_counts ON public.follows;
DROP TRIGGER IF EXISTS video_likes_notify ON public.video_likes;
DROP TRIGGER IF EXISTS follows_notify ON public.follows;
DROP TRIGGER IF EXISTS video_comments_notify ON public.video_comments;