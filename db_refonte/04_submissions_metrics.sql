-- =====================================================
-- 04_submissions_metrics.sql
-- =====================================================
-- Tables de soumissions et métriques (submissions, metrics_daily)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table submissions : soumissions des créateurs
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  platform platform NOT NULL,
  external_url text NOT NULL,
  external_post_id text,
  thumbnail_url text,
  title text,
  status submission_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz DEFAULT NOW() NOT NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Unicité : un créateur ne peut pas soumettre la même URL deux fois pour un concours
  UNIQUE(contest_id, creator_id, external_url)
);

-- Table metrics_daily : métriques quotidiennes des soumissions
CREATE TABLE IF NOT EXISTS public.metrics_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  weighted_views numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Une seule métrique par soumission et par date
  UNIQUE(submission_id, metric_date)
);

-- Index sur submissions
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON public.submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON public.submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_contest_status ON public.submissions(contest_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_status ON public.submissions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_platform ON public.submissions(platform);

-- Index sur metrics_daily
CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_id ON public.metrics_daily(submission_id);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON public.metrics_daily(metric_date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_date ON public.metrics_daily(submission_id, metric_date DESC);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.submissions IS 'Soumissions des créateurs pour les concours';
COMMENT ON TABLE public.metrics_daily IS 'Métriques quotidiennes des soumissions (views, likes, comments, shares)';
COMMENT ON COLUMN public.submissions.external_url IS 'URL externe du post (TikTok, Instagram, YouTube, X)';
COMMENT ON COLUMN public.submissions.external_post_id IS 'ID du post sur la plateforme externe';
COMMENT ON COLUMN public.metrics_daily.weighted_views IS 'Vues pondérées (calculées selon l''algorithme de classement)';
