-- =====================================================
-- 20_assets.sql
-- =====================================================
-- Métadonnées fichiers (au-dessus des buckets Storage)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table assets : métadonnées des fichiers
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Au moins owner_id ou org_id doit être défini
  CONSTRAINT assets_owner_or_org CHECK (
    (owner_id IS NOT NULL AND org_id IS NULL) OR 
    (owner_id IS NULL AND org_id IS NOT NULL) OR 
    (owner_id IS NOT NULL AND org_id IS NOT NULL)
  )
);

-- Index sur assets
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON public.assets(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON public.assets(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_bucket ON public.assets(bucket);
CREATE INDEX IF NOT EXISTS idx_assets_visibility ON public.assets(visibility);
CREATE INDEX IF NOT EXISTS idx_assets_moderation_status ON public.assets(moderation_status);
CREATE INDEX IF NOT EXISTS idx_assets_bucket_path ON public.assets(bucket, path);

-- Contrainte unique sur (bucket, path) avec idempotence
CREATE UNIQUE INDEX IF NOT EXISTS assets_bucket_path_unique 
  ON public.assets(bucket, path)
  WHERE bucket IS NOT NULL AND path IS NOT NULL;

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.assets IS 'Métadonnées des fichiers stockés dans les buckets Storage';
COMMENT ON COLUMN public.assets.owner_id IS 'Propriétaire individuel (nullable si org_id est défini)';
COMMENT ON COLUMN public.assets.org_id IS 'Organisation propriétaire (nullable si owner_id est défini)';
COMMENT ON COLUMN public.assets.bucket IS 'Nom du bucket Storage (avatars, contest_assets, ugc_videos, etc.)';
COMMENT ON COLUMN public.assets.path IS 'Chemin du fichier dans le bucket';
COMMENT ON COLUMN public.assets.sha256 IS 'Hash SHA-256 du fichier pour vérification d''intégrité';
COMMENT ON COLUMN public.assets.visibility IS 'Visibilité: private (défaut) ou public';
COMMENT ON COLUMN public.assets.moderation_status IS 'Statut de modération: pending, approved, rejected';
