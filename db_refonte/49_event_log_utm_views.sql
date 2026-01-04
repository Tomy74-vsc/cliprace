-- =====================================================
-- 49_event_log_utm_views.sql
-- =====================================================
-- UTM / tracking helpers (based on event_log.properties).
-- event_log already has a GIN index on properties.
-- =====================================================

CREATE OR REPLACE VIEW public.event_log_utm AS
SELECT
  id,
  user_id,
  org_id,
  event_name,
  created_at,
  properties,
  NULLIF(properties->>'utm_source', '')   AS utm_source,
  NULLIF(properties->>'utm_medium', '')   AS utm_medium,
  NULLIF(properties->>'utm_campaign', '') AS utm_campaign,
  NULLIF(properties->>'utm_content', '')  AS utm_content,
  NULLIF(properties->>'utm_term', '')     AS utm_term
FROM public.event_log;

CREATE OR REPLACE VIEW public.event_log_utm_daily AS
SELECT
  date_trunc('day', created_at)::date AS metric_date,
  org_id,
  utm_source,
  utm_medium,
  utm_campaign,
  count(*)::bigint AS events
FROM public.event_log_utm
GROUP BY 1,2,3,4,5;

