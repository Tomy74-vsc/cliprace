-- =====================================================
-- 12_storage_policies.sql (corrigé)
-- =====================================================
-- Buckets Storage et politiques d'accès
-- Idempotent : DROP POLICY IF EXISTS + CREATE POLICY
-- =====================================================

-- S'assurer que RLS est activé sur storage.objects (requiert d'être propriétaire)
DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable RLS on storage.objects: %', SQLERRM;
  END;
END $$;

-- Helper: check owner and return early if not owner (per block)
-- Bucket : avatars
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip avatars policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  -- Supprimer si existe, puis créer
  DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
  CREATE POLICY "avatars_upload_own" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

  DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
  CREATE POLICY "avatars_read_public" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'avatars');

  DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
  CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

  DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
  CREATE POLICY "avatars_delete_own" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'avatars policies: %', SQLERRM;
END $$;

-- Bucket : contest_assets
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

  DROP POLICY IF EXISTS "contest_assets_upload_brand" ON storage.objects;
  CREATE POLICY "contest_assets_upload_brand" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "contest_assets_read_public" ON storage.objects;
  CREATE POLICY "contest_assets_read_public" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'contest_assets');

  DROP POLICY IF EXISTS "contest_assets_update_brand" ON storage.objects;
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

  DROP POLICY IF EXISTS "contest_assets_delete_brand" ON storage.objects;
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'contest_assets policies: %', SQLERRM;
END $$;

-- Bucket : ugc_videos
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip ugc_videos policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "ugc_videos_upload_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_upload_creator" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_read_approved" ON storage.objects;
  CREATE POLICY "ugc_videos_read_approved" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.status = 'approved'
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_update_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_update_creator" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_delete_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_delete_creator" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ugc_videos policies: %', SQLERRM;
END $$;

-- Bucket : invoices
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip invoices policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  -- Policy d'INSERT pour service role uniquement (génération automatique)
  DROP POLICY IF EXISTS "invoices_insert_service_role" ON storage.objects;
  CREATE POLICY "invoices_insert_service_role" ON storage.objects
    FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'invoices');

  -- Policy de lecture : les marques peuvent lire leurs propres factures
  -- Structure: {brand_id}/invoices/{filename}
  DROP POLICY IF EXISTS "invoices_read_own" ON storage.objects;
  CREATE POLICY "invoices_read_own" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'invoices'
      AND (
        -- Structure: {brand_id}/invoices/{filename}
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        -- Ou via payments_brand (fallback pour compatibilité)
        OR EXISTS (
          SELECT 1 FROM public.payments_brand pb
          WHERE pb.brand_id = (SELECT auth.uid())::uuid
          AND pb.metadata->>'invoice_pdf_url' LIKE '%' || name || '%'
        )
      )
    );

  DROP POLICY IF EXISTS "invoices_admin_all" ON storage.objects;
  CREATE POLICY "invoices_admin_all" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'invoices'
      AND public.is_admin((SELECT auth.uid())::uuid)
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'invoices policies: %', SQLERRM;
END $$;

-- Commentaires (créez-les uniquement si la policy existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='avatars_upload_own') THEN
    COMMENT ON POLICY "avatars_upload_own" ON storage.objects IS 'Users can upload their own avatars';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='contest_assets_read_public') THEN
    COMMENT ON POLICY "contest_assets_read_public" ON storage.objects IS 'Contest assets are publicly readable';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='ugc_videos_read_approved') THEN
    COMMENT ON POLICY "ugc_videos_read_approved" ON storage.objects IS 'UGC videos are publicly readable if submission is approved';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='invoices_read_own') THEN
    COMMENT ON POLICY "invoices_read_own" ON storage.objects IS 'Users can read their own invoices';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comments on policies: %', SQLERRM;
END $$;