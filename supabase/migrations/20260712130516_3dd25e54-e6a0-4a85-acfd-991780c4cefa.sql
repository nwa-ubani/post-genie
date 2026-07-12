ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_instructions text,
  ADD COLUMN IF NOT EXISTS writing_samples text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS role_model_urls text[] DEFAULT '{}'::text[];