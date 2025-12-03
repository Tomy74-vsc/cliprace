-- =====================================================
-- 12d_test_contest_assets_rls.sql
-- =====================================================
-- Script de test pour vérifier que les politiques RLS fonctionnent
-- =====================================================

-- 1. Vérifier que les politiques existent
SELECT 
  polname as policy_name,
  polcmd as command,
  polroles::text[] as roles,
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND polname LIKE 'contest_assets%'
ORDER BY polname;

-- 2. Vérifier qu'un concours existe avec un brand_id
-- Remplacez 'YOUR_CONTEST_ID' et 'YOUR_BRAND_ID' par des valeurs réelles
SELECT 
  id,
  title,
  brand_id,
  status,
  created_at
FROM public.contests
WHERE status = 'draft'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Tester la fonction split_part sur un path exemple
-- Le path devrait être au format: {contest_id}/assets/{uuid}_{filename}
SELECT 
  'test-contest-id/assets/uuid-filename.jpg' as example_path,
  split_part('test-contest-id/assets/uuid-filename.jpg', '/', 1) as contest_id_extracted;

-- 4. Vérifier que RLS est activé sur storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- 5. Vérifier les buckets existants
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'contest_assets';

-- 6. Test de la politique (nécessite d'être connecté en tant qu'utilisateur authentifié)
-- Cette requête simule ce que fait la politique RLS
-- Remplacez 'YOUR_CONTEST_ID' et 'YOUR_USER_ID' par des valeurs réelles
/*
SELECT 
  EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id::text = split_part('YOUR_CONTEST_ID/assets/test.jpg', '/', 1)
    AND c.brand_id = 'YOUR_USER_ID'::uuid
  ) as policy_would_allow;
*/

