const fs = require('fs');
const path = require('path');

const repo = process.cwd();
const dbDir = path.join(repo, 'db_refonte');

// Canonical baseline order (explicit and dependency-safe)
const includeFiles = [
  '00_extensions_enums.sql',
  '02_profiles.sql',
  '01_functions_core.sql',
  '03_contests.sql',
  '04_submissions_metrics.sql',
  '05_payments_cashouts.sql',
  // optional extension: 4-eyes table (kept, but policies will be added in patch)
  '05_payments_cashouts_4eyes.sql',
  '06_moderation_audit.sql',
  '07_messaging_notifications.sql',
  '15_orgs.sql',
  '16_platform_links.sql',
  '17_notification_center.sql',
  '18_invoices_billing.sql',
  '19_kyc_risk.sql',
  '20_assets.sql',
  '21_moderation_history.sql',
  '22_messaging.sql',
  '23_webhooks_outbound.sql',
  '24_event_log.sql',
  '25_contest_prizes_winnings.sql',
  '26_contest_terms_acceptances.sql',
  '27_follows_favorites.sql',
  '28_tags_categories.sql',
  '29_status_history.sql',
  '30_submission_comments.sql',
  '31_notification_templates.sql',
  '36_messages_attachments.sql',
  '38_rate_limits.sql',
  '39_admin_tables.sql',
  '41_admin_saved_views.sql',
  '41_admin_saved_views_team_personal.sql',
  '42_admin_rbac.sql',
  '42_admin_rbac_break_glass.sql',
  '43_admin_inbox_permissions.sql',
  '44_admin_guide_permissions.sql',
  '45_moderation_rules_lifecycle.sql',
  '46_ingestion_errors_resolution.sql',
  '47_admin_ops_data.sql',
  '48_marketing_campaigns.sql',
  '49_event_log_utm_views.sql',
  '54_admin_mfa.sql',
  '54_status_history_generalized.sql',
  '55_admin_contest_publish_transaction.sql',
  '56_admin_contest_end_transaction.sql',
  // optional hardening
  '57_admin_aal2_rls.sql',
  // business / analytics
  '08_views_materialized.sql',
  '09_functions_business.sql',
  '33_analytics_materialized.sql',
  '34_submission_limits.sql',
  '35_weighted_views_calculation.sql',
  '32_automation_functions.sql',
  '37_create_contest_complete.sql',
  // security model + storage
  '11_rls_policies.sql',
  '10_triggers.sql',
  '12_public_profiles_view.sql',
  '12_storage_policies.sql',
  '12a_create_contest_assets_bucket.sql',
  '12b_create_invoices_bucket.sql'
];

// Migrations to append into BASELINE.sql (requested)
const includeMigrations = [
  'migrations/001_p0_security_definer_lockdown.sql',
  'migrations/002_p0_storage_policies.sql',
  'migrations/003_p0_cashout_reviews_policies.sql',
  'migrations/010_p1_brand_moderation.sql',
  'migrations/011_p1_cashout_integrity.sql',
  'migrations/020_p1_admin_workflows.sql',
  'migrations/021_p1_analytics_safe.sql',
  'migrations/022_p1_platform_settings_cleanup.sql',
  'migrations/023_p2_privacy_policies.sql',
  'migrations/030_p2_indexes.sql'
];

function read(file){
  return fs.readFileSync(path.join(dbDir, file), 'utf8').replace(/\uFEFF/g,'');
}

function readFromRepo(relPath){
  return fs.readFileSync(path.join(repo, relPath), 'utf8').replace(/\uFEFF/g,'');
}

let out = '';
out += '-- =====================================================\n';
out += '-- BASELINE.sql (generated)\n';
out += '-- =====================================================\n';
out += '-- Canonical baseline for Supabase/Postgres (schema + RLS + storage + core functions).\n';
out += '-- Source: db_refonte/*.sql + migrations/*.sql (with a few safety patches appended).\n';
out += '-- NOTE: Some legacy scripts are intentionally NOT included: 00_platform_settings_readonly.sql, 51_admin_transactions.sql, 52_admin_kpi_materialized.sql, 53_admin_indexes_search.sql, 12c/12e contest_assets hotfixes.\n';
out += '-- =====================================================\n\n';

for(const f of includeFiles){
  const p = path.join(dbDir,f);
  if(!fs.existsSync(p)) throw new Error('Missing file: '+f);
  out += `\n-- ------------------------------\n-- BEGIN ${f}\n-- ------------------------------\n`;
  out += read(f).trimEnd() + '\n';
  out += `-- ------------------------------\n-- END ${f}\n-- ------------------------------\n\n`;
}

