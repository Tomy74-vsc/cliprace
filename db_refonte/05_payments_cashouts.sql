-- =====================================================
-- 05_payments_cashouts.sql
-- =====================================================
-- Tables de paiements et cashouts (payments_brand, cashouts, webhooks_stripe)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table payments_brand : paiements des marques pour activer les concours
CREATE TABLE IF NOT EXISTS public.payments_brand (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  stripe_customer_id text,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  status payment_status NOT NULL DEFAULT 'requires_payment',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT payments_brand_positive_amount CHECK (amount_cents >= 0)
);

-- Table cashouts : retraits des créateurs via Stripe Connect
CREATE TABLE IF NOT EXISTS public.cashouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  stripe_account_id text,
  stripe_transfer_id text UNIQUE,
  status cashout_status NOT NULL DEFAULT 'requested',
  metadata jsonb DEFAULT '{}'::jsonb,
  requested_at timestamptz DEFAULT NOW() NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT cashouts_positive_amount CHECK (amount_cents >= 0)
);

-- Table webhooks_stripe : événements Stripe bruts pour idempotence
CREATE TABLE IF NOT EXISTS public.webhooks_stripe (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur payments_brand
CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_id ON public.payments_brand(brand_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_contest_id ON public.payments_brand(contest_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_status ON public.payments_brand(status);
CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_status ON public.payments_brand(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_brand_stripe_session ON public.payments_brand(stripe_checkout_session_id);

-- Index sur cashouts
CREATE INDEX IF NOT EXISTS idx_cashouts_creator_id ON public.cashouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_cashouts_status ON public.cashouts(status);
CREATE INDEX IF NOT EXISTS idx_cashouts_creator_status ON public.cashouts(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_cashouts_stripe_transfer ON public.cashouts(stripe_transfer_id);

-- Index sur webhooks_stripe
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_event_id ON public.webhooks_stripe(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_processed ON public.webhooks_stripe(processed);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_event_type ON public.webhooks_stripe(event_type);
-- GIN jsonb
CREATE INDEX IF NOT EXISTS idx_payments_brand_metadata_gin ON public.payments_brand USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_cashouts_metadata_gin ON public.cashouts USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_payload_gin ON public.webhooks_stripe USING gin (payload jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.payments_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_stripe ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.payments_brand IS 'Paiements des marques pour activer les concours (Stripe Checkout)';
COMMENT ON TABLE public.cashouts IS 'Retraits des créateurs via Stripe Connect';
COMMENT ON TABLE public.webhooks_stripe IS 'Événements Stripe bruts pour idempotence et audit';
COMMENT ON COLUMN public.payments_brand.stripe_checkout_session_id IS 'ID de session Stripe Checkout (unique)';
COMMENT ON COLUMN public.payments_brand.stripe_payment_intent_id IS 'ID de PaymentIntent Stripe (unique)';
COMMENT ON COLUMN public.cashouts.stripe_transfer_id IS 'ID du transfer Stripe Connect (unique)';
COMMENT ON COLUMN public.webhooks_stripe.stripe_event_id IS 'ID d''événement Stripe (unique pour idempotence)';
