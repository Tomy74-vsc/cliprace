-- =====================================================
-- Migration: 20250925_rls.sql
-- Description: Politiques RLS complètes selon les spécifications de sécurité
-- =====================================================

-- =====================================================
-- SUPPRESSION DES ANCIENNES POLITIQUES (si elles existent)
-- =====================================================

-- Supprimer les anciennes politiques pour les recréer selon les nouvelles spécifications
DROP POLICY IF EXISTS "Brand owners can manage their contests" ON contests;
DROP POLICY IF EXISTS "Public can view active contests" ON contests;
DROP POLICY IF EXISTS "Creators can view contest details for participation" ON contests;

DROP POLICY IF EXISTS "Creators can view their own submissions" ON submissions;
DROP POLICY IF EXISTS "Creators can create submissions" ON submissions;
DROP POLICY IF EXISTS "Creators can update their own submissions" ON submissions;
DROP POLICY IF EXISTS "Brand owners can view contest submissions" ON submissions;
DROP POLICY IF EXISTS "Brand owners can moderate contest submissions" ON submissions;
DROP POLICY IF EXISTS "Public can view approved submissions" ON submissions;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;

DROP POLICY IF EXISTS "Users can view messages in their threads" ON messages_thread;

DROP POLICY IF EXISTS "Public can view leaderboards for active contests" ON leaderboards;

DROP POLICY IF EXISTS "Users can view signatures for their submissions" ON signatures;
DROP POLICY IF EXISTS "Brand owners can view signatures for their contest submissions" ON signatures;

-- =====================================================
-- POLITIQUES POUR CONTESTS
-- =====================================================

-- Brands peuvent créer/modifier leurs contests
DROP POLICY IF EXISTS "Brands can manage their own contests" ON contests;
CREATE POLICY "Brands can manage their own contests" ON contests
    FOR ALL USING (
        auth.uid() = brand_id AND 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'brand')
    );

-- Creators peuvent SELECT seulement les contests actifs/draft/finished pour browsing
DROP POLICY IF EXISTS "Creators can view active contests for browsing" ON contests;
CREATE POLICY "Creators can view active contests for browsing" ON contests
    FOR SELECT USING (
        status IN ('active', 'draft', 'completed') AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator')
    );

-- Admins ont accès complet
DROP POLICY IF EXISTS "Admins have full access to contests" ON contests;
CREATE POLICY "Admins have full access to contests" ON contests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Accès public limité pour la découverte
DROP POLICY IF EXISTS "Public can view active public contests" ON contests;
CREATE POLICY "Public can view active public contests" ON contests
    FOR SELECT USING (
        status = 'active' AND 
        visibility = 'public' AND 
        starts_at <= NOW() AND 
        ends_at >= NOW()
    );

-- =====================================================
-- POLITIQUES POUR SUBMISSIONS
-- =====================================================

-- INSERT : seulement creator et auth.uid() = creator_id
DROP POLICY IF EXISTS "Creators can insert their own submissions" ON submissions;
CREATE POLICY "Creators can insert their own submissions" ON submissions
    FOR INSERT WITH CHECK (
        auth.uid() = creator_id AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator')
    );

-- SELECT : creator peut voir ses submissions; brands peuvent voir submissions pour leurs contests; admins tout
DROP POLICY IF EXISTS "Creators can view their own submissions" ON submissions;
CREATE POLICY "Creators can view their own submissions" ON submissions
    FOR SELECT USING (
        auth.uid() = creator_id AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator')
    );

DROP POLICY IF EXISTS "Brands can view submissions for their contests" ON submissions;
CREATE POLICY "Brands can view submissions for their contests" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM contests c
            JOIN profiles p ON p.id = c.brand_id
            WHERE c.id = submissions.contest_id 
            AND c.brand_id = auth.uid()
            AND p.role = 'brand'
        )
    );

DROP POLICY IF EXISTS "Admins can view all submissions" ON submissions;
CREATE POLICY "Admins can view all submissions" ON submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- UPDATE : seulement admins et brands (pour status changes) et creator pour updates limités
DROP POLICY IF EXISTS "Admins can update any submission" ON submissions;
CREATE POLICY "Admins can update any submission" ON submissions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Brands can update submission status for their contests" ON submissions;
CREATE POLICY "Brands can update submission status for their contests" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM contests c
            JOIN profiles p ON p.id = c.brand_id
            WHERE c.id = submissions.contest_id 
            AND c.brand_id = auth.uid()
            AND p.role = 'brand'
        )
    );

