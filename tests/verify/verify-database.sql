-- =====================================================
-- Script de vérification de la base de données ClipRace
-- Vérifie les tables, contraintes, index et politiques RLS
-- =====================================================

-- =====================================================
-- A - VÉRIFICATION DES TABLES
-- =====================================================

-- A1: Lister toutes les tables publiques
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- A2: Vérifier les tables spécifiques requises
SELECT 
    CASE 
        WHEN table_name IN (
            'contests', 'submissions', 'metrics_daily', 'leaderboards',
            'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
        ) THEN '✅ ' || table_name
        ELSE '❌ ' || table_name
    END as status,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY table_name;

-- =====================================================
-- B - VÉRIFICATION DES ENUMS
-- =====================================================

-- B1: Vérifier l'enum contest_status
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'contest_status'
ORDER BY e.enumsortorder;

-- B2: Vérifier l'enum user_role
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

-- =====================================================
-- C - VÉRIFICATION DES CONTRAINTES
-- =====================================================

-- C1: Contraintes de clé primaire
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_name IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tc.table_name;

-- C2: Contraintes de clé étrangère
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tc.table_name, tc.constraint_name;

-- C3: Contraintes UNIQUE
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.table_name IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tc.table_name;

-- C4: Vérifier la contrainte unique submissions (contest_id, platform, platform_video_id)
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.table_name = 'submissions'
ORDER BY kcu.ordinal_position;

-- =====================================================
-- D - VÉRIFICATION DES INDEX
-- =====================================================

-- D1: Index sur les tables principales
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tablename, indexname;

-- D2: Index spécifiques requis
SELECT 
    CASE 
        WHEN indexname IN (
            'idx_leaderboards_contest_id',
            'idx_notifications_user_id',
            'idx_messages_brand_id',
            'idx_signatures_submission_id'
        ) THEN '✅ ' || indexname
        ELSE '❌ ' || indexname
    END as status,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname IN (
        'idx_leaderboards_contest_id',
        'idx_notifications_user_id',
        'idx_messages_brand_id',
        'idx_signatures_submission_id'
    )
ORDER BY tablename, indexname;

-- =====================================================
-- E - VÉRIFICATION RLS (Row Level Security)
-- =====================================================

-- E1: Tables avec RLS activé
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tablename;

-- E2: Politiques RLS par table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY tablename, policyname;

-- =====================================================
-- F - VÉRIFICATION DES FONCTIONS
-- =====================================================

-- F1: Fonctions utilitaires
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'log_audit_event',
        'get_enum_values'
    )
ORDER BY routine_name;

-- =====================================================
-- G - VÉRIFICATION DES TRIGGERS
-- =====================================================

-- G1: Triggers sur les tables principales
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- H - TESTS DE CONTRAINTES (à exécuter avec prudence)
-- =====================================================

-- H1: Test de la contrainte unique submissions
-- ATTENTION: Ce test peut échouer si des données existent déjà
-- 
-- INSERT INTO submissions (
--     contest_id, creator_id, platform, platform_video_id, 
--     video_url, status, created_at, updated_at
-- ) VALUES (
--     '44444444-4444-4444-4444-444444444444',
--     '22222222-2222-2222-2222-222222222222',
--     'youtube',
--     'TEST_UNIQUE_CONSTRAINT',
--     'https://youtube.com/watch?v=TEST_UNIQUE_CONSTRAINT',
--     'pending',
--     NOW(),
--     NOW()
-- );
-- 
-- -- Tenter d'insérer le même enregistrement (doit échouer)
-- INSERT INTO submissions (
--     contest_id, creator_id, platform, platform_video_id, 
--     video_url, status, created_at, updated_at
-- ) VALUES (
--     '44444444-4444-4444-4444-444444444444',
--     '22222222-2222-2222-2222-222222222222',
--     'youtube',
--     'TEST_UNIQUE_CONSTRAINT',
--     'https://youtube.com/watch?v=TEST_UNIQUE_CONSTRAINT',
--     'pending',
--     NOW(),
--     NOW()
-- );

-- =====================================================
-- I - VÉRIFICATION DES DONNÉES DE TEST
-- =====================================================

-- I1: Vérifier les utilisateurs de test
SELECT 
    id,
    email,
    role,
    created_at
FROM profiles
WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
)
ORDER BY role;

-- I2: Vérifier le contest de test
SELECT 
    id,
    title,
    brand_id,
    status,
    starts_at,
    ends_at
FROM contests
WHERE id = '44444444-4444-4444-4444-444444444444';

-- I3: Compter les soumissions de test
SELECT 
    COUNT(*) as total_submissions,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
    COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_submissions
FROM submissions
WHERE contest_id = '44444444-4444-4444-4444-444444444444';

-- I4: Vérifier les signatures
SELECT 
    s.id as submission_id,
    s.status as submission_status,
    sig.signed_at,
    sig.signature_meta
FROM submissions s
LEFT JOIN signatures sig ON s.id = sig.submission_id
WHERE s.contest_id = '44444444-4444-4444-4444-444444444444'
ORDER BY s.created_at DESC;

-- =====================================================
-- J - VÉRIFICATION DES BUCKETS STORAGE
-- =====================================================

-- J1: Vérifier l'existence du bucket signatures
-- Note: Cette requête nécessite des privilèges spéciaux
-- SELECT name, public, created_at
-- FROM storage.buckets
-- WHERE name = 'signatures';

-- =====================================================
-- K - RÉSUMÉ DE VÉRIFICATION
-- =====================================================

-- K1: Résumé des tables et RLS
SELECT 
    'Tables avec RLS' as category,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )

UNION ALL

SELECT 
    'Politiques RLS totales' as category,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    )

UNION ALL

SELECT 
    'Index créés' as category,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
    );
