-- =====================================================
-- 12c_fix_contest_assets_rls.sql
-- =====================================================
-- Correction des politiques RLS pour le bucket contest_assets
-- Utilise split_part() au lieu de storage.foldername() pour plus de fiabilité
-- =====================================================

-- S'assurer que RLS est activé sur storage.objects
DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable RLS on storage.objects: %', SQLERRM;
  END;
END $$;

-- Bucket : contest_assets (version corrigée)
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip contest_assets policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  -- Supprimer les anciennes politiques
  DROP POLICY IF EXISTS "contest_assets_upload_brand" ON storage.objects;
  DROP POLICY IF EXISTS "contest_assets_read_public" ON storage.objects;
  DROP POLICY IF EXISTS "contest_assets_update_brand" ON storage.objects;
  DROP POLICY IF EXISTS "contest_assets_delete_brand" ON storage.objects;

  -- Politique d'upload : les marques peuvent uploader pour leurs propres concours
  -- Path format: {contest_id}/assets/{uuid}_{filename}
  -- Utilise split_part() pour extraire le contest_id (plus fiable que storage.foldername())
  -- Note: name est le chemin complet du fichier dans le bucket
  CREATE POLICY "contest_assets_upload_brand" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'contest_assets'
      AND (
        -- Vérifier que le concours existe et que l'utilisateur est le propriétaire
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

  -- Politique de lecture : lecture publique des assets (authentifiés)
  CREATE POLICY "contest_assets_read_public" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'contest_assets');

  -- Politique de mise à jour : les marques peuvent modifier leurs propres assets
  CREATE POLICY "contest_assets_update_brand" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );

  -- Politique de suppression : les marques peuvent supprimer leurs propres assets
  CREATE POLICY "contest_assets_delete_brand" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );

  RAISE NOTICE 'Politiques RLS pour contest_assets créées avec succès.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors de la création des politiques contest_assets: %', SQLERRM;
END $$;

