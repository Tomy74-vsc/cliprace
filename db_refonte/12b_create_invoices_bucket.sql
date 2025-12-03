-- =====================================================
-- 12b_create_invoices_bucket.sql (corrigé)
-- =====================================================
-- Création idempotente du bucket 'invoices' pour stocker les factures PDF
-- Remarque : n'exécutez COMMENT ON TABLE que si vous êtes propriétaire/superuser.
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
        'invoices',
        'invoices',
        false,                 -- privé
        10485760,              -- 10 MB
        ARRAY['application/pdf']::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

      RAISE NOTICE 'Bucket invoices créé ou mis à jour.';
    EXCEPTION WHEN others THEN
      -- Attraper les erreurs d'autorisation ou autres et les relayer proprement
      RAISE NOTICE 'Échec de l''insertion/mise à jour du bucket invoices : %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La table storage.buckets n''existe pas ; aucune action effectuée.';
  END IF;
END;
$$ LANGUAGE plpgsql;