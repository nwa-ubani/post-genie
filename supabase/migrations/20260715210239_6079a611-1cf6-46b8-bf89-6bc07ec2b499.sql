ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS posting_schedule jsonb;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS thumb_path text;