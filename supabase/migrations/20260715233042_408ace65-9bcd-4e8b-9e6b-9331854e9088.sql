
CREATE TABLE public.token_expiry_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold integer NOT NULL,
  token_expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, threshold, token_expires_at)
);

GRANT SELECT ON public.token_expiry_emails TO authenticated;
GRANT ALL ON public.token_expiry_emails TO service_role;

ALTER TABLE public.token_expiry_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expiry email records"
  ON public.token_expiry_emails
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_token_expiry_emails_user ON public.token_expiry_emails(user_id, token_expires_at);
