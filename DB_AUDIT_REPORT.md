## A) Resume executif

### Niveau de risque

- **Securite (Supabase/RLS/RBAC/Storage)**: **Eleve**
  - Raison principale: presence de nombreuses fonctions **`SECURITY DEFINER`** sans controle d’acces explicite (admin/ownership) + execution potentiellement **publique** par defaut.
  - Risque secondaire: `storage.buckets.public=true` sur `contest_assets` (lecture publique directe possible).
- **Integrite (schema/migrations)**: **Moyen -> Eleve**
  - Plusieurs scripts sont **non executables** tels quels (colonnes inexistantes / enums incoherents / references invalides).
- **Performance**: **Moyen**
  - Beaucoup d’indexes existent, mais certaines vues/materialized views ont des patterns de join pouvant etre couteux / faux.

### Top 10 problemes (priorises)

1) **P0 - SECURITY DEFINER sans guard + exec publique**: escalation possible (mutations admin/cron/maintenance).  
2) **P0 - Storage `contest_assets` bucket public**: bypass RLS lecture (exposition de fichiers).  
3) **P0 - `public.cashout_reviews`**: RLS ON mais **aucune policy** (feature inutilisable + drift securite).  
4) **P0 - `52_admin_kpi_materialized.sql` cassé**: colonnes inexistantes (`response_time_ms`, `webhook_endpoint_id`), statut cashout invalide (`approved`).  
5) **P0 - `53_admin_indexes_search.sql` cassé**: colonnes inexistantes (`admin_saved_views.module`, `webhook_deliveries.webhook_endpoint_id`).  
6) **P0/P1 - `51_admin_transactions.sql` cassé**: ecrit des statuts cashout inexistants (`rejected`, `on_hold`).  
7) **P1 - `00_platform_settings_readonly.sql` conflit schema**: redéfinit `platform_settings` de façon incompatible et trop tot (FK vers `profiles`).  
8) **P1 - Brand moderation**: la marque ne peut pas approuver/rejeter une submission (RLS manque UPDATE cible).  
9) **P1 - Cashout integrity**: pas de contrainte serveur pour limiter `cashouts.amount_cents` aux gains disponibles.  
10) **P1 - Analytics materialized views**: `33_analytics_materialized.sql` a des joins qui peuvent **multiplier** (KPI faux).

## B) Inventaire & ordre d’execution

### Fichiers SQL trouves

Le dossier `db_refonte/` contient **57 fichiers `.sql`** principaux + des scripts auxiliaires (RUN_ALL, hotfix storage, seeds).

Le tableau demande (fichier -> type -> dependances -> executable -> remarques) est dans:

- `FILE_INVENTORY.md`

### Ordre d’execution canonique (high-level)

1. **Extensions / enums**: `00_extensions_enums.sql`  
2. **Schema core**: `02_profiles.sql` → `01_functions_core.sql` → `03_contests.sql` → `04_submissions_metrics.sql` → `05_payments_cashouts.sql` → `06_moderation_audit.sql` → `07_messaging_notifications.sql`  
3. **Modules SaaS**: `15..31` + `36` + `38`  
4. **Admin**: `39..49` + `42_admin_rbac_break_glass.sql` + permissions `43/44/50` + `54_admin_mfa.sql` + `55/56` + option `57`  
5. **Views / business / automation**: `08` → `09` → `33` → `34` → `35` → `32` → `37`  
6. **RLS + triggers**: `11_rls_policies.sql` puis `10_triggers.sql`  
7. **Public safe view + storage policies + buckets**: `12_public_profiles_view.sql` → `12_storage_policies.sql` + `12a/12b`  
8. **Verification**: `14_sanity_checks.sql`

### Scripts problematiques / non inclus dans baseline

- **A exclure** (non executables ou contradictoires):
  - `00_platform_settings_readonly.sql`
  - `51_admin_transactions.sql`
  - `52_admin_kpi_materialized.sql`
  - `53_admin_indexes_search.sql`
- **Hotfix / debug** (a consolider en une migration stable):
  - `12c_fix_contest_assets_rls.sql`, `12e_verify_and_fix_contest_assets_rls.sql`, `12d_test_contest_assets_rls.sql`

## C) Modele & tables

### Tables principales (groupes)

- **Identity / roles app**: `profiles`, `profile_brands`, `profile_creators`
- **Contest / UGC**: `contests`, `contest_assets`, `contest_terms`, `submissions`, `metrics_daily`
- **Payments**: `payments_brand`, `cashouts`, `webhooks_stripe`, `contest_prizes`, `contest_winnings`
- **Org / multi-members**: `orgs`, `org_members`
- **Integrations / ingestion**: `platform_accounts`, `platform_oauth_tokens`, `ingestion_jobs`, `ingestion_errors`
- **Messaging / notifications**: `messages_threads`, `messages`, `messages_attachments`, `notifications`, `notification_preferences`, `push_tokens`, `notification_templates`
- **Compliance / audit**: `audit_logs`, `status_history`, `moderation_queue`, `moderation_rules`, `moderation_rule_versions`, `moderation_actions`
- **Storage metadata**: `assets`
- **Webhooks outbound**: `webhook_endpoints`, `webhook_deliveries`
- **Admin**: `admin_staff/*` (RBAC), `admin_saved_views`, `platform_settings`, `feature_flags`, `sales_leads`, `support_tickets`, `email_outbox`, `email_logs`, `admin_tasks/*`, `admin_notes`, `admin_playbooks`, `admin_ui_preferences`, `admin_mfa`
- **Ops**: `rate_limits`, `campaigns/*`, `event_log` (+ vues UTM)

