
-- Profiles
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  company TEXT,
  industry TEXT,
  description TEXT,
  twitter_handle TEXT,
  linkedin_company_url TEXT,
  tone TEXT,
  admired_brands TEXT[] DEFAULT '{}',
  content_topics TEXT[] DEFAULT '{}',
  posting_time TIME DEFAULT '09:00',
  timezone TEXT DEFAULT 'UTC',
  post_targets TEXT[] DEFAULT ARRAY['personal'],
  active BOOLEAN NOT NULL DEFAULT false,
  make_webhook_url TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- LinkedIn tokens
CREATE TABLE public.linkedin_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  linkedin_member_urn TEXT,
  linkedin_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_tokens TO authenticated;
GRANT ALL ON public.linkedin_tokens TO service_role;
ALTER TABLE public.linkedin_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens" ON public.linkedin_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Photos
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX photos_user_idx ON public.photos(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own photos" ON public.photos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Posts
CREATE TYPE public.post_type AS ENUM ('brand', 'personal');
CREATE TYPE public.post_status AS ENUM ('pending', 'published', 'failed', 'draft');

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type public.post_type NOT NULL,
  content TEXT NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL,
  serper_data JSONB,
  keyword_hook TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status public.post_status NOT NULL DEFAULT 'draft',
  error TEXT,
  linkedin_post_urn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_user_idx ON public.posts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own posts" ON public.posts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Search cache
CREATE TABLE public.search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX search_cache_user_idx ON public.search_cache(user_id, fetched_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_cache TO authenticated;
GRANT ALL ON public.search_cache TO service_role;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cache" ON public.search_cache FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Roles (separate table per security guidance)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER linkedin_tokens_touch BEFORE UPDATE ON public.linkedin_tokens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
