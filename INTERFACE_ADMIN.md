NOTE : Référence détaillée (pages/UX/sécurité/Supabase/db_refonte/performance) : `docs/ADMIN_INTERFACE_REFERENCE_FR.md`

ADMIN INTERFACE PLAN - ADAPTED TO DB_REFONTE SCHEMA (V3)

0) Base SQL actuelle (db_refonte)
- Users: profiles, profile_brands, profile_creators (role enum admin/brand/creator)
- Orgs: orgs, org_members (brand orgs)
- Contests: contests, contest_terms, contest_assets, contest_tags, contest_tag_links, contest_terms_acceptances
- Submissions: submissions, metrics_daily, submission_comments
- Moderation + audit: moderation_queue, moderation_rules, moderation_actions, audit_logs, status_history
- Finance: payments_brand, cashouts, contest_prizes, contest_winnings, invoices, tax_evidence, webhooks_stripe
- Notifications: notifications, notification_templates, notification_preferences, push_tokens
- Messaging: messages_threads, messages, messages_attachments
- Assets: assets (storage metadata)
- Analytics/views: leaderboard, contest_stats, leaderboard_materialized, brand_dashboard_summary,
  creator_dashboard_summary, platform_stats_summary
- Ops: platform_accounts, platform_oauth_tokens, ingestion_jobs, ingestion_errors,
  webhook_endpoints, webhook_deliveries, event_log, rate_limits, kyc_checks, risk_flags

1) Admin modules - mapping to existing schema
1.1 Dashboard
- KPIs: platform_stats_summary + metrics_daily (range today/7d/30d)
- Contest stats: contest_stats, leaderboard_materialized
- Finance snapshot: payments_brand, cashouts, contest_winnings, invoices
- Alerts: webhooks_stripe (failed), ingestion_errors, audit_logs, status_history
- Delta (optional): admin_kpis_daily view/materialized, admin_alerts view/table

1.2 Contests
- Data: contests, contest_terms, contest_assets, contest_tags, contest_tag_links
- Finance per contest: contest_prizes, contest_winnings, payments_brand
- Actions: compute_payouts(), finalize_contest(), refresh_leaderboard()
- Logs: status_history, audit_logs
- Delta: none

1.3 Submissions
- Data: submissions, metrics_daily, submission_comments, assets (ugc_videos)
- Moderation: moderation_queue (submission only), moderation_actions
- Delta: risk scoring per submission missing (see Moderation)

1.4 Moderation
- Existing: moderation_queue (submission_id), moderation_rules, moderation_actions, audit_logs
- Delta: if you want unified moderation (contests/profiles/assets) ->
  new moderation_queue_entities or add entity_type/entity_id columns
- Delta: risk scoring per entity -> moderation_signals + moderation_scores (or extend risk_flags)

1.5 Users
- Profiles: profiles, profile_brands, profile_creators
- Orgs: orgs, org_members
- Social links: platform_accounts, platform_oauth_tokens
- KYC/risk: kyc_checks, risk_flags
- Activity: notifications, messages_threads, audit_logs, event_log
- Delta: admin_notes (optional), impersonation_sessions (optional)

1.6 Finance
- Payments: payments_brand
- Payouts: contest_winnings + cashouts
- Invoices: invoices + tax_evidence
- Stripe logs: webhooks_stripe
- Delta: finance_ledger (optional unified ledger), platform_settings for commission rate

1.7 Invoices
- Existing: invoices (org_id), tax_evidence, orgs
- Storage: assets bucket invoices + invoices.pdf_url
- Delta: invoice_number column if you need human readable numbering
- Delta: payment_id link if you want direct tie to payments_brand

1.8 Emails / Notifications
- Templates: notification_templates (channel=email/push/inapp/sms)
- User prefs: notification_preferences, push_tokens
- Logs: notifications (in-app only)
- Delta: email_outbox + email_logs (provider callbacks), campaigns table (optional)