### Relations clefs (FK)

- `profiles.id` → `auth.users(id)` (cascade)
- `contests.brand_id` → `profiles(id)` (restrict) ; `contests.org_id` → `orgs(id)` (set null)
- `submissions.contest_id` → `contests(id)` ; `submissions.creator_id` → `profiles(id)`
- `metrics_daily.submission_id` → `submissions(id)` (cascade)
- `payments_brand.brand_id` → `profiles(id)` ; `payments_brand.contest_id` → `contests(id)`
- `contest_winnings.cashout_id` → `cashouts(id)`
- `org_members.org_id` → `orgs(id)` ; `org_members.user_id` → `profiles(id)`
- `platform_oauth_tokens.account_id` → `platform_accounts(id)`
- `webhook_deliveries.endpoint_id` → `webhook_endpoints(id)`

### Anomalies detectees

- **Enums vs scripts**: `cashout_status` ne contient pas `approved/rejected/on_hold` mais certains scripts admin tentent de les utiliser.
- **Double definition `platform_settings`**: creation/colonnes/RLS differentes selon le fichier.
- **Analytics**: materialized views construites avec des joins pouvant fausser les aggregates.

## D) RLS / Policies (tres detaille)

Le detail complet (par table, policies SELECT/INSERT/UPDATE/DELETE, conditions USING/WITH CHECK) est dans:

- `RLS_MATRIX.md`

### Points saillants (securite)

- **Public read “true”**:
  - `profile_creators_public_read` (lecture ouverte) → risque privacy (first_name/last_name/handle/followers/avg_views).
  - `follows_public_read` (social graph public) → risque privacy.
- **Service role write-only** (pattern OK):
  - `metrics_daily`, `webhooks_stripe`, `platform_oauth_tokens`, `webhook_deliveries`, `event_log` (pas de policy INSERT pour public).
- **GAP**:
  - `cashout_reviews` n’a **aucune policy** (RLS ON) → KO.

## E) Couverture fonctionnelle par interface (OK/KO/Partiel)

### Admin

- **Partiel**
  - **OK**: RBAC admin (`admin_staff/*`), audit (`audit_logs`, `status_history`), modération (`moderation_*`), support/CRM (`support_tickets`, `sales_leads`), flags/settings (`feature_flags`, `platform_settings`), ops center (`admin_tasks/*`, notes/playbooks), MFA table (`admin_mfa`), transactions contest publish/end (`55/56`), hardening AAL2 optionnel (`57`).
  - **KO / manques**:
    - **Cashout workflow**: scripts existants `51_admin_transactions.sql` sont incoherents (statuts) → a remplacer.
    - **User bans/suspensions**: pas de table “ban/suspension” (seul `profiles.is_active` / `risk_score`).
    - **Journal admin action**: existe via `audit_logs` + triggers, mais les fonctions admin RPC doivent etre strictement restreintes (P0).

### Brand

- **Partiel**
  - **OK**: CRUD contests (table `contests` + assets + terms + tags), analytics (views + materialized), factures (`invoices`, storage `invoices`), messaging (`messages_threads/messages`), lecture submissions/metrics de ses contests.
  - **KO / manques**:
    - **Modération submissions** par la marque: policies actuelles donnent surtout SELECT, pas de UPDATE de `submissions.status` (ou via `moderation_queue`).
    - **Paiement Stripe**: tables presentes (`payments_brand`, `webhooks_stripe`), mais le lien “paiement -> activation contest” depend d’un workflow applicatif (pas de contrainte DB).

### Creator

- **Partiel**
  - **OK**: decouverte contests (public read active), soumission (`submissions` + checks CGU via `contest_terms_acceptances`), lecture de ses metrics, lecture de ses gains (`contest_winnings`), cashout request (table `cashouts`).
  - **KO / manques**:
    - **Wallet/balance enforce**: aucun garde-fou DB empechant un cashout superieur aux gains.
    - **Leaderboard**: dispo via `leaderboard`/mat view, mais l’exposition doit etre strictement controlee (RLS + grants sur fonctions).

## F) Recommandations + patch plan

### Plan “safe” (petites migrations)

1. **P0**: restreindre l’execution des fonctions `SECURITY DEFINER` (server-only) et/ou ajouter checks `is_admin()/ownership` dans les RPC exposees.  
2. **P0**: aligner Storage (`contest_assets` bucket public ou non) + policies coherentes `anon/authenticated`.  
3. **P0**: ajouter policies manquantes `cashout_reviews`.  
4. **P0**: retirer/archiver les scripts cassés + creer migrations remplaçantes (admin KPIs + indexes + cashout transactions).  
5. **P1**: ajouter un workflow cashout strict (RPC service_role) + verif KYC/risk flags.  
6. **P1**: corriger materialized views analytics (sub-aggregates).  
7. **P2**: restructurer repo (baseline + migrations + seed + tests).

### Livrables generes dans ce repo

- `BASELINE.sql` (baseline canonique consolide + patchs de coherence)
- `MIGRATION_PLAN.md` (etapes)
- `SQL_TESTS.sql` (requêtes de validation)
- `TODO_MISSING.md` (P0/P1/P2)
- `RLS_MATRIX.md` (detail complet RLS/policies)

