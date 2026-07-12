DROP POLICY IF EXISTS "own push subs" ON public.push_subscriptions;
CREATE POLICY "own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS push_subscriptions_touch_updated ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_touch_updated
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_post_published BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_post_failed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_token_expiring BOOLEAN NOT NULL DEFAULT true;