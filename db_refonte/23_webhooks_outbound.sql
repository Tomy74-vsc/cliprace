-- =====================================================
-- 23_webhooks_outbound.sql
-- =====================================================
-- Intégrations sortantes (webhooks)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table webhook_endpoints : endpoints de webhook configurés par les organisations
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  secret text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table webhook_deliveries : livraisons de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id bigserial PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  retry_count integer DEFAULT 0 NOT NULL,
  last_error text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur webhook_endpoints
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_id ON public.webhook_endpoints(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON public.webhook_endpoints(active) WHERE active = true;

-- Index sur webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created ON public.webhook_deliveries(endpoint_id, created_at DESC);
-- GIN jsonb sur payload
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_payload_gin ON public.webhook_deliveries USING gin (payload jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.webhook_endpoints IS 'Endpoints de webhook configurés par les organisations';
COMMENT ON TABLE public.webhook_deliveries IS 'Historique des livraisons de webhooks';
COMMENT ON COLUMN public.webhook_endpoints.secret IS 'Secret pour signer les webhooks (HMAC)';
COMMENT ON COLUMN public.webhook_endpoints.active IS 'Endpoint actif ou désactivé';
COMMENT ON COLUMN public.webhook_deliveries.event IS 'Type d''événement (ex: submission.approved, contest.ended)';
COMMENT ON COLUMN public.webhook_deliveries.payload IS 'Payload JSON envoyé au webhook';
COMMENT ON COLUMN public.webhook_deliveries.status IS 'Statut de livraison: pending, success, failed';
COMMENT ON COLUMN public.webhook_deliveries.retry_count IS 'Nombre de tentatives de livraison';
