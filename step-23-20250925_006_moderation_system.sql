-- =====================================================
-- Migration: 20250925_006_moderation_system.sql
-- Description: Système de modération et anti-spam pour les submissions
-- =====================================================

-- =====================================================
-- ÉTENDRE LES STATUTS DE SUBMISSION
-- =====================================================

-- Ajouter les nouveaux statuts de modération
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'pending_automod';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'payout_pending';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'paid';

-- =====================================================
-- TABLE AUDIT_LOGS POUR MODÉRATION
-- =====================================================

-- Note: audit_logs table already exists in 2025-08-20_002_security_admins.sql
-- We only need to add the missing columns if they don't exist
DO $$ 
BEGIN
    -- Add missing columns to existing audit_logs table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE audit_logs ADD COLUMN ip_address INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_agent') THEN
        ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
    END IF;
    
    -- Make actor_id NOT NULL if it's currently nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'actor_id' AND is_nullable = 'YES') THEN
        -- First, update any NULL values to the system user
        UPDATE audit_logs SET actor_id = '00000000-0000-0000-0000-000000000000'::UUID WHERE actor_id IS NULL;
        -- Then make the column NOT NULL
        ALTER TABLE audit_logs ALTER COLUMN actor_id SET NOT NULL;
    END IF;
END $$;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- TABLE MODERATION_QUEUE
-- =====================================================

CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  automod_result JSONB DEFAULT '{}',
  human_review_required BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=urgent
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index pour la queue de modération
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_priority ON moderation_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_assigned ON moderation_queue(assigned_to);

-- =====================================================
-- TABLE MODERATION_RULES
-- =====================================================

CREATE TABLE IF NOT EXISTS moderation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL, -- duplicate, domain, duration, flood, content
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Créer un utilisateur système pour les règles par défaut
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change, last_sign_in_at, confirmation_sent_at, recovery_sent_at, email_change_sent_at, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
VALUES (
  '00000000-0000-0000-0000-000000000000'::UUID,
  'system@cliprace.com',
  '$2a$10$dummy.hash.for.system.user',
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "system", "providers": ["system"]}',
  '{"name": "System User"}',
  true,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  NOW(),
  NOW(),
  '',
  NOW(),
  false,
  NULL,
  false
) ON CONFLICT (id) DO NOTHING;

