-- =====================================================
-- Migration: 20250925_004_utility_functions.sql
-- Description: Fonctions utilitaires pour le schéma central
-- =====================================================

-- =====================================================
-- FONCTIONS POUR LE SCORING ET CLASSEMENTS
-- =====================================================

-- Fonction pour calculer le score d'une soumission
CREATE OR REPLACE FUNCTION calculate_submission_score(p_submission_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_score NUMERIC := 0;
    metrics_record RECORD;
BEGIN
    -- Calculer le score basé sur les métriques quotidiennes
    -- Note: Utilise la structure existante de metrics_daily (sans colonne raw)
    SELECT 
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(likes), 0) as total_likes,
        COALESCE(SUM(comments), 0) as total_comments,
        COALESCE(SUM(shares), 0) as total_shares
    INTO metrics_record
    FROM metrics_daily 
    WHERE submission_id = p_submission_id;
    
    -- Formule de scoring (à adapter selon les besoins)
    total_score := (metrics_record.total_views * 0.1) + 
                   (metrics_record.total_likes * 1.0) + 
                   (metrics_record.total_comments * 2.0) + 
                   (metrics_record.total_shares * 3.0);
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour le classement d'un concours
CREATE OR REPLACE FUNCTION update_contest_leaderboard(p_contest_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Supprimer l'ancien classement
    DELETE FROM leaderboards WHERE contest_id = p_contest_id;
    
    -- Insérer le nouveau classement
    INSERT INTO leaderboards (contest_id, submission_id, rank, score, last_updated)
    SELECT 
        p_contest_id,
        s.id,
        ROW_NUMBER() OVER (ORDER BY s.score DESC, s.created_at ASC) as rank,
        s.score,
        NOW()
    FROM submissions s
    WHERE s.contest_id = p_contest_id 
    AND s.status = 'approved'
    ORDER BY s.score DESC, s.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTIONS POUR LES MESSAGES
-- =====================================================

-- Fonction pour mettre à jour updated_at sur messages
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    auth.uid() = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at sur messages
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

-- Fonction pour mettre à jour last_message et updated_at quand un nouveau message est ajouté
CREATE OR REPLACE FUNCTION update_message_thread()
RETURNS TRIGGER AS $$
DECLARE
    message_record RECORD;
BEGIN
    -- Récupérer les informations du message
    SELECT brand_id, creator_id INTO message_record
    FROM messages 
    WHERE id = auth.uid();
    
    -- Mettre à jour le message
    UPDATE messages 
    SET 
        last_message = LEFT(auth.uid(), 100),
        updated_at = NOW(),
        unread_for_brand = CASE 
            WHEN auth.uid() = message_record.brand_id THEN unread_for_brand
            ELSE TRUE 
        END,
        unread_for_creator = CASE 
            WHEN auth.uid() = message_record.creator_id THEN unread_for_creator
            ELSE TRUE 
        END
    WHERE id = auth.uid();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour last_message et updated_at
DROP TRIGGER IF EXISTS update_message_thread_trigger ON messages_thread;
CREATE TRIGGER update_message_thread_trigger
    AFTER INSERT ON messages_thread
    FOR EACH ROW
    EXECUTE FUNCTION update_message_thread();

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE metrics_daily IS 'Métriques agrégées quotidiennes pour chaque soumission (views, likes, etc.)';
COMMENT ON TABLE leaderboards IS 'Classements des soumissions par concours avec scores et rangs';
COMMENT ON TABLE notifications IS 'Notifications utilisateur pour événements importants';
COMMENT ON TABLE messages IS 'Conversations entre marques et créateurs';
COMMENT ON TABLE messages_thread IS 'Messages individuels dans les conversations';
COMMENT ON TABLE signatures IS 'Signatures numériques des soumissions pour validation';
-- Note: audit_logs table already exists in 2025-08-20_002_security_admins.sql

COMMENT ON COLUMN submissions.platform IS 'Plateforme de la soumission (tiktok, instagram, youtube, etc.)';
COMMENT ON COLUMN submissions.platform_video_id IS 'ID unique de la vidéo sur la plateforme';
COMMENT ON COLUMN submissions.meta IS 'Métadonnées additionnelles de la soumission';
COMMENT ON COLUMN submissions.score IS 'Score calculé de la soumission basé sur les métriques';
-- Note: metrics_daily table already exists in 2025-08-20_006_metrics_leaderboards.sql
-- with columns: views, likes, comments, shares, engagement_rate, etc. (no raw column)
COMMENT ON COLUMN leaderboards.rank IS 'Position dans le classement (1 = premier)';
COMMENT ON COLUMN notifications.payload IS 'Données structurées de la notification';
COMMENT ON COLUMN messages.last_message IS 'Aperçu du dernier message (100 caractères max)';
COMMENT ON COLUMN messages_thread.attachments IS 'Fichiers joints au message';
COMMENT ON COLUMN signatures.signature_meta IS 'Métadonnées de la signature (hash, timestamp, etc.)';
-- Note: audit_logs columns already documented in 2025-08-20_002_security_admins.sql