1.9 CRM / Sales
- Existing: orgs/org_members cover real brands
- Delta: sales_leads (pipeline), sales_notes (optional)

1.10 Support
- Existing: none dedicated
- Delta: support_tickets + support_messages (+ optional attachments)

1.11 Audit & Logs
- Existing: audit_logs, event_log, status_history, webhooks_stripe,
  webhook_endpoints, webhook_deliveries
- Delta: admin_actions view (optional)

1.12 Settings
- Existing: none dedicated
- Delta: platform_settings + feature_flags

2) API admin (aligned)
- GET /api/admin/kpis -> platform_stats_summary + metrics_daily
- GET /api/admin/contests, PATCH /api/admin/contests/:id
- POST /api/admin/contests/:id/finalize (wrap finalize_contest)
- POST /api/admin/contests/:id/leaderboard/refresh (refresh_leaderboard)
- GET /api/admin/submissions, PATCH /api/admin/submissions/:id/moderate
- GET /api/admin/moderation/queue, CRUD /api/admin/moderation/rules
- GET /api/admin/users, PATCH /api/admin/users/:id
- GET /api/admin/finance/summary, GET /api/admin/cashouts, PATCH /api/admin/cashouts/:id
- GET /api/admin/invoices, POST /api/admin/invoices/:id/void
- GET /api/admin/notification-templates, POST /api/admin/notification-templates
- GET /api/admin/audit, GET /api/admin/webhooks/stripe
- GET /api/admin/settings, PATCH /api/admin/settings (new tables)
- POST /api/admin/exports (optional async jobs)

3) Jobs and automation (existing + missing)
- Existing: finalize_contest(), archive_ended_contests(), refresh_all_materialized_views()
- Existing placeholder: compute_daily_metrics() for metrics_daily ingestion
- Missing: email_outbox worker, invoice PDF generator, finance_ledger sync (if added),
  alert rules job

4) Delta SQL to create (admin only)
- platform_settings
- feature_flags
- moderation_queue_entities or extend moderation_queue
- moderation_signals, moderation_scores
- email_outbox, email_logs (+ campaigns optional)
- sales_leads (+ sales_notes optional)
- support_tickets (+ support_messages optional)
- finance_ledger (optional)
- admin_exports (optional)
- impersonation_sessions (optional)
- invoice_number/payment_id columns (optional on invoices)

5) MVP phasing (recommended)
- Phase 1: dashboard + contests + submissions + users + moderation (submission only)
- Phase 2: finance + cashouts + invoices + exports
- Phase 3: emails + CRM + support + settings/feature flags
- Phase 4: risk scoring + unified moderation + advanced alerts

P2) UX polish + options avancées (implémenté)
- FR 100% (admin): libellés, filtres, pagination, empty states.
- Recherche globale: bouton "Recherche" dans le header admin + API `GET /api/admin/search`.
- Sélecteurs (au lieu d'UUID): `AdminEntitySelect` + API `GET /api/admin/lookup` (org / marque / concours / user).
- Vues sauvegardées: bouton "Vues" dans le header admin (fallback localStorage si table absente).
  - SQL: `db_refonte/41_admin_saved_views.sql`
  - API: `GET/POST /api/admin/saved-views`, `DELETE /api/admin/saved-views/:id`
- Actions avancées (users):
  - Reset onboarding: `POST /api/admin/users/:id/reset-onboarding`
  - Impersonation (lien magiclink): `POST /api/admin/users/:id/impersonate` + page `src/app/auth/callback/page.tsx`
- Exports étendus: `/app/admin/exports` + `GET /api/admin/exports` (CSV multi-tables).

6) Done criteria
- Admin can create/close contests, moderate submissions, see KPIs and finance
- Cashouts, invoices, and email templates handled end to end
- Security: guard + RLS + audit + rate limit + CSRF

7) Step-by-step implementation plan (detailed)
Step 0 - Prep and baseline
- Validate db_refonte applied in order, and RLS policies exist.
- Ensure at least one admin profile (role=admin) for testing.
- Confirm admin guard in app router: requireRole('admin') + 403 page.
- Define admin UI base components: table, filters, tabs, confirm modal, toast.
- Create shared admin data layer: server-only supabase client + error mapping.

