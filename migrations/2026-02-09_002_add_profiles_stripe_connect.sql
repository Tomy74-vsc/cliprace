-- Stripe Connect: champs sur profiles pour créateurs (stripe_account_id, stripe_details_submitted)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect Express account id (creator payouts)';
COMMENT ON COLUMN public.profiles.stripe_details_submitted IS 'True when Stripe Connect onboarding details have been submitted';
