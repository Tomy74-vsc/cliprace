-- =====================================================
-- 12e_verify_and_fix_contest_assets_rls.sql
-- =====================================================
-- Script pour vérifier et corriger les politiques RLS pour contest_assets
-- À exécuter si vous avez l'erreur "new row violates row-level security policy"
-- =====================================================

-- 1. Vérifier que RLS est activé
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS activé sur storage.objects';
  ELSE
    RAISE NOTICE 'RLS déjà activé sur storage.objects';
  END IF;
END $$;

-- 2. Vérifier que le bucket existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'contest_assets'
  ) THEN
    RAISE NOTICE 'ATTENTION: Le bucket contest_assets n''existe pas. Créez-le d''abord avec 12a_create_contest_assets_bucket.sql';
  ELSE
    RAISE NOTICE 'Bucket contest_assets existe';
  END IF;
END $$;

-- 3. Supprimer toutes les anciennes politiques pour contest_assets
DROP POLICY IF EXISTS "contest_assets_upload_brand" ON storage.objects;
DROP POLICY IF EXISTS "contest_assets_read_public" ON storage.objects;
DROP POLICY IF EXISTS "contest_assets_update_brand" ON storage.objects;
DROP POLICY IF EXISTS "contest_assets_delete_brand" ON storage.objects;

-- 4. Créer une politique d'upload simplifiée et robuste
-- Cette politique vérifie que :
-- - Le bucket est 'contest_assets'
-- - Le path commence par un contest_id valide
-- - Le concours existe et appartient à l'utilisateur authentifié
CREATE POLICY "contest_assets_upload_brand" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contest_assets'
    AND (
      -- Vérifier que le premier segment du path est un contest_id valide
      -- Path format: {contest_id}/assets/{uuid}_{filename}
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
      -- OU permettre aux admins
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())::uuid
        AND p.role = 'admin'
      )
    )
  );

-- 5. Politique de lecture (authentifiés peuvent lire)
CREATE POLICY "contest_assets_read_public" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'contest_assets');

-- 6. Politique de mise à jour
CREATE POLICY "contest_assets_update_brand" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contest_assets'
    AND (
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())::uuid
        AND p.role = 'admin'
      )
    )
  );

-- 7. Politique de suppression
CREATE POLICY "contest_assets_delete_brand" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contest_assets'
    AND (
      EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())::uuid
        AND p.role = 'admin'
      )
    )
  );

-- 8. Vérifier que les politiques sont créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND polname LIKE 'contest_assets%';
  
  IF policy_count = 4 THEN
    RAISE NOTICE '✅ Toutes les politiques contest_assets ont été créées avec succès (% politiques)', policy_count;
  ELSE
    RAISE WARNING '⚠️ Nombre de politiques inattendu: % (attendu: 4)', policy_count;
  END IF;
END $$;

-- 9. Test de la politique (à exécuter manuellement avec un contest_id et user_id réels)
-- Remplacez les valeurs ci-dessous par des valeurs réelles pour tester
/*
DO $$
DECLARE
  test_contest_id TEXT := '8228520b-261b-4c51-b957-9b8f7d85a8f4';
  test_user_id TEXT := '0b27cb8e-d821-4ab8-9f86-b2ebb0dd54d6';
  test_path TEXT := test_contest_id || '/assets/test-file.jpg';
  contest_exists BOOLEAN;
  user_is_owner BOOLEAN;
BEGIN
  -- Vérifier que le concours existe
  SELECT EXISTS (
    SELECT 1 FROM public.contests 
    WHERE id::text = test_contest_id
  ) INTO contest_exists;
  
  IF NOT contest_exists THEN
    RAISE WARNING 'Le concours % n''existe pas', test_contest_id;
  ELSE
    RAISE NOTICE '✅ Le concours % existe', test_contest_id;
  END IF;
  
  -- Vérifier que l'utilisateur est le propriétaire
  SELECT EXISTS (
    SELECT 1 FROM public.contests 
    WHERE id::text = test_contest_id
    AND brand_id::text = test_user_id
  ) INTO user_is_owner;
  
  IF NOT user_is_owner THEN
    RAISE WARNING 'L''utilisateur % n''est pas le propriétaire du concours %', test_user_id, test_contest_id;
    
    -- Afficher le brand_id actuel du concours
    SELECT brand_id::text INTO test_user_id
    FROM public.contests
    WHERE id::text = test_contest_id;
    
    RAISE NOTICE 'Le brand_id du concours est: %', test_user_id;
  ELSE
    RAISE NOTICE '✅ L''utilisateur % est le propriétaire du concours %', test_user_id, test_contest_id;
  END IF;
  
  -- Tester l'extraction du contest_id du path
  IF split_part(test_path, '/', 1) = test_contest_id THEN
    RAISE NOTICE '✅ L''extraction du contest_id du path fonctionne: %', split_part(test_path, '/', 1);
  ELSE
    RAISE WARNING '❌ L''extraction du contest_id a échoué. Attendu: %, Obtenu: %', 
      test_contest_id, split_part(test_path, '/', 1);
  END IF;
END $$;
*/

