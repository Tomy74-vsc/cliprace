ALTER TABLE public.metrics_daily 
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS confidence numeric(3,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS formula_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weights_snapshot jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collected_at timestamptz DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS collected_by text DEFAULT NULL;

ALTER TABLE public.metrics_daily
  ADD CONSTRAINT metrics_daily_confidence_range 
  CHECK (confidence >= 0 AND confidence <= 1);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_method 
  ON public.metrics_daily(method);

COMMENT ON COLUMN public.metrics_daily.method IS 
  'Source: youtube_api | platform_oauth | scrape | manual_override | unknown';
COMMENT ON COLUMN public.metrics_daily.confidence IS 
  '0.0-1.0 — API officielle >= 0.9, scrape <= 0.6';
COMMENT ON COLUMN public.metrics_daily.formula_version IS 
  'Version de la formule weighted_score';
COMMENT ON COLUMN public.metrics_daily.weights_snapshot IS 
  'Snapshot des poids au moment du calcul';

