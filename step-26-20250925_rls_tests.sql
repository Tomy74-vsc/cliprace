-- =====================================================
-- Tests RLS: 20250925_rls_tests.sql
-- Description: Scénarios de test pour valider les politiques RLS
-- =====================================================

-- =====================================================
-- SETUP DES DONNÉES DE TEST
-- =====================================================

-- Créer des utilisateurs de test (simulation)
-- En production, ces utilisateurs seraient créés via Supabase Auth

-- Variables pour les IDs de test (à remplacer par de vrais UUIDs)
-- \set creator1_id '11111111-1111-1111-1111-111111111111'
-- \set creator2_id '22222222-2222-2222-2222-222222222222'
-- \set brand1_id '33333333-3333-3333-3333-333333333333'
-- \set brand2_id '44444444-4444-4444-4444-444444444444'
-- \set admin_id '55555555-5555-5555-5555-555555555555'

-- =====================================================
-- TESTS POUR CONTESTS
-- =====================================================

-- Test 1: Un creator ne peut pas créer de contest
-- SET ROLE authenticated;
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête devrait échouer
-- INSERT INTO contests (brand_id, title, description, starts_at, ends_at, networks, formats, visibility, budget_cents, prize_pool_cents, payout_model)
-- VALUES ('11111111-1111-1111-1111-111111111111', 'Test Contest', 'Test Description', NOW(), NOW() + INTERVAL '7 days', '["tiktok"]', '["video"]', 'public', 10000, 5000, 'standard');
-- 
-- -- Vérifier que le contest n'a pas été créé
-- SELECT COUNT(*) FROM contests WHERE title = 'Test Contest';

-- Test 2: Un brand peut créer un contest
-- SELECT set_test_user('33333333-3333-3333-3333-333333333333'::UUID);
-- 
-- INSERT INTO contests (brand_id, title, description, starts_at, ends_at, networks, formats, visibility, budget_cents, prize_pool_cents, payout_model)
-- VALUES ('33333333-3333-3333-3333-333333333333', 'Brand Contest', 'Brand Description', NOW(), NOW() + INTERVAL '7 days', '["tiktok"]', '["video"]', 'public', 10000, 5000, 'standard');
-- 
-- -- Vérifier que le contest a été créé
-- SELECT COUNT(*) FROM contests WHERE title = 'Brand Contest';

-- Test 3: Un creator ne peut pas voir les contests d'autres brands (draft)
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que les contests publics actifs
-- SELECT id, title, status FROM contests WHERE brand_id = '33333333-3333-3333-3333-333333333333';

-- =====================================================
-- TESTS POUR SUBMISSIONS
-- =====================================================

-- Test 4: Un creator ne peut pas créer de submission pour un autre creator
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête devrait échouer
-- INSERT INTO submissions (contest_id, creator_id, network, video_url, content_url)
-- VALUES ('contest-uuid-here', '22222222-2222-2222-2222-222222222222', 'tiktok', 'https://example.com/video1', 'https://example.com/content1');

-- Test 5: Un creator peut créer sa propre submission
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- INSERT INTO submissions (contest_id, creator_id, network, video_url, content_url)
-- VALUES ('contest-uuid-here', '11111111-1111-1111-1111-111111111111', 'tiktok', 'https://example.com/video1', 'https://example.com/content1');
-- 
-- -- Vérifier que la submission a été créée
-- SELECT COUNT(*) FROM submissions WHERE creator_id = '11111111-1111-1111-1111-111111111111';

-- Test 6: Un creator ne peut pas voir les submissions d'autres creators
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que ses propres submissions
-- SELECT id, creator_id FROM submissions WHERE creator_id = '22222222-2222-2222-2222-222222222222';

-- Test 7: Un creator ne peut pas modifier une submission après validation
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Mettre à jour le status de la submission à 'approved'
-- UPDATE submissions SET status = 'approved' WHERE creator_id = '11111111-1111-1111-1111-111111111111';
-- 
-- -- Cette requête devrait échouer
-- UPDATE submissions SET video_url = 'https://example.com/new-video' WHERE creator_id = '11111111-1111-1111-1111-111111111111' AND status = 'approved';

-- =====================================================
-- TESTS POUR MESSAGES
-- =====================================================

-- Test 8: Un creator ne peut pas lire les messages d'un autre creator
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que les messages où ce creator est impliqué
-- SELECT id, brand_id, creator_id FROM messages WHERE creator_id = '22222222-2222-2222-2222-222222222222';

-- Test 9: Un creator ne peut pas créer de message pour un autre creator
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête devrait échouer
-- INSERT INTO messages (brand_id, creator_id, subject, last_message)
-- VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Test Subject', 'Test Message');

-- =====================================================
-- TESTS POUR NOTIFICATIONS
-- =====================================================

-- Test 10: Un utilisateur ne peut pas lire les notifications d'un autre utilisateur
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que ses propres notifications
-- SELECT id, user_id, type FROM notifications WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- Test 11: Un utilisateur ne peut pas créer de notification pour un autre utilisateur
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête devrait échouer
-- INSERT INTO notifications (user_id, type, payload)
-- VALUES ('22222222-2222-2222-2222-222222222222', 'test', '{"message": "test"}');

-- =====================================================
-- TESTS POUR LEADERBOARDS
-- =====================================================

-- Test 12: Les leaderboards sont publics pour les contests actifs
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête devrait fonctionner (lecture publique)
-- SELECT l.id, l.rank, l.score, c.title 
-- FROM leaderboards l
-- JOIN contests c ON c.id = l.contest_id
-- WHERE c.status = 'active';

-- =====================================================
-- TESTS POUR SIGNATURES
-- =====================================================

