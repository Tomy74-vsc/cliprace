-- =====================================================
-- Migration: 20250925_007_moderation_rls.sql
-- Description: Politiques RLS pour le système de modération
-- =====================================================

-- =====================================================
-- POLITIQUES POUR AUDIT_LOGS
-- =====================================================

-- Les admins peuvent voir tous les logs d'audit
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Les brands peuvent voir les logs pour leurs contests
DROP POLICY IF EXISTS "Brands can view audit logs for their contests" ON audit_logs;
CREATE POLICY "Brands can view audit logs for their contests" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            WHERE s.id = audit_logs.entity_id 
            AND c.brand_id = auth.uid()
            AND audit_logs.entity = 'submissions'
        )
    );

-- Les creators peuvent voir les logs pour leurs submissions
DROP POLICY IF EXISTS "Creators can view audit logs for their submissions" ON audit_logs;
CREATE POLICY "Creators can view audit logs for their submissions" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.id = audit_logs.entity_id 
            AND s.creator_id = auth.uid()
            AND audit_logs.entity = 'submissions'
        )
    );

-- Seuls les admins peuvent insérer des logs d'audit
DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;
CREATE POLICY "Admins can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR MODERATION_QUEUE
-- =====================================================

-- Les admins peuvent voir toute la queue de modération
DROP POLICY IF EXISTS "Admins can view all moderation queue" ON moderation_queue;
CREATE POLICY "Admins can view all moderation queue" ON moderation_queue
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Les brands peuvent voir la queue pour leurs contests
DROP POLICY IF EXISTS "Brands can view moderation queue for their contests" ON moderation_queue;
CREATE POLICY "Brands can view moderation queue for their contests" ON moderation_queue
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            WHERE s.id = moderation_queue.submission_id 
            AND c.brand_id = auth.uid()
        )
    );

-- Les admins peuvent modifier la queue de modération
DROP POLICY IF EXISTS "Admins can update moderation queue" ON moderation_queue;
CREATE POLICY "Admins can update moderation queue" ON moderation_queue
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Les brands peuvent assigner des items de la queue
DROP POLICY IF EXISTS "Brands can assign moderation queue items" ON moderation_queue;
CREATE POLICY "Brands can assign moderation queue items" ON moderation_queue
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            WHERE s.id = moderation_queue.submission_id 
            AND c.brand_id = auth.uid()
        )
    ) WITH CHECK (
        -- Seules les colonnes assigned_to peuvent être modifiées par les brands
        (auth.uid() IS DISTINCT FROM auth.uid())
    );

-- Seuls les admins peuvent insérer dans la queue
DROP POLICY IF EXISTS "Admins can insert into moderation queue" ON moderation_queue;
CREATE POLICY "Admins can insert into moderation queue" ON moderation_queue
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR MODERATION_RULES
-- =====================================================

-- Les admins peuvent gérer les règles de modération
DROP POLICY IF EXISTS "Admins can manage moderation rules" ON moderation_rules;
CREATE POLICY "Admins can manage moderation rules" ON moderation_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Les brands peuvent voir les règles actives
DROP POLICY IF EXISTS "Brands can view active moderation rules" ON moderation_rules;
CREATE POLICY "Brands can view active moderation rules" ON moderation_rules
    FOR SELECT USING (
        is_active = true AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'brand')
    );

-- =====================================================
-- MISE À JOUR DES POLITIQUES EXISTANTES POUR SUBMISSIONS
-- =====================================================

-- Supprimer les anciennes politiques pour les recréer
DROP POLICY IF EXISTS "Creators can update their own submissions before validation" ON submissions;

-- Nouvelle politique pour les creators - ils peuvent modifier seulement leurs submissions en pending
DROP POLICY IF EXISTS "Creators can update their own pending submissions" ON submissions;
CREATE POLICY "Creators can update their own pending submissions" ON submissions
    FOR UPDATE USING (
        auth.uid() = creator_id AND
        status IN ('pending', 'pending_automod') AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator')
    ) WITH CHECK (
        -- Les creators ne peuvent pas changer le statut vers approved/rejected
        status IN ('pending', 'pending_automod')
    );

-- Politique pour les brands - ils peuvent modifier le statut des submissions de leurs contests
DROP POLICY IF EXISTS "Brands can moderate submissions for their contests" ON submissions;
CREATE POLICY "Brands can moderate submissions for their contests" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM contests c
            JOIN profiles p ON p.id = c.brand_id
            WHERE c.id = submissions.contest_id 
            AND c.brand_id = auth.uid()
            AND p.role = 'brand'
        )
    ) WITH CHECK (
        -- Les brands peuvent changer le statut vers approved/rejected/pending_review
        status IN ('approved', 'rejected', 'pending_review', 'payout_pending', 'paid')
    );

