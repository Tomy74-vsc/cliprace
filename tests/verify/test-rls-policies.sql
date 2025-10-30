-- =====================================================
-- Tests des politiques RLS (Row Level Security)
-- Vérifie que les accès non autorisés sont bloqués
-- =====================================================

-- =====================================================
-- CONFIGURATION DES TESTS
-- =====================================================

-- Définir les IDs de test
\set brand_id '11111111-1111-1111-1111-111111111111'
\set creator_id '22222222-2222-2222-2222-222222222222'
\set admin_id '33333333-3333-3333-3333-333333333333'
\set contest_id '44444444-4444-4444-4444-444444444444'

-- =====================================================
-- A - TESTS DE BASE (sans authentification)
-- =====================================================

-- A1: Tenter d'accéder aux données sans token (doit échouer)
-- Note: Ces tests nécessitent d'être exécutés avec un client non authentifié

-- Test accès submissions sans auth
-- SELECT COUNT(*) FROM submissions;
-- Résultat attendu: 0 (RLS bloque tout)

-- Test accès messages sans auth
-- SELECT COUNT(*) FROM messages;
-- Résultat attendu: 0 (RLS bloque tout)

-- =====================================================
-- B - TESTS AVEC TOKEN CREATOR
-- =====================================================

-- B1: Creator peut voir ses propres soumissions
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: Nombre de soumissions du creator

-- B2: Creator ne peut pas voir les soumissions d'autres creators
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM submissions WHERE creator_id != '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: 0 (RLS bloque)

-- B3: Creator peut voir les leaderboards publics
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM leaderboards l
-- JOIN contests c ON c.id = l.contest_id
-- WHERE c.status IN ('active', 'completed');
-- Résultat attendu: Nombre de leaderboards publics

-- B4: Creator peut voir ses propres notifications
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM notifications WHERE user_id = '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: Nombre de notifications du creator

-- B5: Creator ne peut pas voir les notifications d'autres utilisateurs
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM notifications WHERE user_id != '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: 0 (RLS bloque)

-- B6: Creator peut voir ses messages
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM messages WHERE creator_id = '22222222-2222-2222-2222-222222222222' OR brand_id = '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: Nombre de messages du creator

-- B7: Creator ne peut pas voir les messages d'autres conversations
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM messages WHERE creator_id != '22222222-2222-2222-2222-222222222222' AND brand_id != '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: 0 (RLS bloque)

-- B8: Creator peut voir les signatures de ses soumissions
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- SELECT COUNT(*) FROM signatures s
-- JOIN submissions sub ON sub.id = s.submission_id
-- WHERE sub.creator_id = '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: Nombre de signatures des soumissions du creator

-- =====================================================
-- C - TESTS AVEC TOKEN BRAND
-- =====================================================

-- C1: Brand peut voir les soumissions de son contest
-- SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- SELECT COUNT(*) FROM submissions s
-- JOIN contests c ON c.id = s.contest_id
-- WHERE c.brand_id = '11111111-1111-1111-1111-111111111111';
-- Résultat attendu: Nombre de soumissions du contest du brand

-- C2: Brand ne peut pas voir les soumissions d'autres contests
-- SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- SELECT COUNT(*) FROM submissions s
-- JOIN contests c ON c.id = s.contest_id
-- WHERE c.brand_id != '11111111-1111-1111-1111-111111111111';
-- Résultat attendu: 0 (RLS bloque)

-- C3: Brand peut voir les signatures des soumissions de son contest
-- SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- SELECT COUNT(*) FROM signatures s
-- JOIN submissions sub ON sub.id = s.submission_id
-- JOIN contests c ON c.id = sub.contest_id
-- WHERE c.brand_id = '11111111-1111-1111-1111-111111111111';
-- Résultat attendu: Nombre de signatures des soumissions du contest du brand

-- C4: Brand peut voir ses messages
-- SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- SELECT COUNT(*) FROM messages WHERE brand_id = '11111111-1111-1111-1111-111111111111' OR creator_id = '11111111-1111-1111-1111-111111111111';
-- Résultat attendu: Nombre de messages du brand

-- =====================================================
-- D - TESTS AVEC TOKEN ADMIN
-- =====================================================

-- D1: Admin peut voir toutes les soumissions
-- SET LOCAL "request.jwt.claims" TO '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
-- SELECT COUNT(*) FROM submissions;
-- Résultat attendu: Toutes les soumissions (si politique admin existe)

-- D2: Admin peut voir tous les messages
-- SET LOCAL "request.jwt.claims" TO '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
-- SELECT COUNT(*) FROM messages;
-- Résultat attendu: Tous les messages (si politique admin existe)

-- D3: Admin peut voir tous les audit logs
-- SET LOCAL "request.jwt.claims" TO '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
-- SELECT COUNT(*) FROM audit_logs;
-- Résultat attendu: Tous les audit logs (si politique admin existe)

