-- =====================================================
-- Migration: 20250925_003_rls_policies.sql
-- Description: Politiques RLS pour les nouvelles tables
-- =====================================================

-- Activer RLS sur toutes les nouvelles tables
-- Note: metrics_daily RLS already enabled in 2025-08-20_006_metrics_leaderboards.sql
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
-- Note: audit_logs RLS already enabled in 2025-08-20_002_security_admins.sql

-- =====================================================
-- POLITIQUES POUR METRICS_DAILY
-- =====================================================

-- Note: metrics_daily policies already exist in 2025-08-20_006_metrics_leaderboards.sql

-- =====================================================
-- POLITIQUES POUR LEADERBOARDS
-- =====================================================

DROP POLICY IF EXISTS "Public can view leaderboards for active contests" ON leaderboards;
CREATE POLICY "Public can view leaderboards for active contests" ON leaderboards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM contests 
            WHERE contests.id = leaderboards.contest_id 
            AND contests.status IN ('active', 'completed')
        )
    );

-- =====================================================
-- POLITIQUES POUR NOTIFICATIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- POLITIQUES POUR MESSAGES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages
    FOR ALL USING (auth.uid() = brand_id OR auth.uid() = creator_id);

-- =====================================================
-- POLITIQUES POUR MESSAGES_THREAD
-- =====================================================

DROP POLICY IF EXISTS "Users can view messages in their threads" ON messages_thread;
CREATE POLICY "Users can view messages in their threads" ON messages_thread
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM messages 
            WHERE messages.id = messages_thread.thread_id 
            AND (messages.brand_id = auth.uid() OR messages.creator_id = auth.uid())
        )
    );

-- =====================================================
-- POLITIQUES POUR SIGNATURES
-- =====================================================

DROP POLICY IF EXISTS "Users can view signatures for their submissions" ON signatures;
CREATE POLICY "Users can view signatures for their submissions" ON signatures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions 
            WHERE submissions.id = signatures.submission_id 
            AND submissions.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Brand owners can view signatures for their contest submissions" ON signatures;
CREATE POLICY "Brand owners can view signatures for their contest submissions" ON signatures
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN contests c ON c.id = s.contest_id
            WHERE s.id = signatures.submission_id 
            AND c.brand_id = auth.uid()
        )
    );

-- =====================================================
-- POLITIQUES POUR AUDIT_LOGS
-- =====================================================

-- Note: audit_logs policies already exist in 2025-08-20_002_security_admins.sql
