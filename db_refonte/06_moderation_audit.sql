-- =====================================================
-- 06_moderation_audit.sql
-- =====================================================
-- Tables de modération et audit (moderation_queue, moderation_rules, audit_logs)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table moderation_queue : queue de modération pour les soumissions
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table moderation_rules : règles de modération configurables
CREATE TABLE IF NOT EXISTS public.moderation_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  rule_type text NOT NULL CHECK (rule_type IN ('content', 'spam', 'duplicate', 'domain', 'flood')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table audit_logs : logs d'audit de toutes les actions sensibles
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  row_pk uuid,
  old_values jsonb,
  new_values jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur moderation_queue
CREATE INDEX IF NOT EXISTS idx_moderation_queue_submission_id ON public.moderation_queue(submission_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON public.moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_reviewed_by ON public.moderation_queue(reviewed_by);

-- Index sur moderation_rules
CREATE INDEX IF NOT EXISTS idx_moderation_rules_rule_type ON public.moderation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_is_active ON public.moderation_rules(is_active);

-- Index sur audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_row_pk ON public.audit_logs(row_pk);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
-- GIN pour recherche sur JSONB
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values_gin ON public.audit_logs USING gin (old_values jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin ON public.audit_logs USING gin (new_values jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.moderation_queue IS 'Queue de modération pour les soumissions nécessitant une révision';
COMMENT ON TABLE public.moderation_rules IS 'Règles de modération configurables (auto-modération)';
COMMENT ON TABLE public.audit_logs IS 'Logs d''audit de toutes les actions sensibles (CRUD sur données critiques)';
COMMENT ON COLUMN public.audit_logs.table_name IS 'Nom de la table concernée';
COMMENT ON COLUMN public.audit_logs.row_pk IS 'Clé primaire de la ligne modifiée';
COMMENT ON COLUMN public.audit_logs.old_values IS 'Anciennes valeurs (JSONB)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'Nouvelles valeurs (JSONB)';
