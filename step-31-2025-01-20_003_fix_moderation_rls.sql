-- =====================================================
-- Migration: 2025-01-20_003_fix_moderation_rls.sql
-- Description: Activer RLS sur les tables de modération et corriger les politiques
-- =====================================================

-- =====================================================
-- ACTIVATION RLS SUR MODERATION_QUEUE
-- =====================================================

-- Vérifier et activer RLS sur moderation_queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'moderation_queue' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS activé sur moderation_queue';
    ELSE
        RAISE NOTICE 'RLS déjà activé sur moderation_queue';
    END IF;
END $$;

-- =====================================================
-- ACTIVATION RLS SUR MODERATION_RULES
-- =====================================================

-- Vérifier et activer RLS sur moderation_rules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'moderation_rules' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE moderation_rules ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS activé sur moderation_rules';
    ELSE
        RAISE NOTICE 'RLS déjà activé sur moderation_rules';
    END IF;
END $$;

-- =====================================================
-- POLITIQUES POUR MODERATION_QUEUE
-- =====================================================

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Admins can view moderation queue" ON moderation_queue;
DROP POLICY IF EXISTS "Admins can manage moderation queue" ON moderation_queue;
DROP POLICY IF EXISTS "Brands can view their contest queue" ON moderation_queue;

-- Admins peuvent voir toutes les entrées de la queue
CREATE POLICY "Admins can view moderation queue" ON moderation_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Admins peuvent modifier la queue
CREATE POLICY "Admins can manage moderation queue" ON moderation_queue
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Brands peuvent voir les entrées de leurs contests
CREATE POLICY "Brands can view their contest queue" ON moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN contests c ON s.contest_id = c.id
      WHERE s.id = moderation_queue.submission_id
      AND c.brand_id = auth.uid()
    )
  );

-- =====================================================
-- POLITIQUES POUR MODERATION_RULES
-- =====================================================

-- Supprimer les politiques existantes si elles existent
DROP POLICY IF EXISTS "Admins can view moderation rules" ON moderation_rules;
DROP POLICY IF EXISTS "Admins can manage moderation rules" ON moderation_rules;

-- Admins peuvent voir toutes les règles
CREATE POLICY "Admins can view moderation rules" ON moderation_rules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- Admins peuvent gérer les règles
CREATE POLICY "Admins can manage moderation rules" ON moderation_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- =====================================================
-- FONCTION RPC POUR AUDIT_LOGS (SERVICE-ROLE)
-- =====================================================

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS insert_audit_log(UUID, TEXT, TEXT, UUID, JSONB, INET, TEXT);

-- Fonction RPC sécurisée pour insérer dans audit_logs
CREATE OR REPLACE FUNCTION insert_audit_log(
  p_actor_id UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Vérifier que l'utilisateur a le droit d'insérer (admin ou service-role)
  IF NOT (
    EXISTS (SELECT 1 FROM admins WHERE user_id = p_actor_id) OR
    current_setting('role') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or service-role can insert audit logs';
  END IF;

  -- Insérer le log
  INSERT INTO audit_logs (
    actor_id, action, entity, entity_id, data, ip_address, user_agent
  ) VALUES (
    p_actor_id, p_action, p_entity, p_entity_id, p_data, p_ip_address, p_user_agent
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Donner les permissions d'exécution
GRANT EXECUTE ON FUNCTION insert_audit_log TO authenticated, service_role;

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE moderation_queue IS 'Queue de modération avec RLS activé';
COMMENT ON TABLE moderation_rules IS 'Règles de modération avec RLS activé';
COMMENT ON FUNCTION insert_audit_log IS 'Fonction sécurisée pour insérer des logs d''audit';