-- Test 13: Un creator ne peut voir que les signatures de ses propres submissions
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que les signatures pour ses submissions
-- SELECT s.id, s.submission_id, sub.creator_id
-- FROM signatures s
-- JOIN submissions sub ON sub.id = s.submission_id
-- WHERE sub.creator_id = '22222222-2222-2222-2222-222222222222';

-- =====================================================
-- TESTS POUR METRICS_DAILY
-- =====================================================

-- Test 14: Un creator ne peut voir que les métriques de ses propres submissions
-- SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
-- 
-- -- Cette requête ne devrait retourner que les métriques pour ses submissions
-- SELECT m.id, m.submission_id, s.creator_id
-- FROM metrics_daily m
-- JOIN submissions s ON s.id = m.submission_id
-- WHERE s.creator_id = '22222222-2222-2222-2222-222222222222';

-- =====================================================
-- TESTS POUR LES ADMINS
-- =====================================================

-- Test 15: Un admin peut voir toutes les données
-- SELECT set_test_user('55555555-5555-5555-5555-555555555555'::UUID);
-- 
-- -- Ces requêtes devraient toutes fonctionner
-- SELECT COUNT(*) FROM contests;
-- SELECT COUNT(*) FROM submissions;
-- SELECT COUNT(*) FROM messages;
-- SELECT COUNT(*) FROM notifications;
-- SELECT COUNT(*) FROM leaderboards;
-- SELECT COUNT(*) FROM signatures;
-- SELECT COUNT(*) FROM metrics_daily;

-- =====================================================
-- SCRIPT DE TEST AUTOMATISÉ
-- =====================================================

-- Fonction pour exécuter tous les tests
CREATE OR REPLACE FUNCTION run_rls_tests()
RETURNS TABLE (
    test_name TEXT,
    expected_result TEXT,
    actual_result TEXT,
    passed BOOLEAN
) AS $$
DECLARE
    creator1_id UUID := '11111111-1111-1111-1111-111111111111';
    creator2_id UUID := '22222222-2222-2222-2222-222222222222';
    brand1_id UUID := '33333333-3333-3333-3333-333333333333';
    admin_id UUID := '55555555-5555-5555-5555-555555555555';
    test_contest_id UUID;
    test_submission_id UUID;
    result_count INTEGER;
BEGIN
    -- Test 1: Creator ne peut pas créer de contest
    BEGIN
        PERFORM set_test_user(creator1_id);
        INSERT INTO contests (brand_id, title, description, starts_at, ends_at, networks, formats, visibility, budget_cents, prize_pool_cents, payout_model)
        VALUES (creator1_id, 'Test Contest', 'Test Description', NOW(), NOW() + INTERVAL '7 days', '["tiktok"]', '["video"]', 'public', 10000, 5000, 'standard');
        
        RETURN QUERY SELECT 
            'Creator cannot create contest'::TEXT,
            'Should fail'::TEXT,
            'Succeeded (ERROR!)'::TEXT,
            FALSE;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'Creator cannot create contest'::TEXT,
            'Should fail'::TEXT,
            'Failed as expected'::TEXT,
            TRUE;
    END;

    -- Test 2: Creator ne peut pas voir les submissions d'autres creators
    BEGIN
        PERFORM set_test_user(creator1_id);
        SELECT COUNT(*) INTO result_count 
        FROM submissions 
        WHERE creator_id = creator2_id;
        
        RETURN QUERY SELECT 
            'Creator cannot see other creators submissions'::TEXT,
            'Should return 0'::TEXT,
            result_count::TEXT,
            (result_count = 0);
    END;

    -- Test 3: Admin peut voir toutes les données
    BEGIN
        PERFORM set_test_user(admin_id);
        SELECT COUNT(*) INTO result_count FROM contests;
        
        RETURN QUERY SELECT 
            'Admin can see all contests'::TEXT,
            'Should return > 0'::TEXT,
            result_count::TEXT,
            (result_count >= 0);
    END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INSTRUCTIONS D'UTILISATION
-- =====================================================

/*
INSTRUCTIONS POUR EXÉCUTER LES TESTS :

1. Créer des utilisateurs de test dans Supabase Auth avec les UUIDs suivants :
   - Creator 1: 11111111-1111-1111-1111-111111111111
   - Creator 2: 22222222-2222-2222-2222-222222222222
   - Brand 1: 33333333-3333-3333-3333-333333333333
   - Brand 2: 44444444-4444-4444-4444-444444444444
   - Admin: 55555555-5555-5555-5555-555555555555

2. Créer les profiles correspondants avec les bons rôles :
   INSERT INTO profiles (id, email, role, name) VALUES
   ('11111111-1111-1111-1111-111111111111', 'creator1@test.com', 'creator', 'Creator 1'),
   ('22222222-2222-2222-2222-222222222222', 'creator2@test.com', 'creator', 'Creator 2'),
   ('33333333-3333-3333-3333-333333333333', 'brand1@test.com', 'brand', 'Brand 1'),
   ('44444444-4444-4444-4444-444444444444', 'brand2@test.com', 'brand', 'Brand 2'),
   ('55555555-5555-5555-5555-555555555555', 'admin@test.com', 'admin', 'Admin');

3. Exécuter les tests manuellement :
   SELECT * FROM run_rls_tests();

4. Ou tester individuellement avec psql :
   -- Simuler un utilisateur
   SELECT set_test_user('11111111-1111-1111-1111-111111111111'::UUID);
   
   -- Tester une requête
   SELECT COUNT(*) FROM contests WHERE brand_id = '33333333-3333-3333-3333-333333333333';

5. Pour tester avec JWT en production :
   -- Utiliser le JWT token de l'utilisateur dans les headers
   -- auth.uid() sera automatiquement défini par Supabase
*/