Step 1 - Admin shell
- Create /app/admin layout, sidebar, breadcrumbs, and main sections.
- Add navigation routes for each module (even if empty placeholder).
- Add empty pages with consistent loading/error states.

Step 2 - Dashboard
- API: GET /api/admin/kpis (use platform_stats_summary + metrics_daily).
- UI: KPI cards + charts (views/engagement/revenue).
- Alerts: query webhooks_stripe (failed), ingestion_errors, audit_logs recent.
- Add quick links to pending submissions, cashouts, contests at risk.

Step 3 - Contests
- API: GET /api/admin/contests, PATCH /api/admin/contests/:id.
- Actions: publish/pause/end/archive -> use existing contest status logic.
- Detail view: contest_stats, leaderboard_materialized, contest_prizes, payments_brand.
- Audit: write status_history + audit_logs on actions.

Step 4 - Submissions
- API: GET /api/admin/submissions with filters (contest/brand/creator/status).
- Reuse moderation endpoints where possible: /api/submissions/[id]/moderate,
  /api/submissions/batch-moderate (admin-only).
- UI: preview embed + metrics + comments + risk flags.
- Bulk actions + reason required for reject/remove.

Step 5 - Moderation (submission only first)
- UI: moderation_queue list (pending/processing/completed).
- Actions: approve/reject/remove -> moderation_actions + audit_logs.
- Rules: CRUD moderation_rules (toggle on/off).
- Optional: add "locked by admin" to avoid conflicts (UI only if needed).

Step 6 - Users
- API: GET /api/admin/users (search by email/name/id).
- User profile: profiles + profile_brands + profile_creators + orgs.
- KYC/risk: kyc_checks + risk_flags.
- Actions: suspend/unsuspend, reset onboarding, change role (admin-only).
- Optional: impersonation_sessions table + read-only impersonation route.

Step 7 - Finance
- API: GET /api/admin/finance/summary (payments_brand + cashouts + contest_winnings).
- Cashouts queue: GET/PATCH approve/reject/hold with reason.
- UI: filters, anomalies (failed cashouts, mismatched payouts).
- Optional: add finance_ledger for unified analytics.

Step 8 - Invoices
- API: GET /api/admin/invoices (from invoices table).
- Generate PDF: reuse /api/invoices/[payment_id]/generate if aligned,
  or new admin endpoint linked to invoices + assets bucket.
- Credit notes: add status update + optional link to refunds.
- Optional: invoice_number column for readable numbering.

Step 9 - Emails / notifications
- Use notification_templates for email templates (channel=email).
- If email sending needed: add email_outbox + email_logs, worker to send.
- UI: template editor, send manual, logs view.
- Respect notification_preferences.

Step 10 - CRM / Support
- Create sales_leads (+ sales_notes optional) and support_tickets tables.
- API CRUD for leads/tickets.
- UI: pipeline, assignment, status, internal notes.

Step 11 - Settings / feature flags
- Create platform_settings + feature_flags tables.
- API read/write with strict admin guard.
- UI: commission, limits, maintenance, flags.

Step 12 - Audit & logs
- UI for audit_logs, status_history, event_log.
- Webhooks view: webhooks_stripe + webhook_deliveries.
- Export CSV (async optional).

Step 13 - Hardening and QA
- Verify RLS policies for all new tables.
- Add CSRF + rate limit on admin mutations.
- Add tests: API smoke tests + critical flows (publish contest, moderate, cashout).
- Ensure logs include request_id for traceability.

Step 14 - Release checklist
- Backfill permissions for admin roles if adding new roles.
- Create minimal seed data for dashboard and admin modules.
- Validate admin workflows end-to-end.
- Setup monitoring for admin flows (errors, queue depth, webhooks).
  - See docs/admin_release_checklist.md