-- =====================================================
-- POLITIQUES POUR NOTIFICATIONS DE MODÉRATION
-- =====================================================

-- Les utilisateurs peuvent voir leurs propres notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Les utilisateurs peuvent marquer leurs notifications comme lues
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Les admins peuvent voir toutes les notifications (pour debugging)
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications" ON notifications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Seuls les admins et le système peuvent créer des notifications
DROP POLICY IF EXISTS "Admins and system can create notifications" ON notifications;
CREATE POLICY "Admins and system can create notifications" ON notifications
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- FONCTIONS UTILITAIRES POUR LA MODÉRATION
-- =====================================================

-- Fonction pour vérifier si un utilisateur peut modérer une submission
CREATE OR REPLACE FUNCTION can_moderate_submission(
    p_submission_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    brand_id UUID;
BEGIN
    -- Récupérer le rôle de l'utilisateur
    SELECT role INTO user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- Les admins peuvent tout modérer
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Vérifier si c'est un brand et si la submission appartient à son contest
    IF user_role = 'brand' THEN
        SELECT c.brand_id INTO brand_id
        FROM submissions s
        JOIN contests c ON c.id = s.contest_id
        WHERE s.id = p_submission_id;
        
        RETURN brand_id = p_user_id;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier les permissions de modération
CREATE OR REPLACE FUNCTION check_moderation_permissions(
    p_user_id UUID,
    p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Récupérer le rôle de l'utilisateur
    SELECT role INTO user_role
    FROM profiles
    WHERE id = p_user_id;
    
    -- Vérifier les permissions selon l'action
    CASE p_action
        WHEN 'view_queue' THEN
            RETURN user_role IN ('admin', 'brand');
        WHEN 'process_queue' THEN
            RETURN user_role = 'admin';
        WHEN 'moderate_submission' THEN
            RETURN user_role IN ('admin', 'brand');
        WHEN 'manage_rules' THEN
            RETURN user_role = 'admin';
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS POUR LA MODÉRATION
-- =====================================================

-- Trigger pour ajouter automatiquement à la queue de modération
CREATE OR REPLACE FUNCTION trigger_add_to_moderation_queue()
RETURNS TRIGGER AS $$
BEGIN
    -- Ajouter à la queue si le statut est pending_automod
    IF auth.uid() = 'pending_automod' THEN
        INSERT INTO moderation_queue (submission_id, status, priority)
        VALUES (auth.uid(), 'pending', 0);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS submissions_moderation_queue_trigger ON submissions;
CREATE TRIGGER submissions_moderation_queue_trigger
    AFTER INSERT OR UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_add_to_moderation_queue();

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Admins can view all audit logs" ON audit_logs IS 
'Les admins peuvent voir tous les logs d''audit pour le debugging et la conformité';

COMMENT ON POLICY "Brands can view audit logs for their contests" ON audit_logs IS 
'Les brands peuvent voir les logs d''audit pour leurs propres contests';

COMMENT ON POLICY "Creators can view audit logs for their submissions" ON audit_logs IS 
'Les creators peuvent voir les logs d''audit pour leurs propres submissions';

COMMENT ON POLICY "Admins can view all moderation queue" ON moderation_queue IS 
'Les admins peuvent voir toute la queue de modération';

COMMENT ON POLICY "Brands can view moderation queue for their contests" ON moderation_queue IS 
'Les brands peuvent voir la queue de modération pour leurs contests';

COMMENT ON POLICY "Brands can assign moderation queue items" ON moderation_queue IS 
'Les brands peuvent assigner des items de la queue à des modérateurs';

COMMENT ON POLICY "Admins can manage moderation rules" ON moderation_rules IS 
'Les admins peuvent créer, modifier et supprimer les règles de modération';

COMMENT ON POLICY "Brands can view active moderation rules" ON moderation_rules IS 
'Les brands peuvent voir les règles de modération actives';

COMMENT ON POLICY "Creators can update their own pending submissions" ON submissions IS 
'Les creators peuvent modifier leurs submissions seulement avant la modération';

COMMENT ON POLICY "Brands can moderate submissions for their contests" ON submissions IS 
'Les brands peuvent modérer les submissions de leurs contests';

COMMENT ON FUNCTION can_moderate_submission IS 
'Vérifie si un utilisateur peut modérer une submission spécifique';

COMMENT ON FUNCTION check_moderation_permissions IS 
'Vérifie les permissions de modération d''un utilisateur pour une action donnée';