-- =====================================================
-- E - TESTS D'INSERTION
-- =====================================================

-- E1: Creator peut insérer sa propre soumission
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- INSERT INTO submissions (contest_id, creator_id, platform, platform_video_id, video_url, status, created_at, updated_at)
-- VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'youtube', 'TEST_INSERT', 'https://youtube.com/watch?v=TEST_INSERT', 'pending', NOW(), NOW());
-- Résultat attendu: Insertion réussie

-- E2: Creator ne peut pas insérer une soumission pour un autre creator
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- INSERT INTO submissions (contest_id, creator_id, platform, platform_video_id, video_url, status, created_at, updated_at)
-- VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'youtube', 'TEST_INSERT_OTHER', 'https://youtube.com/watch?v=TEST_INSERT_OTHER', 'pending', NOW(), NOW());
-- Résultat attendu: Erreur (RLS bloque)

-- E3: Creator peut insérer sa propre notification
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- INSERT INTO notifications (user_id, type, payload)
-- VALUES ('22222222-2222-2222-2222-222222222222', 'test', '{"message": "test"}');
-- Résultat attendu: Insertion réussie

-- E4: Creator ne peut pas insérer une notification pour un autre utilisateur
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- INSERT INTO notifications (user_id, type, payload)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'test', '{"message": "test"}');
-- Résultat attendu: Erreur (RLS bloque)

-- =====================================================
-- F - TESTS DE MISE À JOUR
-- =====================================================

-- F1: Creator peut mettre à jour sa propre soumission (champs autorisés)
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- UPDATE submissions SET meta = '{"updated": true}' WHERE creator_id = '22222222-2222-2222-2222-222222222222' AND id = (SELECT id FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222' LIMIT 1);
-- Résultat attendu: Mise à jour réussie

-- F2: Creator ne peut pas mettre à jour le statut de sa soumission
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- UPDATE submissions SET status = 'approved' WHERE creator_id = '22222222-2222-2222-2222-222222222222' AND id = (SELECT id FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222' LIMIT 1);
-- Résultat attendu: Erreur (RLS bloque ou trigger bloque)

-- F3: Creator ne peut pas mettre à jour une soumission d'un autre creator
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- UPDATE submissions SET meta = '{"hacked": true}' WHERE creator_id != '22222222-2222-2222-2222-222222222222';
-- Résultat attendu: Erreur (RLS bloque)

-- =====================================================
-- G - TESTS DE SUPPRESSION
-- =====================================================

-- G1: Creator ne peut pas supprimer ses soumissions
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- DELETE FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222' AND id = (SELECT id FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222' LIMIT 1);
-- Résultat attendu: Erreur (RLS bloque)

-- G2: Admin peut supprimer des soumissions (si politique admin existe)
-- SET LOCAL "request.jwt.claims" TO '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
-- DELETE FROM submissions WHERE id = (SELECT id FROM submissions LIMIT 1);
-- Résultat attendu: Suppression réussie (si politique admin existe)

-- =====================================================
-- H - TESTS DE RACE CONDITIONS
-- =====================================================

-- H1: Test de concurrence - deux utilisateurs tentent d'accéder aux mêmes données
-- Note: Ces tests nécessitent d'être exécutés en parallèle

-- Session 1 (Creator):
-- SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
-- BEGIN;
-- SELECT COUNT(*) FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222';

-- Session 2 (Brand) - en parallèle:
-- SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
-- BEGIN;
-- SELECT COUNT(*) FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222';

-- Résultat attendu: Chaque session ne voit que ses propres données

-- =====================================================
-- I - VÉRIFICATION DES POLITIQUES SPÉCIFIQUES
-- =====================================================

-- I1: Vérifier que les politiques existent
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
        'submissions', 'messages', 'messages_thread', 'signatures', 
        'notifications', 'leaderboards', 'audit_logs'
    )
ORDER BY tablename, policyname;

-- I2: Vérifier que RLS est activé sur toutes les tables sensibles
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS activé'
        ELSE '❌ RLS désactivé'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'submissions', 'messages', 'messages_thread', 'signatures', 
        'notifications', 'leaderboards', 'audit_logs'
    )
ORDER BY tablename;

-- =====================================================
-- J - RÉSUMÉ DES TESTS RLS
-- =====================================================

-- J1: Compter les politiques par table
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'submissions', 'messages', 'messages_thread', 'signatures', 
        'notifications', 'leaderboards', 'audit_logs'
    )
GROUP BY tablename
ORDER BY tablename;

-- J2: Vérifier les types de commandes couvertes
SELECT 
    cmd,
    COUNT(*) as policy_count,
    STRING_AGG(tablename || '.' || policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN (
        'submissions', 'messages', 'messages_thread', 'signatures', 
        'notifications', 'leaderboards', 'audit_logs'
    )
GROUP BY cmd
ORDER BY cmd;
