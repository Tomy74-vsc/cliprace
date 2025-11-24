-- =====================================================
-- 03_contests.sql
-- =====================================================
-- Tables de concours (contests, contest_terms, contest_assets)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table contest_terms : versions des CGU
CREATE TABLE IF NOT EXISTS public.contest_terms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  terms_markdown text,
  terms_url text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  UNIQUE(version)
);

-- Table contests : concours créés par les marques
CREATE TABLE IF NOT EXISTS public.contests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  brief_md text,
  cover_url text,
  status contest_status NOT NULL DEFAULT 'draft',
  budget_cents integer NOT NULL DEFAULT 0,
  prize_pool_cents integer NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  networks platform[] DEFAULT ARRAY[]::platform[],
  max_winners integer DEFAULT 1,
  contest_terms_id uuid REFERENCES public.contest_terms(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT contests_ends_after_starts CHECK (end_at > start_at),
  CONSTRAINT contests_positive_budget CHECK (budget_cents >= 0),
  CONSTRAINT contests_positive_prize CHECK (prize_pool_cents >= 0),
  CONSTRAINT contests_max_winners_positive CHECK (max_winners > 0)
);

-- Table contest_assets : assets associés aux concours (images, vidéos, PDFs)
CREATE TABLE IF NOT EXISTS public.contest_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video', 'pdf')),
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur contests
CREATE INDEX IF NOT EXISTS idx_contests_brand_id ON public.contests(brand_id);
CREATE INDEX IF NOT EXISTS idx_contests_status ON public.contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_start_at ON public.contests(start_at);
CREATE INDEX IF NOT EXISTS idx_contests_brand_status ON public.contests(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_contests_active_dates ON public.contests(start_at, end_at) WHERE status = 'active';

-- Index sur contest_assets
CREATE INDEX IF NOT EXISTS idx_contest_assets_contest_id ON public.contest_assets(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_assets_type ON public.contest_assets(type);

-- Enable RLS
ALTER TABLE public.contest_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_assets ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contests IS 'Concours créés par les marques';
COMMENT ON TABLE public.contest_terms IS 'Versions des conditions générales d''utilisation des concours';
COMMENT ON TABLE public.contest_assets IS 'Assets associés aux concours (images, vidéos, PDFs)';
COMMENT ON COLUMN public.contests.slug IS 'Slug unique pour l''URL du concours';
COMMENT ON COLUMN public.contests.networks IS 'Tableau des plateformes acceptées pour ce concours';
COMMENT ON COLUMN public.contests.max_winners IS 'Nombre maximum de gagnants';
