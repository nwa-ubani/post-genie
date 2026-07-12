ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS posting_days integer[] DEFAULT NULL;