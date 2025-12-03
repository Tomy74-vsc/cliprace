-- =====================================================
-- 12a_create_contest_assets_bucket.sql
-- =====================================================
-- Création idempotente du bucket 'contest_assets' pour stocker les assets des concours
-- (images, vidéos, PDFs, logos produits, etc.)
-- =====================================================

-- 1) Vérifier que la table storage.buckets existe avant d'essayer d'insérer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'buckets'
      AND n.nspname = 'storage'
  ) THEN
    -- 2) Insérer ou mettre à jour le bucket
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'contest_assets',
        'contest_assets',
        true,                  -- public (les assets des concours sont accessibles publiquement)
        209715200,            -- 200 MB (limite mentionnée dans l'UI)
        ARRAY[
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/webm',
          'video/quicktime',
          'application/pdf'
        ]::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

      RAISE NOTICE 'Bucket contest_assets créé ou mis à jour.';
    EXCEPTION WHEN others THEN
      -- Attraper les erreurs d'autorisation ou autres et les relayer proprement
      RAISE NOTICE 'Échec de l''insertion/mise à jour du bucket contest_assets : %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La table storage.buckets n''existe pas ; aucune action effectuée.';
  END IF;
END;
$$ LANGUAGE plpgsql;

