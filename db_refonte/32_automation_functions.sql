-- =====================================================
-- 32_automation_functions.sql
-- =====================================================
-- Fonctions d'automatisation (cron jobs) pour maintenance
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction finalize_contest : finalise un concours et calcule les gains
CREATE OR REPLACE FUNCTION public.finalize_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payouts RECORD;
  v_contest RECORD;
BEGIN
  -- Récupérer les infos du concours
  SELECT id, status, prize_pool_cents INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;
  
  IF v_contest.status != 'active' THEN
    RAISE EXCEPTION 'Contest must be active to be finalized. Current status: %', v_contest.status;
  END IF;
  
  -- Marquer le concours comme terminé
  UPDATE public.contests
  SET status = 'ended', updated_at = public.now_utc()
  WHERE id = p_contest_id;
  
  -- Calculer et stocker les gains
  FOR v_payouts IN
    SELECT * FROM public.compute_payouts(p_contest_id)
  LOOP
    INSERT INTO public.contest_winnings (
      contest_id,
      creator_id,
      rank,
      payout_cents,
      payout_percentage,
      calculated_at
    )
    VALUES (
      p_contest_id,
      v_payouts.creator_id,
      v_payouts.rank,
      v_payouts.payout_cents,
      v_payouts.payout_percentage,
      public.now_utc()
    )
    ON CONFLICT (contest_id, creator_id) DO UPDATE
    SET
      rank = EXCLUDED.rank,
      payout_cents = EXCLUDED.payout_cents,
      payout_percentage = EXCLUDED.payout_percentage,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = public.now_utc();
  END LOOP;
  
  -- Logger l'action
  INSERT INTO public.status_history (table_name, row_id, old_status, new_status, changed_by)
  VALUES ('contests', p_contest_id, 'active', 'ended', auth.uid());
END;
$$;

COMMENT ON FUNCTION public.finalize_contest(uuid) IS 'Finalise un concours actif, calcule et stocke les gains des gagnants';

-- Fonction archive_ended_contests : archive les concours terminés depuis plus de 30 jours
CREATE OR REPLACE FUNCTION public.archive_ended_contests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
  v_now timestamptz := public.now_utc();
BEGIN
  UPDATE public.contests
  SET status = 'archived', updated_at = v_now
  WHERE status = 'ended'
    AND end_at < v_now - INTERVAL '30 days';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Logger les archivages
  INSERT INTO public.status_history (table_name, row_id, old_status, new_status, created_at)
  SELECT 
    'contests',
    id,
    'ended',
    'archived',
    v_now
  FROM public.contests
  WHERE status = 'archived'
    AND updated_at = v_now;
  
  RETURN archived_count;
END;
$$;

COMMENT ON FUNCTION public.archive_ended_contests() IS 'Archive automatiquement les concours terminés depuis plus de 30 jours';

-- Fonction compute_daily_metrics : calcul des métriques quotidiennes (à appeler via cron)
-- Note: Cette fonction doit être complétée selon la logique d'ingestion depuis les APIs
CREATE OR REPLACE FUNCTION public.compute_daily_metrics(p_submission_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_metrics_date date;
BEGIN
  v_metrics_date := CURRENT_DATE;
  
  -- Si submission_id est fourni, calculer pour cette soumission uniquement
  IF p_submission_id IS NOT NULL THEN
    SELECT * INTO v_submission
    FROM public.submissions
    WHERE id = p_submission_id AND status = 'approved';
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Submission not found or not approved: %', p_submission_id;
    END IF;
    
    -- Logique d'ingestion depuis les APIs plateformes
    -- À compléter selon les besoins (TikTok, Instagram, YouTube APIs)
    -- Pour l'instant, cette fonction est un placeholder
    
    RAISE NOTICE 'Metrics computation for submission % not yet implemented', p_submission_id;
  ELSE
    -- Calculer pour toutes les soumissions approuvées du jour
    -- À compléter selon les besoins
    RAISE NOTICE 'Bulk metrics computation not yet implemented';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.compute_daily_metrics(uuid) IS 'Calcule les métriques quotidiennes pour une soumission (à compléter avec logique d''ingestion APIs)';

-- Fonction refresh_all_materialized_views : rafraîchit toutes les vues matérialisées
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rafraîchir leaderboard_materialized
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'leaderboard_materialized') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_materialized;
  END IF;
  
  -- Rafraîchir brand_dashboard_summary (si existe)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'brand_dashboard_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_dashboard_summary;
  END IF;
  
  -- Rafraîchir creator_dashboard_summary (si existe)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'creator_dashboard_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_dashboard_summary;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refresh_all_materialized_views() IS 'Rafraîchit toutes les vues matérialisées de la base';

-- Fonction cleanup_old_data : nettoie les données anciennes
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS TABLE (
  cleaned_audit_logs bigint,
  cleaned_event_log bigint,
  cleaned_status_history bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_count bigint;
  event_count bigint;
  status_count bigint;
BEGIN
  -- Nettoyer audit_logs de plus de 1 an
  DELETE FROM public.audit_logs 
  WHERE created_at < public.now_utc() - INTERVAL '1 year';
  GET DIAGNOSTICS audit_count = ROW_COUNT;
  
  -- Nettoyer event_log de plus de 6 mois
  DELETE FROM public.event_log 
  WHERE created_at < public.now_utc() - INTERVAL '6 months';
  GET DIAGNOSTICS event_count = ROW_COUNT;
  
  -- Nettoyer status_history de plus de 1 an
  DELETE FROM public.status_history 
  WHERE created_at < public.now_utc() - INTERVAL '1 year';
  GET DIAGNOSTICS status_count = ROW_COUNT;
  
  RETURN QUERY SELECT audit_count, event_count, status_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_data() IS 'Nettoie les données anciennes (audit_logs, event_log, status_history)';