// Patches: platform_settings seed (avoid conflicting table definition in 00_platform_settings_readonly.sql)
out += `\n-- =====================================================\n-- PATCHES (baseline safety + consistency)\n-- =====================================================\n\n`;
out += `-- Ensure platform_settings has the maintenance flag (admin_read_only)\n`;
out += `INSERT INTO public.platform_settings (key, value, description)\nVALUES ('admin_read_only', 'false'::jsonb, 'Admin read-only mode (maintenance)')\nON CONFLICT (key) DO NOTHING;\n\n`;

// Patches: missing policies for cashout_reviews
out += `-- cashout_reviews: RLS was enabled but no policies existed in the repo.\n`;
out += `DO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='cashout_reviews') THEN\n    ALTER TABLE public.cashout_reviews ENABLE ROW LEVEL SECURITY;\n    DROP POLICY IF EXISTS "cashout_reviews_admin_all" ON public.cashout_reviews;\n    CREATE POLICY "cashout_reviews_admin_all" ON public.cashout_reviews\n      FOR ALL\n      USING (public.is_admin(auth.uid()))\n      WITH CHECK (public.is_admin(auth.uid()));\n  END IF;\nEND $$;\n\n`;

// Patches: fix broken admin KPI mat views (52_admin_kpi_materialized.sql had schema mismatches)
out += `-- Admin KPI materialized views (fixed version of 52_admin_kpi_materialized.sql)\n`;
out += `DO $$ BEGIN\n  -- admin_kpis_daily\n  CREATE MATERIALIZED VIEW IF NOT EXISTS public.admin_kpis_daily AS\n  SELECT\n    d::date AS kpi_date,\n    (SELECT COUNT(*) FROM public.profiles p WHERE p.role='brand'   AND p.created_at::date = d::date)::bigint AS new_brands,\n    (SELECT COUNT(*) FROM public.profiles p WHERE p.role='creator' AND p.created_at::date = d::date)::bigint AS new_creators,\n    (SELECT COUNT(*) FROM public.contests c WHERE c.created_at::date = d::date)::bigint AS new_contests,\n    (SELECT COUNT(*) FROM public.submissions s WHERE s.created_at::date = d::date)::bigint AS new_submissions,\n    (SELECT COUNT(*) FROM public.submissions s WHERE s.status='approved' AND s.created_at::date = d::date)::bigint AS approved_submissions,\n    (SELECT COUNT(*) FROM public.cashouts co WHERE co.created_at::date = d::date)::bigint AS new_cashouts,\n    (SELECT COALESCE(SUM(co.amount_cents),0) FROM public.cashouts co WHERE co.status='paid' AND co.created_at::date = d::date)::bigint AS paid_cashouts_cents,\n    (SELECT COUNT(*) FROM public.moderation_queue mq WHERE mq.status='pending')::bigint AS pending_moderation_items,\n    (SELECT COUNT(*) FROM public.support_tickets st WHERE st.status IN ('open','pending'))::bigint AS open_support_tickets\n  FROM generate_series(current_date - interval '90 days', current_date, interval '1 day') AS d\n  ORDER BY kpi_date DESC;\nEXCEPTION WHEN duplicate_table THEN NULL; END $$;\n\n`;
out += `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_kpis_daily_date ON public.admin_kpis_daily(kpi_date);\n\n`;

out += `DO $$ BEGIN\n  -- webhook_deliveries_daily_stats\n  CREATE MATERIALIZED VIEW IF NOT EXISTS public.webhook_deliveries_daily_stats AS\n  SELECT\n    created_at::date AS stat_date,\n    COUNT(*)::bigint AS total_deliveries,\n    COUNT(*) FILTER (WHERE status='success')::bigint AS successful_deliveries,\n    COUNT(*) FILTER (WHERE status='failed')::bigint AS failed_deliveries,\n    COUNT(*) FILTER (WHERE status='pending')::bigint AS pending_deliveries,\n    COUNT(DISTINCT endpoint_id)::bigint AS unique_endpoints\n  FROM public.webhook_deliveries\n  WHERE created_at >= current_date - interval '90 days'\n  GROUP BY created_at::date\n  ORDER BY stat_date DESC;\nEXCEPTION WHEN duplicate_table THEN NULL; END $$;\n\n`;
out += `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_daily_stats_date ON public.webhook_deliveries_daily_stats(stat_date);\n\n`;