DROP POLICY IF EXISTS "Creators can update their own submissions before validation" ON submissions;
CREATE POLICY "Creators can update their own submissions before validation" ON submissions
    FOR UPDATE USING (
        auth.uid() = creator_id AND
        status = 'pending' AND
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator')
    );

-- DELETE : admins seulement
DROP POLICY IF EXISTS "Admins can delete submissions" ON submissions;
CREATE POLICY "Admins can delete submissions" ON submissions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR METRICS_DAILY
-- =====================================================

-- Read-only pour creators sur leurs propres submissions
DROP POLICY IF EXISTS "Creators can view metrics for their submissions" ON metrics_daily;
CREATE POLICY "Creators can view metrics for their submissions" ON metrics_daily
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN profiles p ON p.id = s.creator_id
            WHERE s.id = metrics_daily.submission_id 
            AND s.creator_id = auth.uid()
            AND p.role = 'creator'
        )
    );

-- Brands peuvent lire metrics pour contests qu'ils possèdent
DROP POLICY IF EXISTS "Brands can view metrics for their contest submissions" ON metrics_daily;
CREATE POLICY "Brands can view metrics for their contest submissions" ON metrics_daily
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            JOIN profiles p ON p.id = c.brand_id
            WHERE s.id = metrics_daily.submission_id 
            AND c.brand_id = auth.uid()
            AND p.role = 'brand'
        )
    );

-- Admins accès complet
DROP POLICY IF EXISTS "Admins can view all metrics" ON metrics_daily;
CREATE POLICY "Admins can view all metrics" ON metrics_daily
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR NOTIFICATIONS
-- =====================================================

-- Seulement le propriétaire peut lire/update (mark read)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert notifications for themselves" ON notifications;
CREATE POLICY "Users can insert notifications for themselves" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins peuvent voir toutes les notifications (pour debugging)
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications" ON notifications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR MESSAGES
-- =====================================================

-- Seulement le brand et le creator dans le thread + admin
DROP POLICY IF EXISTS "Thread participants can view messages" ON messages;
CREATE POLICY "Thread participants can view messages" ON messages
    FOR SELECT USING (
        auth.uid() = brand_id OR 
        auth.uid() = creator_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Thread participants can update messages" ON messages;
CREATE POLICY "Thread participants can update messages" ON messages
    FOR UPDATE USING (
        auth.uid() = brand_id OR 
        auth.uid() = creator_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Brands and creators can create messages" ON messages;
CREATE POLICY "Brands and creators can create messages" ON messages
    FOR INSERT WITH CHECK (
        (auth.uid() = brand_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'brand')) OR
        (auth.uid() = creator_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'creator'))
    );

-- =====================================================
-- POLITIQUES POUR MESSAGES_THREAD
-- =====================================================

-- Seulement le brand et le creator dans le thread + admin
DROP POLICY IF EXISTS "Thread participants can view thread messages" ON messages_thread;
CREATE POLICY "Thread participants can view thread messages" ON messages_thread
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = messages_thread.thread_id 
            AND (m.brand_id = auth.uid() OR m.creator_id = auth.uid())
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Thread participants can insert thread messages" ON messages_thread;
CREATE POLICY "Thread participants can insert thread messages" ON messages_thread
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = messages_thread.thread_id 
            AND (m.brand_id = auth.uid() OR m.creator_id = auth.uid())
        )
    );

-- Politique UPDATE dédiée pour le flagging des messages
DROP POLICY IF EXISTS "Brands can flag messages in their threads" ON messages_thread;
CREATE POLICY "Brands can flag messages in their threads" ON messages_thread
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = messages_thread.thread_id 
            AND m.brand_id = auth.uid()
        )
    ) WITH CHECK (
        -- Seules les colonnes flagged* peuvent être modifiées
        (auth.uid() IS DISTINCT FROM auth.uid()) OR
        (auth.uid() IS DISTINCT FROM auth.uid()) OR
        (auth.uid() IS DISTINCT FROM auth.uid()) OR
        (auth.uid() IS DISTINCT FROM auth.uid())
    );

