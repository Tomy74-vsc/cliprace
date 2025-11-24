-- =====================================================
-- 38_rate_limits.sql
-- =====================================================
-- Journal des hits pour rate limiting (persistant)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  route text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_route ON public.rate_limits(key, route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits_service_only" ON public.rate_limits;
CREATE POLICY "rate_limits_service_only" ON public.rate_limits
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.rate_limits IS 'Enregistrements de rate limiting côté serveur (purge via expires_at).';
