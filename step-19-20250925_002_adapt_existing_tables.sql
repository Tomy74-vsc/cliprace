-- =====================================================
-- Migration: 20250925_002_adapt_existing_tables.sql
-- Description: Adaptation des tables existantes selon les spécifications
-- =====================================================

-- Table contests (ajout de la colonne rules)
ALTER TABLE contests 
ADD COLUMN IF NOT EXISTS rules JSONB;

-- Table submissions (ajout des colonnes manquantes)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS platform_video_id TEXT,
ADD COLUMN IF NOT EXISTS meta JSONB,
ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;

-- =====================================================
-- CONTRAINTES D'UNICITÉ
-- =====================================================

-- Contrainte d'unicité pour submissions (empêcher les doublons)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_submission_per_contest_platform'
        AND table_name = 'submissions'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE submissions 
        ADD CONSTRAINT unique_submission_per_contest_platform 
        UNIQUE (contest_id, platform, platform_video_id);
    END IF;
END $$;

-- =====================================================
-- INDEX POUR PERFORMANCE
-- =====================================================

-- Index pour submissions (si pas déjà créés)
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_platform_video ON submissions(platform, platform_video_id);
