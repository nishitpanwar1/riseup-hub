ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS captions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS captions_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS remix_of uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audio_source_id uuid REFERENCES public.videos(id) ON DELETE SET NULL;

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_captions_status_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_captions_status_check
  CHECK (captions_status IN ('none','pending','ready','failed'));

CREATE INDEX IF NOT EXISTS videos_audio_source_idx ON public.videos(audio_source_id) WHERE audio_source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS videos_remix_of_idx ON public.videos(remix_of) WHERE remix_of IS NOT NULL;