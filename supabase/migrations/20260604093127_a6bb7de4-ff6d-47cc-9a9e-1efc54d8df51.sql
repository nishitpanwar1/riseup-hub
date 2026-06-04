ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['like','comment','video','follow','subscription','room','streak','tip','mention','system']));

DROP TRIGGER IF EXISTS video_likes_bump_count ON public.video_likes;
CREATE TRIGGER video_likes_bump_count
AFTER INSERT OR DELETE ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

DROP TRIGGER IF EXISTS video_saves_bump_count ON public.video_saves;
CREATE TRIGGER video_saves_bump_count
AFTER INSERT OR DELETE ON public.video_saves
FOR EACH ROW EXECUTE FUNCTION public.bump_save_count();

DROP TRIGGER IF EXISTS video_views_bump_count ON public.video_views;
CREATE TRIGGER video_views_bump_count
AFTER INSERT ON public.video_views
FOR EACH ROW EXECUTE FUNCTION public.bump_view_count();

DROP TRIGGER IF EXISTS video_comments_bump_count ON public.video_comments;
CREATE TRIGGER video_comments_bump_count
AFTER INSERT OR DELETE ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_comment_count();

DROP TRIGGER IF EXISTS follows_bump_counts ON public.follows;
CREATE TRIGGER follows_bump_counts
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.bump_follow_counts();

DROP TRIGGER IF EXISTS video_likes_notify ON public.video_likes;
CREATE TRIGGER video_likes_notify
AFTER INSERT ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

DROP TRIGGER IF EXISTS follows_notify ON public.follows;
CREATE TRIGGER follows_notify
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

DROP TRIGGER IF EXISTS video_comments_notify ON public.video_comments;
CREATE TRIGGER video_comments_notify
AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();