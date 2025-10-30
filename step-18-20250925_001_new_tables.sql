-- =====================================================
-- Migration: 20250925_001_new_tables.sql
-- Description: Création des nouvelles tables centrales
-- =====================================================

-- Note: metrics_daily table already exists in 2025-08-20_006_metrics_leaderboards.sql
-- with columns: id, submission_id, date, views, likes, comments, shares, engagement_rate, etc.

-- Table leaderboards (classements des concours)
CREATE TABLE IF NOT EXISTS leaderboards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score NUMERIC NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(contest_id, submission_id)
);

-- Table notifications (notifications utilisateur)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table messages (conversations brand-creator)
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    last_message TEXT,
    unread_for_brand BOOLEAN DEFAULT FALSE,
    unread_for_creator BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table messages_thread (messages individuels)
CREATE TABLE IF NOT EXISTS messages_thread (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table signatures (signatures de soumissions)
CREATE TABLE IF NOT EXISTS signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    signed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    signature_meta JSONB DEFAULT '{}'::jsonb
);

-- Note: audit_logs table already exists in 2025-08-20_002_security_admins.sql
-- with columns: id, actor_id, action, entity, entity_id, data, created_at

-- =====================================================
-- INDEX POUR PERFORMANCE
-- =====================================================

-- Note: metrics_daily indexes already exist in 2025-08-20_006_metrics_leaderboards.sql

-- Index pour leaderboards
CREATE INDEX IF NOT EXISTS idx_leaderboards_contest_id ON leaderboards(contest_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_contest_rank ON leaderboards(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboards_submission_id ON leaderboards(submission_id);

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Index pour messages
CREATE INDEX IF NOT EXISTS idx_messages_brand_id ON messages(brand_id);
CREATE INDEX IF NOT EXISTS idx_messages_creator_id ON messages(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON messages(updated_at);

-- Index pour messages_thread
CREATE INDEX IF NOT EXISTS idx_messages_thread_thread_id ON messages_thread(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_sender_id ON messages_thread(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created_at ON messages_thread(created_at);

-- Index pour signatures
CREATE INDEX IF NOT EXISTS idx_signatures_submission_id ON signatures(submission_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_by ON signatures(signed_by);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_at ON signatures(signed_at);

-- Note: audit_logs indexes already exist in 2025-08-20_002_security_admins.sql