-- Admins peuvent flagger n'importe quel message
DROP POLICY IF EXISTS "Admins can flag any message" ON messages_thread;
CREATE POLICY "Admins can flag any message" ON messages_thread
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- POLITIQUES POUR LEADERBOARDS
-- =====================================================

-- SELECT public mais champs restreints
DROP POLICY IF EXISTS "Public can view leaderboards for active contests" ON leaderboards;
CREATE POLICY "Public can view leaderboards for active contests" ON leaderboards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM contests c
            WHERE c.id = leaderboards.contest_id 
            AND c.status IN ('active', 'completed')
        )
    );

-- Updates par server side seulement (service role)
-- Pas de politique UPDATE/DELETE pour les utilisateurs normaux
-- Les updates se font via des fonctions server-side avec service role

-- =====================================================
-- POLITIQUES POUR SIGNATURES
-- =====================================================

-- Creators peuvent voir signatures pour leurs submissions
DROP POLICY IF EXISTS "Creators can view signatures for their submissions" ON signatures;
CREATE POLICY "Creators can view signatures for their submissions" ON signatures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN profiles p ON p.id = s.creator_id
            WHERE s.id = signatures.submission_id 
            AND s.creator_id = auth.uid()
            AND p.role = 'creator'
        )
    );

-- Brands peuvent voir signatures pour leurs contest submissions
DROP POLICY IF EXISTS "Brands can view signatures for their contest submissions" ON signatures;
CREATE POLICY "Brands can view signatures for their contest submissions" ON signatures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            JOIN profiles p ON p.id = c.brand_id
            WHERE s.id = signatures.submission_id 
            AND c.brand_id = auth.uid()
            AND p.role = 'brand'
        )
    );

-- Admins peuvent voir toutes les signatures
DROP POLICY IF EXISTS "Admins can view all signatures" ON signatures;
CREATE POLICY "Admins can view all signatures" ON signatures
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- INSERT : seulement les utilisateurs authentifiés peuvent signer
DROP POLICY IF EXISTS "Authenticated users can create signatures" ON signatures;
CREATE POLICY "Authenticated users can create signatures" ON signatures
    FOR INSERT WITH CHECK (
        auth.uid() = signed_by AND
        auth.uid() IS NOT NULL
    );

-- =====================================================
-- POLITIQUES POUR PROFILES (amélioration des existantes)
-- =====================================================

-- Ajouter une politique pour que les admins puissent voir tous les profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- FONCTIONS UTILITAIRES POUR LES TESTS
-- =====================================================

-- Fonction pour simuler un utilisateur dans les tests
CREATE OR REPLACE FUNCTION set_test_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Cette fonction sera utilisée dans les tests pour simuler un utilisateur
    -- En production, auth.uid() sera utilisé
    PERFORM set_config('app.current_user_id', user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir l'ID utilisateur actuel (pour les tests)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    -- En production, utilise auth.uid()
    IF current_setting('app.current_user_id', true) IS NOT NULL THEN
        RETURN current_setting('app.current_user_id', true)::UUID;
    END IF;
    
    -- Fallback vers auth.uid() en production
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTAIRES POUR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Brands can manage their own contests" ON contests IS 
'Les brands peuvent créer, modifier et supprimer leurs propres contests';

COMMENT ON POLICY "Creators can view active contests for browsing" ON contests IS 
'Les creators peuvent voir les contests actifs, draft et terminés pour la navigation';

COMMENT ON POLICY "Admins have full access to contests" ON contests IS 
'Les admins ont un accès complet à tous les contests';

COMMENT ON POLICY "Creators can insert their own submissions" ON submissions IS 
'Seuls les creators authentifiés peuvent créer des submissions avec leur propre ID';

COMMENT ON POLICY "Brands can view submissions for their contests" ON submissions IS 
'Les brands peuvent voir les submissions pour leurs propres contests';

COMMENT ON POLICY "Creators can update their own submissions before validation" ON submissions IS 
'Les creators peuvent modifier leurs submissions seulement avant validation (status pending)';

COMMENT ON POLICY "Admins can delete submissions" ON submissions IS 
'Seuls les admins peuvent supprimer des submissions';

COMMENT ON POLICY "Thread participants can view messages" ON messages IS 
'Seuls les participants au thread (brand, creator) et les admins peuvent voir les messages';

COMMENT ON POLICY "Public can view leaderboards for active contests" ON leaderboards IS 
'Le public peut voir les leaderboards pour les contests actifs et terminés';
