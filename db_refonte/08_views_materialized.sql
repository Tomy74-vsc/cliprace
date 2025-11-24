-- =====================================================
-- 08_views_materialized.sql
-- =====================================================
-- Vues et vues matérialisées (leaderboard, contest_stats)
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Vue leaderboard : classement agrégé par concours et créateur
-- Agrégation des weighted_views depuis metrics_daily pour les soumissions approuvées
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  s.contest_id,
  s.creator_id,
  SUM(md.weighted_views) AS total_weighted_views,
  SUM(md.views) AS total_views,
  SUM(md.likes) AS total_likes,
  SUM(md.comments) AS total_comments,
  SUM(md.shares) AS total_shares,
  COUNT(DISTINCT s.id) AS submission_count
FROM public.submissions s
INNER JOIN public.metrics_daily md ON md.submission_id = s.id
WHERE s.status = 'approved'
GROUP BY s.contest_id, s.creator_id;

COMMENT ON VIEW public.leaderboard IS 'Classement agrégé par concours et créateur (weighted_views depuis metrics_daily)';

-- Vue contest_stats : statistiques agrégées par concours
CREATE OR REPLACE VIEW public.contest_stats AS
SELECT 
  c.id AS contest_id,
  c.title,
  c.status,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.creator_id) AS total_creators,
  COUNT(DISTINCT CASE WHEN s.status = 'approved' THEN s.id END) AS approved_submissions,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  COALESCE(SUM(md.weighted_views), 0) AS total_weighted_views
FROM public.contests c
LEFT JOIN public.submissions s ON s.contest_id = c.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
GROUP BY c.id, c.title, c.status;

COMMENT ON VIEW public.contest_stats IS 'Statistiques agrégées par concours (KPIs)';

-- Optionnel : Vue matérialisée pour meilleures performances
-- À rafraîchir périodiquement (via cron ou trigger)
DO $$ 
BEGIN
  CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_materialized AS
  SELECT 
    s.contest_id,
    s.creator_id,
    SUM(md.weighted_views) AS total_weighted_views,
    SUM(md.views) AS total_views,
    SUM(md.likes) AS total_likes,
    SUM(md.comments) AS total_comments,
    SUM(md.shares) AS total_shares,
    COUNT(DISTINCT s.id) AS submission_count,
    MAX(md.metric_date) AS last_metric_date
  FROM public.submissions s
  INNER JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE s.status = 'approved'
  GROUP BY s.contest_id, s.creator_id;
  
  -- Index sur la vue matérialisée
  CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_materialized_contest_creator 
    ON public.leaderboard_materialized(contest_id, creator_id);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_materialized_contest_views 
    ON public.leaderboard_materialized(contest_id, total_weighted_views DESC);
EXCEPTION 
  WHEN duplicate_table THEN NULL;
END $$;

COMMENT ON MATERIALIZED VIEW public.leaderboard_materialized IS 'Vue matérialisée du classement (rafraîchie périodiquement)';

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_materialized;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard() IS 'Rafraîchit la vue matérialisée leaderboard_materialized';
