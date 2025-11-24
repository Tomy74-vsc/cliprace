-- =====================================================
-- 21_moderation_history.sql
-- =====================================================
-- Historique des décisions de modération
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table moderation_actions : historique des actions de modération
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id bigserial PRIMARY KEY,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'remove')),
  reason text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur moderation_actions
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON public.moderation_actions(target_table, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_actor_id ON public.moderation_actions(actor_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_action ON public.moderation_actions(action);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);

-- Enable RLS
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.moderation_actions IS 'Historique des actions de modération (approve, reject, remove)';
COMMENT ON COLUMN public.moderation_actions.target_table IS 'Nom de la table cible (ex: submissions, assets)';
COMMENT ON COLUMN public.moderation_actions.target_id IS 'ID de la ligne cible';
COMMENT ON COLUMN public.moderation_actions.action IS 'Action effectuée: approve, reject, remove';
COMMENT ON COLUMN public.moderation_actions.reason IS 'Raison de l''action (obligatoire pour reject/remove)';
COMMENT ON COLUMN public.moderation_actions.actor_id IS 'Utilisateur ayant effectué l''action (NULL = système)';
