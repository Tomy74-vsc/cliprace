-- =====================================================
-- 28_tags_categories.sql
-- =====================================================
-- Système de tags/catégories pour organiser les concours
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table contest_tags : tags/catégories disponibles
CREATE TABLE IF NOT EXISTS public.contest_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  color text, -- Couleur hex pour l'UI (ex: '#FF5733')
  icon_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table contest_tag_links : liens entre concours et tags
CREATE TABLE IF NOT EXISTS public.contest_tag_links (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.contest_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (contest_id, tag_id)
);

-- Index sur contest_tags
CREATE INDEX IF NOT EXISTS idx_contest_tags_slug ON public.contest_tags(slug);
CREATE INDEX IF NOT EXISTS idx_contest_tags_is_active ON public.contest_tags(is_active) WHERE is_active = true;

-- Index sur contest_tag_links
CREATE INDEX IF NOT EXISTS idx_contest_tag_links_contest_id ON public.contest_tag_links(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_tag_links_tag_id ON public.contest_tag_links(tag_id);

-- Enable RLS
ALTER TABLE public.contest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_tag_links ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_tags IS 'Tags/catégories pour organiser et rechercher les concours';
COMMENT ON TABLE public.contest_tag_links IS 'Liens entre concours et tags (many-to-many)';
COMMENT ON COLUMN public.contest_tags.slug IS 'Slug unique pour l''URL (ex: "fashion", "tech")';
COMMENT ON COLUMN public.contest_tags.color IS 'Couleur hex pour l''interface (ex: "#FF5733")';
COMMENT ON COLUMN public.contest_tags.icon_url IS 'URL de l''icône du tag';
