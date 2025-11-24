-- =====================================================
-- 33_analytics_materialized.sql
-- =====================================================
-- Vues matérialisées pour analytics et dashboards optimisés
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Vue matérialisée : Résumé dashboard marque
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_dashboard_summary AS
SELECT 
  c.brand_id,
  COUNT(*) FILTER (WHERE c.status = 'active') AS active_contests,
  COUNT(*) FILTER (WHERE c.status = 'ended') AS ended_contests,
  COUNT(*) FILTER (WHERE c.status = 'draft') AS draft_contests,
  SUM(c.prize_pool_cents) AS total_prize_pool_cents,
  SUM(c.budget_cents) AS total_budget_cents,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.creator_id) AS total_creators,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  MAX(c.updated_at) AS last_contest_updated
FROM public.contests c
LEFT JOIN public.submissions s ON s.contest_id = c.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
GROUP BY c.brand_id;

-- Index sur brand_dashboard_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_dashboard_summary_brand_id 
  ON public.brand_dashboard_summary(brand_id);

-- Vue matérialisée : Résumé dashboard créateur
CREATE MATERIALIZED VIEW IF NOT EXISTS public.creator_dashboard_summary AS
SELECT 
  s.creator_id,
  COUNT(DISTINCT s.contest_id) AS contests_participated,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(*) FILTER (WHERE s.status = 'approved') AS approved_submissions,
  COUNT(*) FILTER (WHERE s.status = 'pending') AS pending_submissions,
  COUNT(*) FILTER (WHERE s.status = 'rejected') AS rejected_submissions,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  COALESCE(SUM(cw.payout_cents), 0) AS total_earnings_cents,
  COUNT(DISTINCT cw.contest_id) FILTER (WHERE cw.payout_cents > 0) AS contests_won,
  MAX(s.updated_at) AS last_submission_updated
FROM public.submissions s
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
LEFT JOIN public.contest_winnings cw ON cw.creator_id = s.creator_id
GROUP BY s.creator_id;

-- Index sur creator_dashboard_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_dashboard_summary_creator_id 
  ON public.creator_dashboard_summary(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_dashboard_summary_earnings 
  ON public.creator_dashboard_summary(total_earnings_cents DESC);

-- Vue matérialisée : Statistiques globales plateforme
CREATE MATERIALIZED VIEW IF NOT EXISTS public.platform_stats_summary AS
SELECT 
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'brand') AS total_brands,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'creator') AS total_creators,
  COUNT(DISTINCT c.id) AS total_contests,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'approved') AS approved_submissions,
  COALESCE(SUM(c.prize_pool_cents), 0) AS total_prize_pool_cents,
  COALESCE(SUM(cw.payout_cents), 0) AS total_paid_cents,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  MAX(c.created_at) AS last_contest_created,
  MAX(s.created_at) AS last_submission_created
FROM public.profiles p
LEFT JOIN public.contests c ON c.brand_id = p.id
LEFT JOIN public.submissions s ON s.creator_id = p.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
LEFT JOIN public.contest_winnings cw ON cw.creator_id = p.id;

-- Index unique requis pour REFRESH CONCURRENTLY (vue singleton)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_stats_summary_singleton 
  ON public.platform_stats_summary(total_contests);

-- Commentaires
COMMENT ON MATERIALIZED VIEW public.brand_dashboard_summary IS 'Résumé des statistiques par marque (dashboard optimisé)';
COMMENT ON MATERIALIZED VIEW public.creator_dashboard_summary IS 'Résumé des statistiques par créateur (dashboard optimisé)';
COMMENT ON MATERIALIZED VIEW public.platform_stats_summary IS 'Statistiques globales de la plateforme';

-- Fonction pour rafraîchir toutes les vues matérialisées analytics
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.platform_stats_summary;
$$;

COMMENT ON FUNCTION public.refresh_analytics_views() IS 'Rafraîchit toutes les vues matérialisées analytics';
