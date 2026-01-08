## File inventory (db_refonte/*.sql)

| File | Type | Key deps (FK REFERENCES) | Executable as-is? | Notes |
|---|---|---|---|---|
| 00_extensions_enums.sql | extensions, types/enums |  | YES |  |
| 00_platform_settings_readonly.sql | schema/tables, indexes | public.profiles | NO | Conflicts with 39_admin_tables.sql; references profiles; should be a pure INSERT migration. |
| 01_functions_core.sql | functions |  | YES |  |
| 02_profiles.sql | schema/tables, indexes | auth.users, public.profiles | YES |  |
| 03_contests.sql | schema/tables, indexes | public.contest_terms, public.contests, public.profiles | YES |  |
| 04_submissions_metrics.sql | schema/tables, indexes | public.contests, public.profiles, public.submissions | YES |  |
| 05_payments_cashouts_4eyes.sql | schema/tables, indexes | public.cashouts, public.profiles | YES | Adds cashout_reviews + review_state; missing RLS policies for cashout_reviews in repo. |
| 05_payments_cashouts.sql | schema/tables, indexes | public.contests, public.profiles | YES |  |
| 06_moderation_audit.sql | schema/tables, indexes | public.profiles, public.submissions | YES |  |
| 07_messaging_notifications.sql | schema/tables, indexes | public.contests, public.messages_threads, public.profiles | YES |  |
| 08_views_materialized.sql | functions, views, mat_views, indexes |  | YES |  |
| 09_functions_business.sql | functions |  | YES |  |
| 10_triggers.sql | functions, triggers |  | YES |  |
| 11_rls_policies.sql | RLS/policies |  | YES |  |
| 12_public_profiles_view.sql | functions, views |  | YES |  |
| 12_storage_policies.sql | RLS/policies, storage |  | YES (env-dependent) |  |
| 12a_create_contest_assets_bucket.sql |  |  | YES (env-dependent) |  |
| 12b_create_invoices_bucket.sql |  |  | YES (env-dependent) |  |
| 12c_fix_contest_assets_rls.sql | RLS/policies |  | YES (env-dependent) | Hotfix scripts; consolidate into one stable migration. |
| 12d_test_contest_assets_rls.sql |  |  | YES |  |
| 12e_verify_and_fix_contest_assets_rls.sql | RLS/policies |  | YES (env-dependent) | Hotfix scripts; consolidate into one stable migration. |
| 13_seed_minimal.sql | seed/data |  | YES |  |
| 14_sanity_checks.sql |  |  | YES |  |
| 15_orgs.sql | schema/tables, indexes | public.orgs, public.profiles | YES |  |
| 16_platform_links.sql | schema/tables, indexes | public.ingestion_jobs, public.platform_accounts, public.profiles | YES |  |
| 17_notification_center.sql | schema/tables, indexes | public.profiles | YES |  |
| 18_invoices_billing.sql | schema/tables, indexes | public.orgs | YES |  |
| 19_kyc_risk.sql | schema/tables, indexes | public.profiles | YES |  |
| 20_assets.sql | schema/tables, indexes | public.orgs, public.profiles | YES |  |
| 21_moderation_history.sql | schema/tables, indexes | public.profiles | YES |  |
| 22_messaging.sql | functions, indexes | public.orgs | YES |  |
| 23_webhooks_outbound.sql | schema/tables, indexes | public.orgs, public.webhook_endpoints | YES |  |
| 24_event_log.sql | schema/tables, indexes | public.orgs, public.profiles | YES |  |
| 25_contest_prizes_winnings.sql | schema/tables, indexes | public.cashouts, public.contests, public.profiles | YES |  |
| 26_contest_terms_acceptances.sql | schema/tables, indexes | public.contest_terms, public.contests, public.profiles | YES |  |
| 27_follows_favorites.sql | schema/tables, indexes | public.contests, public.profiles | YES |  |
| 28_tags_categories.sql | schema/tables, indexes | public.contest_tags, public.contests | YES |  |
| 29_status_history.sql | schema/tables, indexes | public.profiles | YES |  |
| 30_submission_comments.sql | schema/tables, indexes | public.profiles, public.submission_comments, public.submissions | YES |  |
| 31_notification_templates.sql | schema/tables, indexes |  | YES |  |
| 32_automation_functions.sql | functions |  | YES |  |
| 33_analytics_materialized.sql | functions, mat_views, indexes |  | YES |  |
| 34_submission_limits.sql | functions, indexes | public.profiles | YES |  |
| 35_weighted_views_calculation.sql | functions, triggers |  | YES |  |
| 36_messages_attachments.sql | schema/tables, RLS/policies, indexes | public.assets, public.messages | YES |  |
| 37_create_contest_complete.sql | functions |  | YES |  |
| 38_rate_limits.sql | schema/tables, RLS/policies, indexes |  | YES |  |
| 39_admin_tables.sql | schema/tables, RLS/policies, indexes | public.email_outbox, public.notification_templates, public.profiles | YES |  |
| 40_seed_admin_minimal.sql | seed/data |  | YES |  |
| 41_admin_saved_views_team_personal.sql | indexes |  | YES |  |
| 41_admin_saved_views.sql | schema/tables, RLS/policies, indexes | public.profiles | YES |  |
| 42_admin_rbac_break_glass.sql | indexes |  | YES |  |
| 42_admin_rbac.sql | schema/tables, functions, RLS/policies, indexes | public.admin_permissions, public.admin_roles, public.admin_staff, public.profiles | YES |  |
| 43_admin_inbox_permissions.sql |  |  | YES |  |
| 44_admin_guide_permissions.sql |  |  | YES |  |
| 45_moderation_rules_lifecycle.sql | schema/tables, functions, triggers, RLS/policies, indexes | public.moderation_rules, public.profiles | YES |  |
| 46_ingestion_errors_resolution.sql | indexes | public.profiles | YES |  |
| 47_admin_ops_data.sql | schema/tables, functions, triggers, RLS/policies, indexes | public.admin_tasks, public.profiles | YES |  |
| 48_marketing_campaigns.sql | schema/tables, RLS/policies, indexes | public.assets, public.campaigns, public.contests, public.orgs, public.profiles | YES |  |
| 49_event_log_utm_views.sql | views |  | YES |  |
| 50_admin_ops_permissions.sql |  |  | YES |  |
| 51_admin_transactions.sql | functions |  | NO | Uses invalid cashout statuses (rejected/on_hold); not compatible with cashout_status enum. |
| 52_admin_kpi_materialized.sql | functions, mat_views, indexes |  | NO | References missing columns (response_time_ms/webhook_endpoint_id) and invalid cashout status (approved). |
| 53_admin_indexes_search.sql | indexes |  | NO | References missing columns (admin_saved_views.module, webhook_endpoint_id). |
| 54_admin_mfa.sql | schema/tables, RLS/policies, indexes | public.profiles | YES |  |
| 54_status_history_generalized.sql | types/enums, functions, triggers, views, indexes |  | YES |  |
| 55_admin_contest_publish_transaction.sql | functions |  | YES |  |
| 56_admin_contest_end_transaction.sql | functions |  | YES |  |
| 57_admin_aal2_rls.sql | RLS/policies |  | YES | Optional hardening: replaces admin policies for audit_logs/cashouts with AAL2 requirement. |
| RUN_ALL_LOCALLY.sql |  |  | YES |  |
