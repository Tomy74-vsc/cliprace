## Migration plan (safe / incremental)

### Goals

- Produce a **clean baseline** (`BASELINE.sql`) that can be applied on a fresh Supabase/Postgres project.
- Convert the current `db_refonte/*.sql` set into **small, safe migrations** (idempotent, dependency-ordered).
- Fix **security + correctness** issues found during the audit (no invention beyond what is already implied by existing files).

### Step 0 — Freeze a canonical baseline

- **Action**: Use `BASELINE.sql` (generated from `db_refonte/*.sql` + safety patches).
- **Why**: The repo contains multiple versions / broken scripts (`00_platform_settings_readonly.sql`, `51_admin_transactions.sql`, `52_admin_kpi_materialized.sql`, `53_admin_indexes_search.sql`) that should not be used as-is.

### Step 1 (P0) — Security hardening (DB-level)

- **Restrict SECURITY DEFINER execution**
  - **Problem**: Many `SECURITY DEFINER` functions do not enforce role/ownership checks but are executable by default.
  - **Fix**: `REVOKE EXECUTE ... FROM PUBLIC` and `GRANT EXECUTE ... TO service_role` for:
    - `public.finalize_contest(uuid)`
    - `public.archive_ended_contests()`
    - `public.compute_daily_metrics(uuid)`
    - `public.refresh_all_materialized_views()`
    - `public.cleanup_old_data()`
    - `public.refresh_leaderboard()`
    - `public.refresh_analytics_views()`
    - `public.refresh_admin_kpi_views()`
    - `public.admin_publish_contest(...)`
    - `public.admin_end_contest(...)`

- **Storage access alignment**
  - **Problem**: `12a_create_contest_assets_bucket.sql` sets `contest_assets.public = true` while the RLS policies in `12_storage_policies.sql` target authenticated flows; a public bucket can bypass RLS reads.
  - **Fix options** (choose one, explicitly):
    - **Option A (strict)**: set `storage.buckets.public=false` for `contest_assets` and add `TO anon` read policies where intended.
    - **Option B (open)**: keep bucket public, but treat `contest_assets` as world-readable (and remove misleading “read_public” policy assumptions).

Chosen: **Option A (strict / private contest_assets)** via `migrations/002_p0_storage_policies.sql`.

### Step 2 (P0) — Make scripts executable (stop breakage)

- **Deprecate** (do not run in migrations):
  - `db_refonte/00_platform_settings_readonly.sql` (conflicts with `39_admin_tables.sql` and references `public.profiles`)
  - `db_refonte/51_admin_transactions.sql` (uses non-existent `cashout_status` values like `rejected`, `on_hold`)
  - `db_refonte/52_admin_kpi_materialized.sql` (references missing columns: `response_time_ms`, `webhook_endpoint_id`; uses invalid cashout status `approved`)
  - `db_refonte/53_admin_indexes_search.sql` (references missing columns: `admin_saved_views.module`, `webhook_deliveries.webhook_endpoint_id`)

- **Replace** with fixed migrations:
  - `migrations/0xx_admin_kpis_fixed.sql`: corrected definitions for:
    - `public.admin_kpis_daily`
    - `public.webhook_deliveries_daily_stats`
    - `public.moderation_queue_stats`
  - `migrations/0xx_admin_search_indexes_fixed.sql`: corrected indexes for:
    - trigram indexes + `endpoint_id` + `admin_saved_views(route, created_by, created_at)`
  - `migrations/0xx_platform_settings_seed.sql`: only inserts keys (no table creation).

### Step 3 (P0) — RLS coverage gaps

- **Problem**: `public.cashout_reviews` has RLS enabled (`05_payments_cashouts_4eyes.sql`) but no policies anywhere in the repo.
- **Fix**: add admin-only policy:
  - `cashout_reviews_admin_all` (FOR ALL USING/WITH CHECK `public.is_admin(auth.uid())`)

### Step 4 (P1) — Functional gaps (admin / brand / creator)

- **Brand moderation**
  - **Problem**: brand can read its submissions but cannot approve/reject (no UPDATE policy).
  - **Fix**: add narrow UPDATE policy on `public.submissions` for brand on contests they own, restricting updated columns via RPC or `WITH CHECK` patterns.

- **Cashout integrity**
  - **Problem**: creators can request arbitrary `cashouts.amount_cents`; there is no enforced “available balance”.
  - **Fix**: introduce a server-only RPC (service_role) that validates:
    - sum of unpaid `contest_winnings.payout_cents` minus pending/processing cashouts
    - optionally KYC/risk flags

### Step 5 (P1) — Analytics correctness

- **Problem**: materialized views in `33_analytics_materialized.sql` join tables in ways that can multiply rows (contest totals / earnings).
- **Fix**: rewrite using sub-aggregates (per brand/per creator) then join aggregates.

### Step 6 (P2) — Repo cleanup / structure

Recommended target structure:

- `000_baseline.sql` (or keep `BASELINE.sql`)
- `migrations/001_...sql`, `migrations/002_...sql`, ...
- `seed/seed_dev.sql`, `seed/seed_admin_dev.sql`
- `tests/SQL_TESTS.sql`

Also:

- Keep **hotfix scripts** (`12c/12e`) out of baseline; fold their final state into a single migration.

### Implemented migrations (this repo)

Run order after applying `BASELINE.sql` on a fresh Supabase DB:

- `migrations/001_p0_security_definer_lockdown.sql`
- `migrations/002_p0_storage_policies.sql`
- `migrations/003_p0_cashout_reviews_policies.sql`
- `migrations/010_p1_brand_moderation.sql`
- `migrations/011_p1_cashout_integrity.sql`
- `migrations/020_p1_admin_workflows.sql`
- `migrations/021_p1_analytics_safe.sql`
- `migrations/022_p1_platform_settings_cleanup.sql`
- `migrations/023_p2_privacy_policies.sql`
- `migrations/030_p2_indexes.sql`
