-- =====================================================
-- 24_event_log.sql
-- =====================================================
-- Journal produit minimal (event tracking)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table event_log : journal d'événements produit
CREATE TABLE IF NOT EXISTS public.event_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur event_log
CREATE INDEX IF NOT EXISTS idx_event_log_user_id ON public.event_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_org_id ON public.event_log(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_event_name ON public.event_log(event_name);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON public.event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_org_created ON public.event_log(org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_user_created ON public.event_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
-- GIN jsonb sur properties
CREATE INDEX IF NOT EXISTS idx_event_log_properties_gin ON public.event_log USING gin (properties jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.event_log IS 'Journal d''événements produit (tracking analytics)';
COMMENT ON COLUMN public.event_log.user_id IS 'Utilisateur concerné (nullable si événement org)';
COMMENT ON COLUMN public.event_log.org_id IS 'Organisation concernée (nullable si événement utilisateur)';
COMMENT ON COLUMN public.event_log.event_name IS 'Nom de l''événement (ex: submission.created, contest.viewed)';
COMMENT ON COLUMN public.event_log.properties IS 'Propriétés additionnelles de l''événement (JSONB)';

-- Note : Au moins user_id ou org_id doit être défini (mais on ne met pas de contrainte CHECK pour flexibilité)
