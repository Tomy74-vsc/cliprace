-- =====================================================
-- 29_status_history.sql
-- =====================================================
-- Historique des changements de statut (traçabilité complète)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table status_history : historique des changements de statut
CREATE TABLE IF NOT EXISTS public.status_history (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL, -- 'contests', 'submissions', 'payments_brand', etc.
  row_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur status_history
CREATE INDEX IF NOT EXISTS idx_status_history_table_row ON public.status_history(table_name, row_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON public.status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_history_new_status ON public.status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.status_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.status_history IS 'Historique complet des changements de statut pour toutes les entités';
COMMENT ON COLUMN public.status_history.table_name IS 'Nom de la table concernée (ex: "contests", "submissions")';
COMMENT ON COLUMN public.status_history.row_id IS 'ID de la ligne concernée';
COMMENT ON COLUMN public.status_history.old_status IS 'Ancien statut';
COMMENT ON COLUMN public.status_history.new_status IS 'Nouveau statut';
COMMENT ON COLUMN public.status_history.changed_by IS 'Utilisateur ayant effectué le changement (NULL = système)';
COMMENT ON COLUMN public.status_history.reason IS 'Raison du changement (obligatoire pour certains statuts)';
COMMENT ON COLUMN public.status_history.metadata IS 'Métadonnées additionnelles (JSONB)';
