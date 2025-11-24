-- =====================================================
-- 09_functions_business.sql
-- =====================================================
-- Fonctions métier (compute_payouts, gestion statuts concours, KPIs)
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction compute_payouts : calcule la répartition des gains selon les poids
-- Répartition proportionnelle sur Top N (max_winners) selon score pondéré
CREATE OR REPLACE FUNCTION public.compute_payouts(p_contest_id uuid)
RETURNS TABLE (
  creator_id uuid,
  rank integer,
  weighted_views numeric,
  payout_cents integer,
  payout_percentage numeric
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest RECORD;
  v_prize_pool_cents integer;
  v_max_winners integer;
  v_total_weighted numeric;
BEGIN
  -- Récupérer les infos du concours
  SELECT prize_pool_cents, max_winners INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;
  
  v_prize_pool_cents := v_contest.prize_pool_cents;
  v_max_winners := v_contest.max_winners;
  
  -- Calculer le total des weighted_views pour les Top N
  SELECT COALESCE(SUM(total_weighted_views), 0) INTO v_total_weighted
  FROM (
    SELECT total_weighted_views
    FROM public.leaderboard
    WHERE contest_id = p_contest_id
    ORDER BY total_weighted_views DESC
    LIMIT v_max_winners
  ) top_creators;
  
  -- Retourner le classement avec les payouts proportionnels
  RETURN QUERY
  SELECT 
    l.creator_id,
    ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC)::integer AS rank,
    l.total_weighted_views,
    CASE 
      WHEN v_total_weighted > 0 AND ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC) <= v_max_winners
      THEN (l.total_weighted_views / v_total_weighted * v_prize_pool_cents)::integer
      ELSE 0
    END AS payout_cents,
    CASE 
      WHEN v_total_weighted > 0 AND ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC) <= v_max_winners
      THEN (l.total_weighted_views / v_total_weighted * 100)::numeric(5, 2)
      ELSE 0::numeric(5, 2)
    END AS payout_percentage
  FROM public.leaderboard l
  WHERE l.contest_id = p_contest_id
  ORDER BY l.total_weighted_views DESC
  LIMIT v_max_winners;
END;
$$;

COMMENT ON FUNCTION public.compute_payouts(uuid) IS 'Calcule la répartition proportionnelle des gains sur Top N selon score pondéré';

-- Fonction pour vérifier si un concours est actif
CREATE OR REPLACE FUNCTION public.is_contest_active(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.contests 
    WHERE id = p_contest_id 
    AND status = 'active'
    AND start_at <= public.now_utc()
    AND end_at >= public.now_utc()
  );
$$;

COMMENT ON FUNCTION public.is_contest_active(uuid) IS 'Vérifie si un concours est actif (status=active et dates valides)';

-- Fonction pour obtenir les métriques d'un concours (pour dashboard marque)
CREATE OR REPLACE FUNCTION public.get_contest_metrics(p_contest_id uuid)
RETURNS TABLE (
  contest_id uuid,
  total_submissions bigint,
  approved_submissions bigint,
  total_creators bigint,
  total_views numeric,
  total_likes numeric,
  total_comments numeric,
  total_shares numeric,
  total_weighted_views numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    COUNT(DISTINCT s.id) AS total_submissions,
    COUNT(DISTINCT CASE WHEN s.status = 'approved' THEN s.id END) AS approved_submissions,
    COUNT(DISTINCT s.creator_id) AS total_creators,
    COALESCE(SUM(md.views), 0) AS total_views,
    COALESCE(SUM(md.likes), 0) AS total_likes,
    COALESCE(SUM(md.comments), 0) AS total_comments,
    COALESCE(SUM(md.shares), 0) AS total_shares,
    COALESCE(SUM(md.weighted_views), 0) AS total_weighted_views
  FROM public.contests c
  LEFT JOIN public.submissions s ON s.contest_id = c.id
  LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE c.id = p_contest_id
  GROUP BY c.id;
$$;

COMMENT ON FUNCTION public.get_contest_metrics(uuid) IS 'Retourne les métriques agrégées d''un concours (pour dashboard marque)';

-- Fonction pour obtenir le classement d'un concours
CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_contest_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE (
  creator_id uuid,
  rank integer,
  total_weighted_views numeric,
  total_views numeric,
  total_likes numeric,
  total_comments numeric,
  total_shares numeric,
  submission_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.creator_id,
    ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC)::integer AS rank,
    l.total_weighted_views,
    l.total_views,
    l.total_likes,
    l.total_comments,
    l.total_shares,
    l.submission_count
  FROM public.leaderboard l
  WHERE l.contest_id = p_contest_id
  ORDER BY l.total_weighted_views DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_contest_leaderboard(uuid, integer) IS 'Retourne le classement d''un concours (Top N)';