-- Règles par défaut
INSERT INTO moderation_rules (name, description, rule_type, config, created_by) VALUES
('Duplicate Detection', 'Detect duplicate submissions within same contest', 'duplicate', '{"enabled": true, "timeframe_hours": 24}', COALESCE((SELECT id FROM auth.users WHERE email = 'admin@cliprace.com' LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID)),
('Domain Validation', 'Validate video URLs are from allowed platforms', 'domain', '{"enabled": true, "allowed_domains": ["youtube.com", "youtu.be", "tiktok.com", "vm.tiktok.com", "instagram.com"]}', COALESCE((SELECT id FROM auth.users WHERE email = 'admin@cliprace.com' LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID)),
('Duration Check', 'Check video duration meets minimum requirements', 'duration', '{"enabled": true, "min_duration_seconds": 10}', COALESCE((SELECT id FROM auth.users WHERE email = 'admin@cliprace.com' LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID)),
('Flood Detection', 'Detect rapid successive submissions from same user', 'flood', '{"enabled": true, "timeframe_minutes": 1, "max_submissions": 3}', COALESCE((SELECT id FROM auth.users WHERE email = 'admin@cliprace.com' LIMIT 1), '00000000-0000-0000-0000-000000000000'::UUID));

-- =====================================================
-- FONCTIONS DE MODÉRATION AUTOMATIQUE
-- =====================================================

-- Fonction pour détecter les doublons
CREATE OR REPLACE FUNCTION check_duplicate_submission(
  p_contest_id UUID,
  p_platform_video_id TEXT,
  p_network TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM submissions
  WHERE contest_id = p_contest_id
    AND platform_video_id = p_platform_video_id
    AND network = p_network
    AND status NOT IN ('rejected', 'deleted');
    
  RETURN duplicate_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour valider le domaine
CREATE OR REPLACE FUNCTION validate_video_domain(p_video_url TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  allowed_domains TEXT[] := ARRAY['youtube.com', 'youtu.be', 'tiktok.com', 'vm.tiktok.com', 'instagram.com'];
  domain TEXT;
BEGIN
  -- Extraire le domaine de l'URL
  SELECT split_part(split_part(p_video_url, '://', 2), '/', 1) INTO domain;
  
  -- Vérifier si le domaine est dans la liste autorisée
  RETURN domain = ANY(allowed_domains);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour détecter le flood
CREATE OR REPLACE FUNCTION check_flood_submission(
  p_creator_id UUID,
  p_timeframe_minutes INTEGER DEFAULT 1,
  p_max_submissions INTEGER DEFAULT 3
)
RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO recent_count
  FROM submissions
  WHERE creator_id = p_creator_id
    AND created_at > NOW() - INTERVAL '1 minute' * p_timeframe_minutes;
    
  RETURN recent_count >= p_max_submissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction principale de modération automatique
CREATE OR REPLACE FUNCTION process_automod_submission(p_submission_id UUID)
RETURNS JSONB AS $$
DECLARE
  submission_record RECORD;
  automod_result JSONB := '{}';
  violations TEXT[] := ARRAY[]::TEXT[];
  should_approve BOOLEAN := TRUE;
  should_human_review BOOLEAN := FALSE;
BEGIN
  -- Récupérer les données de la submission
  SELECT * INTO submission_record
  FROM submissions
  WHERE id = p_submission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;
  
  -- Vérification 1: Doublons
  IF check_duplicate_submission(submission_record.contest_id, submission_record.platform_video_id, submission_record.network) THEN
    violations := array_append(violations, 'duplicate');
    should_approve := FALSE;
  END IF;
  
  -- Vérification 2: Domaine autorisé
  IF NOT validate_video_domain(submission_record.video_url) THEN
    violations := array_append(violations, 'invalid_domain');
    should_approve := FALSE;
  END IF;
  
  -- Vérification 3: Flood detection
  IF check_flood_submission(submission_record.creator_id) THEN
    violations := array_append(violations, 'flood');
    should_human_review := TRUE;
  END IF;
  
  -- Construire le résultat
  automod_result := jsonb_build_object(
    'violations', violations,
    'should_approve', should_approve,
    'should_human_review', should_human_review,
    'processed_at', NOW()
  );
  
  -- Mettre à jour le statut de la submission
  IF should_approve AND NOT should_human_review THEN
    UPDATE submissions 
    SET status = 'approved',
        moderated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_id;
  ELSIF should_human_review THEN
    UPDATE submissions 
    SET status = 'pending_review',
        updated_at = NOW()
    WHERE id = p_submission_id;
  ELSE
    UPDATE submissions 
    SET status = 'rejected',
        reason = 'Automod violations: ' || array_to_string(violations, ', '),
        moderated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_id;
  END IF;
  
  -- Ajouter à la queue de modération si nécessaire
  IF should_human_review THEN
    INSERT INTO moderation_queue (submission_id, automod_result, human_review_required)
    VALUES (p_submission_id, automod_result, TRUE);
  END IF;
  
  -- Logger l'action
  INSERT INTO audit_logs (actor_id, action, entity, entity_id, data)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID, -- System user
    'submission_automod',
    'submissions',
    p_submission_id,
    automod_result
  );
  
  RETURN automod_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS POUR AUTOMOD
-- =====================================================

-- Trigger pour déclencher l'automod lors de la création d'une submission
CREATE OR REPLACE FUNCTION trigger_automod_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Marquer comme pending_automod
  auth.uid() := 'pending_automod';
  
  -- Ajouter à la queue de modération
  INSERT INTO moderation_queue (submission_id, status)
  VALUES (auth.uid(), 'pending');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS submissions_automod_trigger ON submissions;
CREATE TRIGGER submissions_automod_trigger
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automod_submission();

-- =====================================================
-- FONCTIONS POUR MODÉRATION HUMAINE
-- =====================================================

-- Fonction pour approuver une submission
CREATE OR REPLACE FUNCTION approve_submission(
  p_submission_id UUID,
  p_moderator_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  submission_record RECORD;
BEGIN
  -- Récupérer les détails de la submission
  SELECT creator_id, contest_id INTO submission_record
  FROM submissions
  WHERE id = p_submission_id
    AND status IN ('pending_review', 'pending_automod');
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE submissions
  SET status = 'approved',
      moderated_at = NOW(),
      moderated_by = p_moderator_id,
      reason = COALESCE(p_comment, 'Approved by moderator'),
      updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Logger l'action
  INSERT INTO audit_logs (actor_id, action, entity, entity_id, data)
  VALUES (
    p_moderator_id,
    'submission_approve',
    'submissions',
    p_submission_id,
    jsonb_build_object('comment', p_comment, 'approved_at', NOW())
  );
  
  -- Marquer comme complété dans la queue
  UPDATE moderation_queue
  SET status = 'completed',
      updated_at = NOW()
  WHERE submission_id = p_submission_id;
  
  -- Créer une notification pour le créateur
  INSERT INTO notifications (user_id, type, payload)
  VALUES (
    submission_record.creator_id,
    'moderation',
    jsonb_build_object(
      'title', '🎉 Votre soumission a été approuvée !',
      'message', 'Votre vidéo a été approuvée et est maintenant éligible pour les prix.',
      'submission_id', p_submission_id,
      'action', 'approved',
      'comment', p_comment,
      'moderator_id', p_moderator_id
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour rejeter une submission
CREATE OR REPLACE FUNCTION reject_submission(
  p_submission_id UUID,
  p_moderator_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  submission_record RECORD;
BEGIN
  -- Récupérer les détails de la submission
  SELECT creator_id, contest_id INTO submission_record
  FROM submissions
  WHERE id = p_submission_id
    AND status IN ('pending_review', 'pending_automod');
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE submissions
  SET status = 'rejected',
      moderated_at = NOW(),
      moderated_by = p_moderator_id,
      reason = p_reason,
      updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Logger l'action
  INSERT INTO audit_logs (actor_id, action, entity, entity_id, data)
  VALUES (
    p_moderator_id,
    'submission_reject',
    'submissions',
    p_submission_id,
    jsonb_build_object('reason', p_reason, 'rejected_at', NOW())
  );
  
  -- Marquer comme complété dans la queue
  UPDATE moderation_queue
  SET status = 'completed',
      updated_at = NOW()
  WHERE submission_id = p_submission_id;
  
  -- Créer une notification pour le créateur
  INSERT INTO notifications (user_id, type, payload)
  VALUES (
    submission_record.creator_id,
    'moderation',
    jsonb_build_object(
      'title', '❌ Votre soumission a été rejetée',
      'message', 'Votre vidéo a été rejetée. Raison : ' || p_reason,
      'submission_id', p_submission_id,
      'action', 'rejected',
      'reason', p_reason,
      'moderator_id', p_moderator_id
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Logs d''audit pour toutes les actions de modération';
COMMENT ON TABLE moderation_queue IS 'Queue de modération pour les submissions nécessitant une révision';
COMMENT ON TABLE moderation_rules IS 'Règles de modération configurables';

COMMENT ON FUNCTION check_duplicate_submission IS 'Détecte les soumissions en doublon';
COMMENT ON FUNCTION validate_video_domain IS 'Valide que l''URL vidéo provient d''un domaine autorisé';
COMMENT ON FUNCTION check_flood_submission IS 'Détecte les soumissions en flood';
COMMENT ON FUNCTION process_automod_submission IS 'Traite la modération automatique d''une soumission';
COMMENT ON FUNCTION approve_submission IS 'Approuve une soumission (modération humaine)';
COMMENT ON FUNCTION reject_submission IS 'Rejette une soumission (modération humaine)';