out += `DO $$ BEGIN\n  -- moderation_queue_stats\n  CREATE MATERIALIZED VIEW IF NOT EXISTS public.moderation_queue_stats AS\n  SELECT\n    status,\n    COUNT(*)::bigint AS count,\n    AVG(EXTRACT(EPOCH FROM (COALESCE(reviewed_at, CURRENT_TIMESTAMP) - created_at)) / 3600) AS avg_hours_to_review,\n    MAX(EXTRACT(EPOCH FROM (COALESCE(reviewed_at, CURRENT_TIMESTAMP) - created_at)) / 3600) AS max_hours_to_review,\n    COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL AND EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600 > 24)::bigint AS overdue_count\n  FROM public.moderation_queue\n  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'\n  GROUP BY status;\nEXCEPTION WHEN duplicate_table THEN NULL; END $$;\n\n`;
out += `CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_queue_stats_status_unique ON public.moderation_queue_stats(status);\n\n`;

out += `CREATE OR REPLACE FUNCTION public.refresh_admin_kpi_views()\nRETURNS void\nLANGUAGE sql\nSECURITY DEFINER\nAS $$\n  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_kpis_daily;\n  REFRESH MATERIALIZED VIEW CONCURRENTLY public.webhook_deliveries_daily_stats;\n  REFRESH MATERIALIZED VIEW CONCURRENTLY public.moderation_queue_stats;\n$$;\n\n`;

// Patches: fix broken indexes script (53_admin_indexes_search.sql had wrong columns)
out += `-- Admin search indexes (fixed version of 53_admin_indexes_search.sql)\n`;
out += `CREATE EXTENSION IF NOT EXISTS pg_trgm;\n\n`;
out += `CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm ON public.profiles USING gin(email gin_trgm_ops);\n`;
out += `CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON public.profiles USING gin(display_name gin_trgm_ops);\n`;
out += `CREATE INDEX IF NOT EXISTS idx_contests_title_trgm ON public.contests USING gin(title gin_trgm_ops);\n\n`;
out += `CREATE INDEX IF NOT EXISTS idx_cashouts_status_created ON public.cashouts(status, created_at DESC);\n`;
out += `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created ON public.webhook_deliveries(endpoint_id, created_at DESC);\n`;
out += `CREATE INDEX IF NOT EXISTS idx_admin_saved_views_route_created_by_created_at ON public.admin_saved_views(route, created_by, created_at DESC);\n\n`;

// Patches: harden SECURITY DEFINER function execution (default EXECUTE is PUBLIC)
out += `-- SECURITY: revoke execution of high-risk SECURITY DEFINER functions from PUBLIC\n`;
out += `DO $$\nBEGIN\n  -- maintenance/cron style functions should be server-only\n  BEGIN REVOKE ALL ON FUNCTION public.finalize_contest(uuid) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.archive_ended_contests() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.compute_daily_metrics(uuid) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.refresh_all_materialized_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.refresh_leaderboard() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.refresh_analytics_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.refresh_admin_kpi_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  -- admin RPCs should be server-only unless you add explicit checks\n  BEGIN REVOKE ALL ON FUNCTION public.admin_publish_contest(uuid, uuid, text, public.reason_code_enum, text, text) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\n  BEGIN REVOKE ALL ON FUNCTION public.admin_end_contest(uuid, uuid, text, public.reason_code_enum, text, text) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;\nEND $$;\n`;
out += `GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.archive_ended_contests() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.compute_daily_metrics(uuid) TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.refresh_all_materialized_views() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.refresh_leaderboard() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.refresh_analytics_views() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.refresh_admin_kpi_views() TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.admin_publish_contest(uuid, uuid, text, public.reason_code_enum, text, text) TO service_role;\n`;
out += `GRANT EXECUTE ON FUNCTION public.admin_end_contest(uuid, uuid, text, public.reason_code_enum, text, text) TO service_role;\n\n`;

// Append migrations into baseline
out += `\n-- =====================================================\n-- MIGRATIONS (appended)\n-- =====================================================\n\n`;
for(const mf of includeMigrations){
  const p = path.join(repo, mf);
  if(!fs.existsSync(p)) throw new Error('Missing migration file: '+mf);
  out += `\n-- ------------------------------\n-- BEGIN ${mf}\n-- ------------------------------\n`;
  out += readFromRepo(mf).trimEnd() + '\n';
  out += `-- ------------------------------\n-- END ${mf}\n-- ------------------------------\n\n`;
}

fs.writeFileSync(path.join(repo,'BASELINE.sql'), out, 'utf8');
console.log('Wrote BASELINE.sql');
