-- =====================================================
-- 35_weighted_views_calculation.sql
-- =====================================================
-- Fonction de calcul du score pondéré et trigger automatique
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction calculate_weighted_views : calcule le score pondéré
CREATE OR REPLACE FUNCTION public.calculate_weighted_views(
  p_views integer,
  p_likes integer,
  p_comments integer,
  p_shares integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Formule : views + (likes * 2) + (comments * 3) + (shares * 5)
  -- Les partages ont le plus de poids car ils génèrent le plus d'engagement
  RETURN COALESCE(p_views, 0)::numeric + 
         (COALESCE(p_likes, 0)::numeric * 2) + 
         (COALESCE(p_comments, 0)::numeric * 3) + 
         (COALESCE(p_shares, 0)::numeric * 5);
END;
$$;

COMMENT ON FUNCTION public.calculate_weighted_views(integer, integer, integer, integer) IS 
  'Calcule le score pondéré: views + (likes * 2) + (comments * 3) + (shares * 5)';

-- Fonction update_weighted_views : trigger pour calculer automatiquement weighted_views
CREATE OR REPLACE FUNCTION public.update_weighted_views()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.weighted_views := public.calculate_weighted_views(
    NEW.views,
    NEW.likes,
    NEW.comments,
    NEW.shares
  );
  
  -- Mettre à jour calculated_at si c'est une nouvelle insertion
  IF TG_OP = 'INSERT' OR OLD.weighted_views IS NULL OR OLD.weighted_views != NEW.weighted_views THEN
    NEW.calculated_at := public.now_utc();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_weighted_views() IS 'Trigger pour calculer automatiquement weighted_views et calculated_at';

-- Trigger pour metrics_daily
DROP TRIGGER IF EXISTS update_metrics_daily_weighted_views ON public.metrics_daily;
CREATE TRIGGER update_metrics_daily_weighted_views
  BEFORE INSERT OR UPDATE OF views, likes, comments, shares ON public.metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_weighted_views();

-- Fonction helper pour recalculer tous les weighted_views d'une soumission
CREATE OR REPLACE FUNCTION public.recalculate_submission_metrics(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.metrics_daily
  SET 
    weighted_views = public.calculate_weighted_views(views, likes, comments, shares),
    calculated_at = public.now_utc(),
    updated_at = public.now_utc()
  WHERE submission_id = p_submission_id;
END;
$$;

COMMENT ON FUNCTION public.recalculate_submission_metrics(uuid) IS 'Recalcule tous les weighted_views d''une soumission';

-- Fonction pour obtenir le score total d'un créateur dans un concours
CREATE OR REPLACE FUNCTION public.get_creator_contest_score(p_contest_id uuid, p_creator_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(md.weighted_views), 0)
  FROM public.submissions s
  INNER JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE s.contest_id = p_contest_id
    AND s.creator_id = p_creator_id
    AND s.status = 'approved';
$$;

COMMENT ON FUNCTION public.get_creator_contest_score(uuid, uuid) IS 'Retourne le score total pondéré d''un créateur dans un concours';
