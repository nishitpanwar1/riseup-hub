-- Delete all video content and engagement
DELETE FROM public.video_comments;
DELETE FROM public.video_likes;
DELETE FROM public.video_saves;
DELETE FROM public.video_views;
DELETE FROM public.videos;