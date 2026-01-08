## TODO manquants (P0 / P1 / P2)

### P0 — Sécurité (bloquant prod)

- **(RESOLU via migrations/001)**: Lockdown `SECURITY DEFINER` (REVOKE PUBLIC + GRANT service_role + allowlist anon/auth).
- **(RESOLU via migrations/002)**: Storage “secure default” + `contest_assets` private (`public=false`) + policies explicites (pas d’`anon` par defaut).
- **(RESOLU via migrations/003)**: RLS policies manquantes pour `public.cashout_reviews` (admin-only).
- **(A NE PAS UTILISER)**: scripts admin cassés historiques:
  - `db_refonte/51_admin_transactions.sql`
  - `db_refonte/52_admin_kpi_materialized.sql`
  - `db_refonte/53_admin_indexes_search.sql`

### P1 — Intégrité / Fonctionnel

- **(RESOLU via migrations/010)**: Brand moderation via RPC `public.moderate_submission(...)` + trigger guard (empêche creators de changer `status`).
- **(RESOLU via migrations/011 + 020)**: Cashout integrity server-only:
  - `public.creator_available_balance` (view)
  - `public.request_cashout_service(...)` (service_role only)
  - `public.admin_review_cashout(...)` / `public.admin_mark_cashout_paid(...)` (service_role only) + allocation winnings
- **(RESOLU via migrations/021)**: Analytics correctness: materialized views `brand_dashboard_summary`, `creator_dashboard_summary`, `platform_stats_summary` reconstruits sans joins multiplicatifs.
- **(RESOLU via migrations/022)**: Cohérence `platform_settings`: schema normalise (drop `updated_by` legacy + ensure created_at/updated_at) + seed `admin_read_only`.

### P2 — Qualité / Maintenabilité / Perf

- **(RESOLU)**: Structure migrations creee (`migrations/*.sql`).
- **(RESOLU via migrations/030)**: indexes essentiels ajoutes (submissions/contests/cashouts/winnings/risk/kyc).
- **(A FAIRE)**: Reducer les “hotfix” storage: integrer `12c/12e` en une migration stable (si tu veux garder leur logique).
- **(RESOLU via migrations/023)**: Privacy: suppression des policies permissives `USING(true)` sur tables sensibles + view public-safe `public.public_creators`.
- **(A FAIRE)**: Index naming/coherence: nettoyer les doublons et conventions.

