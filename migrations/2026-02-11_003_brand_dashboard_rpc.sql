-- Migration: brand dashboard RPC to remove N+1 on metrics aggregation
-- Date: 2026-02-11

CREATE OR REPLACE FUNCTION public.get_brand_dashboard_metrics(p_brand_id uuid)
RETURNS TABLE (
  contest_id uuid,
  title text,
  status contest_status,
  total_views bigint,
  total_submissions bigint,
  pending_submissions bigint,
  budget_spent_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_actor <> p_brand_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = v_actor
         AND p.role = 'admin'
     )
  THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH brand_contests AS (
    SELECT c.id, c.title, c.status
    FROM public.contests c
    WHERE c.brand_id = p_brand_id
  ),
  submission_rollup AS (
    SELECT
      s.contest_id,
      COUNT(DISTINCT s.id)::bigint AS total_submissions,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'pending')::bigint AS pending_submissions,
      COALESCE(SUM(md.views) FILTER (WHERE s.status = 'approved'), 0)::bigint AS total_views
    FROM public.submissions s
    LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
    WHERE s.contest_id IN (SELECT id FROM brand_contests)
    GROUP BY s.contest_id
  ),
  payment_rollup AS (
    SELECT
      pb.contest_id,
      COALESCE(SUM(pb.amount_cents), 0)::bigint AS budget_spent_cents
    FROM public.payments_brand pb
    WHERE pb.brand_id = p_brand_id
      AND pb.status = 'succeeded'
    GROUP BY pb.contest_id
  )
  SELECT
    bc.id AS contest_id,
    bc.title,
    bc.status,
    COALESCE(sr.total_views, 0) AS total_views,
    COALESCE(sr.total_submissions, 0) AS total_submissions,
    COALESCE(sr.pending_submissions, 0) AS pending_submissions,
    COALESCE(pr.budget_spent_cents, 0) AS budget_spent_cents
  FROM brand_contests bc
  LEFT JOIN submission_rollup sr ON sr.contest_id = bc.id
  LEFT JOIN payment_rollup pr ON pr.contest_id = bc.id
  ORDER BY (bc.status = 'active') DESC, bc.id;
END;
$$;

COMMENT ON FUNCTION public.get_brand_dashboard_metrics(uuid)
IS 'Returns per-contest dashboard metrics for a brand in one SQL call (views, submissions, pending, spent budget).';

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.get_brand_dashboard_metrics(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_brand_dashboard_metrics(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.get_brand_dashboard_metrics(uuid) TO service_role;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;
