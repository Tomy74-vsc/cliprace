# Interface Administrateur — Référence complète (UX • Sécurité • Supabase • Performance)

Ce document décrit **toutes les pages de l’interface administrateur** (et leurs liens avec les espaces **Marque** et **Créateur**), en expliquant :
- l’**UX cible** (simple, premium, “control center”),
- la **sécurité** (auth, RBAC, CSRF, rate-limit, audit),
- la **connexion Supabase** (SSR/RLS vs service-role),
- l’**interconnexion** entre modules (user ↔ org ↔ brand ↔ contest ↔ submission ↔ finance ↔ ops),
- les **sources DB** (tables/views) et les fichiers `db_refonte/*.sql`,
- les **principes de performance** (pagination, indices, caching, agrégations).

---

## 1) Architecture globale (Brand / Creator / Admin)

### 1.1 Rôles et identité
- Le rôle applicatif est stocké dans `public.profiles.role` (`creator | brand | admin`) — voir `db_refonte/02_profiles.sql`.
- L’identité (auth) est gérée par Supabase Auth et résolue côté serveur dans `src/lib/auth.ts` (session + profil).

### 1.2 Espaces applicatifs
- **Espace Admin** : `src/app/app/admin/*` (guard rôle admin + RBAC fin).
- **Espace Marque** : `src/app/app/brand/*` (guard rôle brand *ou* admin).
- **Espace Créateur** : `src/app/app/creator/*` (guard rôle creator *ou* admin).

### 1.3 Entités pivots (interconnexion)
Les entités sont pensées pour être traversées depuis n’importe quel module :
- **User** : `profiles` (+ déclinaisons `profile_brands`, `profile_creators`)
- **Org / Marque** : `orgs`, `org_members` + `profile_brands` (profil marque)
- **Concours** : `contests`, `contest_terms`, `contest_assets`, `contest_tags`, `contest_tag_links`, `contest_prizes`, `contest_terms_acceptances`
- **Soumission** : `submissions`, `metrics_daily`, `submission_comments`
- **Modération** : `moderation_queue`, `moderation_rules`, `moderation_rule_versions`, `moderation_actions`
- **Finance** : `payments_brand`, `contest_winnings`, `cashouts`, `invoices`, `tax_evidence`
- **Ops / Intégrations / Ingestion** : `webhook_endpoints`, `webhook_deliveries`, `platform_accounts`, `platform_oauth_tokens`, `ingestion_jobs`, `ingestion_errors`
- **Conformité / risque** : `kyc_checks`, `risk_flags`
- **Support / CRM** : `support_tickets`, `sales_leads`
- **Observabilité** : `audit_logs`, `status_history`, `event_log` (+ `event_log_utm`, `event_log_utm_daily`)
- **Admin ops center** : `admin_tasks`, `admin_task_events`, `admin_notes`, `admin_playbooks`, `admin_ui_preferences`

---

## 2) Connexion à Supabase (RLS vs service role)

### 2.1 SSR + RLS (Brand/Creator)
Les espaces Marque et Créateur utilisent le client SSR (`getSupabaseSSR()` dans `src/lib/supabase/ssr.ts`) :
- les requêtes passent avec la **clé anon**,
- les accès sont filtrés via les **politiques RLS** (`db_refonte/11_rls_policies.sql` et fichiers storage `db_refonte/12*_*.sql`),
- c’est le modèle “le plus sûr” : même si le front fait une requête inattendue, la DB bloque.

Exemples réels dans le code :
- le layout Marque compte ses concours/soumissions/paiements via RLS (`src/app/app/brand/layout.tsx`)
- le layout Créateur calcule un solde “disponible” via `contest_winnings` et `cashouts` (RLS) (`src/app/app/creator/layout.tsx`)

### 2.2 Admin (service role + guards applicatifs)
L’admin côté serveur utilise un client service-role (`getSupabaseAdmin()` dans `src/lib/supabase/server.ts`, exposé via `getAdminClient()`).
Important :
- le **service role bypass RLS**, donc la sécurité repose sur :
  - guard rôle admin (`src/lib/admin/guard.ts`),
  - RBAC fin (permissions) **obligatoire** côté serveur (`src/lib/admin/rbac.ts`),
  - CSRF + rate-limit + audit sur mutations.

Ce choix est volontaire : il garantit que l’admin peut diagnostiquer/réparer même si des politiques RLS bloquent un utilisateur, mais il impose une discipline stricte côté API.

---

## 3) Sécurité (ce qui doit être vrai partout)

### 3.1 Guards d’accès (pages)
- Admin layout (`src/app/app/admin/layout.tsx`) :
  - exige session valide,
  - exige `profiles.role === 'admin'`,
  - construit la nav en masquant/désactivant les sections selon permissions RBAC.
- Chaque page admin appelle `requireAdminPermission('<module>.read')` (ex : `users.read`, `finance.read`).

### 3.2 Guards d’accès (API)
Sur toutes les routes `/api/admin/*` :
- lecture : `requireAdminPermission('<module>.read')` (et/ou `tasks.read`, `audit.read`…)
- écriture : `requireAdminPermission('<module>.write')` + `assertCsrf()` + `enforceAdminRateLimit()`
- les actions sensibles (finance/modération/settings/users) doivent écrire dans `audit_logs` et/ou `status_history`.

### 3.3 RBAC admin (permissions)
DB RBAC : `db_refonte/42_admin_rbac.sql`
- tables : `admin_staff`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_staff_roles`, `admin_staff_permission_overrides`
- bootstrap (premier admin) + super-admin.

Extension “Ops Center” : `db_refonte/50_admin_ops_permissions.sql`
- `tasks.read/write`, `notes.read/write`, `playbooks.read/write`, `ui_prefs.read/write`, `campaigns.read/write`.

### 3.4 CSRF
Double-submit token (`csrf` cookie + header `x-csrf`) :
- génération : `/api/auth/csrf` (et cookie middleware pour `/auth/*`)
- validation : `src/lib/csrf.ts`

### 3.5 Rate limit
Rate limit persistant via `rate_limits` (`db_refonte/38_rate_limits.sql`) :
- implémentation : `src/lib/rateLimit.ts` + wrapper admin `src/lib/admin/rate-limit.ts`

---

## 4) UX Admin (standard “control center”)

### 4.1 Objectif UX commun
Chaque page admin doit répondre en 10 secondes :
1) Où j’en suis ?
2) Quoi traiter ?
3) Quelle action ensuite ?

### 4.2 Composants admin (cohérence visuelle)
Composants clés (utilisés sur plusieurs pages) :
- `AdminPageHeader` : titre, contexte, CTA, badges
- `AdminFiltersBar` / `AdminFilters` : filtres + reset + compteur
- `AdminDataTablePro` / `AdminTable` : listes, tri, sélection, actions
- `AdminEmptyStateGuided` : empty state actionnable
- `AdminActionPanel` : confirmations + raison obligatoire
- `AdminSavedViews` : vues sauvegardées (`admin_saved_views`)
- `AdminGlobalSearch` : recherche transversale (`/api/admin/search`)
- `AdminEntitySelect` : sélecteurs (user/org/brand/contest) via `/api/admin/lookup`
- `AdminInboxDropdown` + page Inbox : “à traiter” (`admin_tasks`)
- `AdminDensityToggle` : densité UI (`admin_ui_preferences`)

---

## 5) Pages Admin — détail page par page

Format standard par page :
- **URL**
- **But UX**
- **Sources DB** (tables/views + fichier `db_refonte`)
- **Permissions** (read/write)
- **APIs** (routes `src/app/api/admin/*`)
- **Interconnexions** (Brand/Creator/Admin)
- **Performance** (pagination/agrégations/indices)

### 5.1 Layout Admin (shell)
- **URL** : toutes les pages sous `/app/admin/*`
- **But UX** : navigation cohérente + recherche + vues + notifs “à traiter”
- **Sources DB** :
  - session/role : `profiles` (`db_refonte/02_profiles.sql`)
  - RBAC : `admin_*` (`db_refonte/42_admin_rbac.sql`)
  - inbox badge : `admin_tasks` (`db_refonte/47_admin_ops_data.sql`)
- **Sécurité** : rôle admin obligatoire + RBAC pour activer/désactiver la nav (`src/app/app/admin/layout.tsx`)

### 5.2 Dashboard
- **URL** : `/app/admin/dashboard`
- **But UX** : rapport global + Top 10 actions + santé système + marketing + journal
- **Sources DB** :
  - KPI : `metrics_daily` (`db_refonte/04_submissions_metrics.sql`)
  - “à faire” : `admin_tasks` (`db_refonte/47_admin_ops_data.sql`)
  - santé : `webhook_deliveries` (`db_refonte/23_webhooks_outbound.sql`), `ingestion_errors/jobs` (`db_refonte/16_platform_links.sql`)
  - marketing : `contest_stats` (view `db_refonte/08_views_materialized.sql`) + `contests` (`db_refonte/03_contests.sql`)
  - journal : `audit_logs` (`db_refonte/06_moderation_audit.sql`), `event_log` (`db_refonte/24_event_log.sql`)
- **Permissions** : `dashboard.read`
- **APIs** : `GET /api/admin/dashboard/report`
- **Interconnexions** : CTA vers Inbox, Finance, Modération, Support, CRM, Integrations
- **Performance** : agrégations via views (ex : `contest_stats`), limiter les listes (top N), éviter gros joins.

### 5.3 Inbox (“À traiter”)
- **URL** : `/app/admin/inbox`
- **But UX** : file unique de traitement (équipe/mon travail/non assigné), actions rapides
- **Sources DB** :
  - tâches : `admin_tasks`, `admin_task_events` (`db_refonte/47_admin_ops_data.sql`)
  - signaux : `webhook_deliveries`, `ingestion_errors`, `risk_flags` (spikes)
- **Permissions** : `inbox.read` (et `tasks.read/write` pour agir)
- **APIs** :
  - `GET /api/admin/inbox/summary`
  - `GET /api/admin/inbox/items`
  - `POST /api/admin/tasks/[id]/assign-to-me`
  - `POST /api/admin/tasks/[id]/comment`
  - `PATCH /api/admin/tasks/[id]`
- **Interconnexions** : chaque tâche pointe vers sa page source (finance, support, intégrations…)
- **Performance** : sync “best-effort” + pagination (top N), éviter calculs coûteux à chaque refresh.

### 5.4 Marques / Orgs
- **URL** : `/app/admin/brands`
- **But UX** : créer/éditer marque/org, piloter ROI, créer concours pour une marque
- **Sources DB** :
  - `profiles`, `profile_brands` (`db_refonte/02_profiles.sql`)
  - `orgs`, `org_members` (`db_refonte/15_orgs.sql`)
  - `contests` (`db_refonte/03_contests.sql`)
- **Permissions** : `brands.read` (et `brands.write` pour créer/éditer)
- **APIs** : `GET/POST /api/admin/brands`, `GET/PATCH /api/admin/brands/[id]`
- **Interconnexions** :
  - vers espace Marque (`/app/brand/*`) via le même `profiles.id`
  - vers concours de la marque (`contests.brand_id`)
- **Performance** : rechercher par `lookup`/selecteurs plutôt que scans.

### 5.5 Concours (liste)
- **URL** : `/app/admin/contests`
- **But UX** : filtrer/publier/archiver, accès détail + création
- **Sources DB** :
  - `contests`, `contest_terms`, `contest_assets` (`db_refonte/03_contests.sql`)
  - tags : `contest_tags`, `contest_tag_links` (`db_refonte/28_tags_categories.sql`)
  - stats : `contest_stats` (view `db_refonte/08_views_materialized.sql`)
- **Permissions** : `contests.read` (write : `contests.write`)
- **APIs** : `GET /api/admin/contests` + actions publish/update
- **Interconnexions** : vers Brand contests + submissions + leaderboard
- **Performance** : pagination + champs minimaux, stats via view.

### 5.6 Concours (détail)
- **URL** : `/app/admin/contests/[id]`
- **But UX** : vue 360 (config, assets, termes, stats, actions)
- **Sources DB** :
  - `contests`, `contest_assets`, `contest_prizes`, `contest_winnings`
  - `contest_terms_acceptances` pour conformité
- **Permissions** : `contests.read` (+ write pour actions)
- **APIs** : endpoints admin contests + winners/publish si disponibles
- **Performance** : charger détails en sections (éviter tout en un).

### 5.7 Soumissions
- **URL** : `/app/admin/submissions`
- **But UX** : liste + filtres + actions bulk + contexte (creator/contest)
- **Sources DB** :
  - `submissions`, `metrics_daily` (`db_refonte/04_submissions_metrics.sql`)
  - `submission_comments` (`db_refonte/30_submission_comments.sql`)
  - modération : `moderation_queue` (`db_refonte/06_moderation_audit.sql`)
- **Permissions** : `submissions.read` (+ write pour modérer)
- **APIs** : `GET /api/admin/submissions` + actions modération
- **Interconnexions** : vers contest + creator + marque
- **Perf** : pagination, précharger juste le nécessaire (thumbnail, status).

### 5.8 Modération
- **URL** : `/app/admin/moderation`
- **But UX** : traiter la queue + gérer les règles + consulter l’historique
- **Sources DB** :
  - queue : `moderation_queue`
  - règles : `moderation_rules`, `moderation_rule_versions`
  - historique : `moderation_actions`, `audit_logs`
- **Permissions** : `moderation.read` (write : `moderation.write`)
- **APIs** : `GET /api/admin/moderation/queue`, `POST /api/admin/moderation/queue/[id]/claim`, `GET/POST /api/admin/moderation/rules`, `GET /api/admin/moderation/history`
- **Interconnexions** : impact direct sur `submissions.status` visible côté Marque et Créateur
- **Perf** : queue paginée, joins limités, actions atomiques.

### 5.9 Intégrations (webhooks outbound)
- **URL** : `/app/admin/integrations`
- **But UX** : endpoints + deliveries, filtres, diagnostics (top errors), retry
- **Sources DB** :
  - `webhook_endpoints`, `webhook_deliveries` (`db_refonte/23_webhooks_outbound.sql`)
  - playbooks (optionnel UI) : `admin_playbooks` (`db_refonte/47_admin_ops_data.sql`)
- **Permissions** : `integrations.read` (write : `integrations.write`)
- **APIs** : `GET /api/admin/webhook-endpoints`, `GET /api/admin/webhook-deliveries`, `GET /api/admin/webhook-deliveries/stats`, `POST /api/admin/webhook-deliveries/[id]` (retry)
- **Perf** : payload lourd => afficher résumé en liste, détail sur page delivery.

### 5.10 Delivery détail
- **URL** : `/app/admin/integrations/deliveries/[id]`
- **But UX** : timeline + payload + erreurs + retry
- **Sources DB** : `webhook_deliveries`
- **Permissions** : `integrations.read` (write pour retry)

### 5.11 Ingestion (jobs/errors)
- **URL** : `/app/admin/ingestion`
- **But UX** : pipeline (jobs → errors), relancer, marquer résolu, graphiques
- **Sources DB** :
  - `platform_accounts`, `platform_oauth_tokens` (`db_refonte/16_platform_links.sql`)
  - `ingestion_jobs`, `ingestion_errors` (`db_refonte/16_platform_links.sql`)
  - résolution erreurs : `db_refonte/46_ingestion_errors_resolution.sql` (colonnes resolved*)
- **Permissions** : `ingestion.read` (write : `ingestion.write`)
- **APIs** : `GET /api/admin/ingestion-jobs`, `GET /api/admin/ingestion-errors`, `POST /api/admin/ingestion-errors/[id]/resolve`
- **Perf** : `details` peut être volumineux -> limiter en liste, ouvrir en détail.

### 5.12 KYC / Risque
- **URL** : `/app/admin/risk`
- **But UX** : traiter KYC en attente + risk flags, filtres, résolution auditable
- **Sources DB** : `kyc_checks`, `risk_flags` (`db_refonte/19_kyc_risk.sql`)
- **Permissions** : `risk.read` (write : `risk.write`)
- **APIs** : `GET /api/admin/kyc-checks`, `GET /api/admin/risk-flags` (+ mutations resolve)
- **Interconnexions** : bloque/impacte Finance (cashouts), Users (statut), Moderation (signaux).

### 5.13 Tags / Conditions / Médias (Taxonomy)
- **URL** : `/app/admin/taxonomy`
- **But UX** : administrer la taxonomie concours + assets + stockage (sans JSON brut)
- **Sources DB** :
  - tags : `contest_tags`, `contest_tag_links` (`db_refonte/28_tags_categories.sql`)
  - terms : `contest_terms` (`db_refonte/03_contests.sql`)
  - contest assets : `contest_assets` (`db_refonte/03_contests.sql`)
  - assets : `assets` (`db_refonte/20_assets.sql`)
- **Permissions** : `taxonomy.read` (write : `taxonomy.write`)
- **APIs** : `GET/POST /api/admin/contest-tags`, `GET/POST /api/admin/contest-terms`, `GET /api/admin/contest-assets`, `GET /api/admin/assets`
- **Perf** : pagination partout, éviter de charger `assets.path` + metadata lourde si inutile.

### 5.14 Utilisateurs (liste)
- **URL** : `/app/admin/users`
- **But UX** : recherche, filtrage par rôle/statut, accès au détail
- **Sources DB** : `profiles` (`db_refonte/02_profiles.sql`)
- **Permissions** : `users.read`
- **APIs** : `GET /api/admin/users`
- **Perf** : `ilike` indexable via trigram si besoin (sinon limiter recherches).

### 5.15 Utilisateur (détail)
- **URL** : `/app/admin/users/[id]`
- **But UX** : vue 360 (profil, org, concours, soumissions, finance, logs), actions sécurisées
- **Sources DB** :
  - `profiles`, `profile_brands`, `profile_creators`
  - `org_members/orgs`
  - `platform_accounts`
  - `kyc_checks`, `risk_flags`
  - `cashouts`, `contest_winnings`, `payments_brand`
  - `audit_logs`, `event_log`, `notifications`
  - notes internes (optionnel) : `admin_notes`
- **Permissions** : `users.read` (+ `users.write` pour actions)
- **Sécurité** : toutes actions => confirmation + raison + audit.
- **Actions avancées existantes** :
  - reset onboarding : `POST /api/admin/users/[id]/reset-onboarding` (met `profiles.onboarding_complete=false` + audit)
  - impersonation : `POST /api/admin/users/[id]/impersonate` (génère un magiclink Supabase + audit) — utile support

### 5.16 Finance
- **URL** : `/app/admin/finance`
- **But UX** : queue cashouts + ledger + anomalies + contrôles
- **Sources DB** :
  - `payments_brand`, `cashouts` (`db_refonte/05_payments_cashouts.sql`)
  - `contest_winnings` (`db_refonte/25_contest_prizes_winnings.sql`)
  - `invoices`, `tax_evidence` (`db_refonte/18_invoices_billing.sql`)
  - risque : `kyc_checks`, `risk_flags`
  - audit : `audit_logs`, `status_history`
- **Permissions** : `finance.read` (write : `finance.write`)
- **APIs** : `GET /api/admin/finance/summary`, `GET /api/admin/finance/ledger`, `GET /api/admin/cashouts` + actions approve/reject/hold
- **Perf** : limiter joins (profil creator/kyc/flags) aux pages nécessaires, pagination stricte.

### 5.17 Factures
- **URL** : `/app/admin/invoices`
- **But UX** : liste, statut, export, accès documents
- **Sources DB** : `invoices`, `tax_evidence` (`db_refonte/18_invoices_billing.sql`)
- **Permissions** : `invoices.read` (write : `invoices.write`)
- **APIs** : `GET /api/admin/invoices` (+ actions)
- **Perf** : pagination + filtres org/brand.

### 5.18 Emails
- **URL** : `/app/admin/emails`
- **But UX** : templates + envois + logs
- **Sources DB** : `notification_templates`, `email_outbox`, `email_logs` (`db_refonte/31_notification_templates.sql` + `db_refonte/39_admin_tables.sql`)
- **Permissions** : `emails.read` (write : `emails.write`)
- **APIs** : `GET /api/admin/notification-templates`, `GET /api/admin/email-outbox`, `GET /api/admin/email-logs`

### 5.19 CRM
- **URL** : `/app/admin/crm`
- **But UX** : leads, assignation, pipeline, actions
- **Sources DB** : `sales_leads` (`db_refonte/39_admin_tables.sql`)
- **Permissions** : `crm.read` (write : `crm.write`)
- **APIs** : `GET/POST/PATCH /api/admin/crm/leads`

### 5.20 Support
- **URL** : `/app/admin/support`
- **But UX** : tickets, SLA, assignations, notes
- **Sources DB** : `support_tickets` (`db_refonte/39_admin_tables.sql`)
- **Permissions** : `support.read` (write : `support.write`)
- **APIs** : `GET/POST/PATCH /api/admin/support/tickets` (+ notes)

### 5.21 Exports
- **URL** : `/app/admin/exports`
- **But UX** : exports CSV actionnables et sécurisés
- **Sources DB** : multi (audit, status, webhooks, finance…)
- **Permissions** : `exports.read` (write : `exports.write`)
- **APIs** : `/api/admin/exports`, `/api/admin/audit/export`

### 5.22 Audit
- **URL** : `/app/admin/audit`
- **But UX** : traçabilité (qui a fait quoi, quand, sur quel objet)
- **Sources DB** : `audit_logs`, `status_history`, `event_log`, `webhooks_stripe`
- **Permissions** : `audit.read`
- **APIs** : `/api/admin/audit/*`

### 5.23 Paramètres
- **URL** : `/app/admin/settings`
- **But UX** : config plateforme + feature flags (safe edits)
- **Sources DB** : `platform_settings`, `feature_flags` (`db_refonte/39_admin_tables.sql`)
- **Permissions** : `settings.read` (write : `settings.write`)
- **APIs** : `GET/PATCH /api/admin/settings`, `GET/PATCH /api/admin/feature-flags`

### 5.24 Équipe (RBAC)
- **URL** : `/app/admin/team`
- **But UX** : gérer les admins, rôles, permissions, overrides
- **Sources DB** : `admin_*` (`db_refonte/42_admin_rbac.sql`)
- **Permissions** : `admin.team.read` (write : `admin.team.write`)
- **APIs** : `GET/PATCH /api/admin/team`

### 5.25 Guide
- **URL** : `/app/admin/guide`
- **But UX** : formation interne + aide contextuelle
- **Sources DB** : contenu guide + (optionnel) playbooks `admin_playbooks`
- **Permissions** : `guide.read`

---

## 6) Interconnexion Brand/Creator/Admin (exemples concrets)

### 6.1 Création concours (Marque → Admin)
- Marque crée un concours dans `/app/brand/contests/new` :
  - insertion `contests` (brand_id = `profiles.id` de la marque) + `contest_assets` + `contest_terms` + tags.
- Admin voit ce concours dans `/app/admin/contests` et peut :
  - auditer l’état,
  - corriger (si `contests.write`),
  - relier à org / assets / tags,
  - monitorer la perf (via `contest_stats`).

### 6.2 Participation (Créateur → Marque/Admin)
- Créateur participe à `/app/creator/contests/[id]/participate` :
  - insertion `submissions` (creator_id, contest_id, status=pending)
  - métriques dans `metrics_daily` (agrégation)
- Marque modère via ses pages concours / submissions (RLS) :
  - update `submissions.status` + création/gestion `moderation_queue` / `moderation_actions`
- Admin peut intervenir via `/app/admin/moderation` et `/app/admin/submissions` (service role + RBAC).

### 6.3 Paiements et gains (Marque → Créateur → Admin)
- Marque paye/fund : `payments_brand`
- Gains : `contest_winnings` (créateur) + paiement effectif `paid_at`
- Cashout créateur : `cashouts` (requested/processing/paid/failed)
- Admin contrôle dans `/app/admin/finance` + audits + liens vers KYC/risk.

### 6.4 Notifications / messages (tous rôles)
- Messages : `messages_threads`, `messages`, `messages_attachments`
- Notifications : `notifications`, `notification_preferences`, `push_tokens`
- Admin supervise via modules audit/emails/support si nécessaire.

### 6.5 Pages Marque (référence rapide, pour comprendre les liens)
Ces pages consomment Supabase **SSR + RLS** et écrivent dans les mêmes tables que l’admin supervise :
- `/app/brand/dashboard` : KPI marque (contests/submissions/payments) → `contests`, `submissions`, `payments_brand`, `metrics_daily`
- `/app/brand/contests` (+ `/new`, `/[id]`, `/[id]/submissions`, `/[id]/leaderboard`) → `contests`, `contest_assets`, `submissions`, `leaderboard`
- `/app/brand/billing` + `/payments` : facturation/paiements → `payments_brand`, `invoices`
- `/app/brand/notifications` : notifications → `notifications`
- `/app/brand/messages` : messagerie → `messages_threads`, `messages`, `messages_attachments`
- `/app/brand/settings` : profil marque → `profile_brands` (+ éventuellement orgs)

### 6.6 Pages Créateur (référence rapide, pour comprendre les liens)
- `/app/creator/dashboard` : KPI + recommandations → `submissions`, `contest_winnings`, `cashouts`, `notifications`
- `/app/creator/contests` + `/[id]` + `/[id]/participate` + `/[id]/leaderboard` → `contests`, `submissions`, `leaderboard`
- `/app/creator/submissions` : suivi de ses participations → `submissions`, `metrics_daily`
- `/app/creator/wallet` : gains/cashouts → `contest_winnings`, `cashouts`
- `/app/creator/notifications` : notifications → `notifications`
- `/app/creator/messages` : messagerie → `messages_threads`, `messages`, `messages_attachments`
- `/app/creator/settings` : profil créateur → `profile_creators` (+ `platform_accounts` si connexion plateforme)

---

## 7) Performance (principes + checklist)

### 7.1 Principes
- Toujours paginer (`limit/page`) et trier sur index.
- Séparer “liste” (champs courts) et “détail” (payload/JSON).
- Préférer views/agrégations pour KPI (`contest_stats`, `leaderboard`, `event_log_utm_daily`).
- Éviter les N+1 : précharger les profils liés en batch (IN ids) ou via join simple.

### 7.2 Checklist par page
- Temps de réponse API < 300–800ms pour listes (selon joins).
- Aucune mutation sans CSRF + rate-limit + audit.
- Aucun affichage d’UUID brut en UX (utiliser `lookup`/selecteurs).
- Liens croisés (user/org/brand/contest/submission) présents partout.

### 7.3 Storage (assets & PDFs) : perf + sécurité
Le stockage Supabase (buckets) a des règles spécifiques (RLS sur `storage.objects`) :
- bucket `contest_assets` : création + policies via `db_refonte/12a_create_contest_assets_bucket.sql` et `db_refonte/12_storage_policies.sql` (+ scripts de fix `db_refonte/12c_*` / `db_refonte/12e_*`)
- bucket `invoices` : création via `db_refonte/12b_create_invoices_bucket.sql`

Règle UX/perf :
- ne jamais afficher des blobs/objets lourds en liste ; afficher une vignette/URL et ouvrir le détail au clic.

---

## 8) Mapping DB_refonte (index rapide)

Tables présentes dans `db_refonte` (créées via `CREATE TABLE IF NOT EXISTS public.*`) :
`admin_notes`, `admin_permissions`, `admin_playbooks`, `admin_role_permissions`, `admin_roles`, `admin_saved_views`, `admin_staff`, `admin_staff_permission_overrides`, `admin_staff_roles`, `admin_task_events`, `admin_tasks`, `admin_ui_preferences`, `assets`, `audit_logs`, `campaign_assets`, `campaign_contests`, `campaign_metrics_daily`, `campaigns`, `cashouts`, `contest_assets`, `contest_favorites`, `contest_prizes`, `contest_tag_links`, `contest_tags`, `contest_terms`, `contest_terms_acceptances`, `contest_winnings`, `contests`, `email_logs`, `email_outbox`, `event_log`, `feature_flags`, `follows`, `ingestion_errors`, `ingestion_jobs`, `invoices`, `kyc_checks`, `messages`, `messages_attachments`, `messages_threads`, `metrics_daily`, `moderation_actions`, `moderation_queue`, `moderation_rules`, `moderation_rule_versions`, `notification_preferences`, `notification_templates`, `notifications`, `org_members`, `orgs`, `payments_brand`, `platform_accounts`, `platform_oauth_tokens`, `platform_settings`, `profile_brands`, `profile_creators`, `profiles`, `push_tokens`, `rate_limits`, `risk_flags`, `sales_leads`, `status_history`, `submission_comments`, `submissions`, `support_tickets`, `tax_evidence`, `webhook_deliveries`, `webhook_endpoints`, `webhooks_stripe`.

Views présentes dans `db_refonte` :
`contest_stats`, `event_log_utm`, `event_log_utm_daily`, `leaderboard`, `public_profiles`.

---

## 9) Ce qui rend l’admin “pro” (résumé)
- Les pages ne “montrent pas la DB”, elles montrent : **contexte → décision → action**.
- La DB est la source de vérité (`db_refonte`) et l’admin manipule via APIs sécurisées.
- La sécurité est double : RLS pour Brand/Creator + RBAC/CSRF/audit pour Admin (service role).
- La performance est un choix d’architecture : vues/agrégations, pagination, pas de JSON brut sur listes.

---

## Annexes

### A) Index des endpoints Admin (source : `src/app/api/admin/*`)
Objectif : savoir “où appeler quoi” (par module), et faciliter la revue sécurité (RBAC/CSRF/audit).

- **Navigation / shell**
  - `GET /api/admin/inbox/summary` (badge + compteurs)
  - `GET /api/admin/search`, `GET /api/admin/lookup` (recherche globale / selecteurs)
  - `GET|POST|PATCH|DELETE /api/admin/saved-views` (vues sauvegardées)
- **Dashboard**
  - `GET /api/admin/dashboard/report`
  - `GET /api/admin/kpis`
- **Inbox / tâches**
  - `GET /api/admin/inbox/items`
  - `GET /api/admin/tasks`, `PATCH /api/admin/tasks/[id]`
  - `GET /api/admin/tasks/[id]/events`
  - `POST /api/admin/tasks/[id]/comment`
  - `POST /api/admin/tasks/[id]/assign-to-me`
- **Marques / orgs**
  - `GET|POST /api/admin/brands`
  - `GET|PATCH /api/admin/brands/[id]`
- **Concours**
  - `GET|POST /api/admin/contests`
  - `GET|PATCH /api/admin/contests/[id]`
  - `POST /api/admin/contests/[id]/publish|pause|end|archive`
  - `GET /api/admin/contest-terms`, `GET /api/admin/contest-tags`, `GET /api/admin/contest-assets`
- **Soumissions**
  - `GET /api/admin/submissions`
- **Modération**
  - `GET /api/admin/moderation/queue`
  - `POST /api/admin/moderation/queue/[id]/claim|release`
  - `GET|POST /api/admin/moderation/rules`, `GET|PATCH /api/admin/moderation/rules/[id]`
  - `GET /api/admin/moderation/rules/[id]/versions`
  - `POST /api/admin/moderation/rules/simulate`
  - `GET /api/admin/moderation/history`
- **Intégrations / Webhooks**
  - `GET /api/admin/webhook-endpoints`
  - `GET /api/admin/webhook-deliveries`, `GET /api/admin/webhook-deliveries/stats`
  - `GET /api/admin/webhook-deliveries/[id]`, `POST /api/admin/webhook-deliveries/[id]/retry`
  - `GET /api/admin/webhooks/stripe`
- **Ingestion / plateformes**
  - `GET /api/admin/platform-accounts`
  - `GET /api/admin/ingestion-jobs`, `POST /api/admin/ingestion-jobs/[id]/rerun`
  - `GET /api/admin/ingestion-errors`, `POST /api/admin/ingestion-errors/[id]/resolve`
- **KYC / risque**
  - `GET /api/admin/kyc-checks`
  - `GET /api/admin/risk-flags`
- **Finance**
  - `GET /api/admin/finance/summary`, `GET /api/admin/finance/ledger`
  - `GET /api/admin/cashouts`
  - `POST /api/admin/cashouts/[id]/approve|hold|reject`
- **Factures**
  - `GET /api/admin/invoices`
  - `POST /api/admin/invoices/[id]/generate|void`
- **Emails / templates**
  - `GET|PATCH /api/admin/notification-templates`, `GET|PATCH /api/admin/notification-templates/[id]`
  - `GET /api/admin/email-outbox`, `POST /api/admin/email-outbox/dispatch`
  - `GET /api/admin/email-logs`
- **CRM**
  - `GET|POST /api/admin/crm/leads`, `GET|PATCH /api/admin/crm/leads/[id]`
- **Support**
  - `GET|POST /api/admin/support/tickets`, `GET|PATCH /api/admin/support/tickets/[id]`
  - `GET|POST /api/admin/support/tickets/[id]/notes`
- **Exports**
  - `GET /api/admin/exports`
- **Audit**
  - `GET /api/admin/audit/logs`, `GET /api/admin/audit/events`, `GET /api/admin/audit/status-history`
  - `GET /api/admin/audit/export`
- **Settings / Feature flags**
  - `GET|PATCH /api/admin/settings`, `GET|PATCH /api/admin/settings/[key]`
  - `GET|PATCH /api/admin/feature-flags`, `GET|PATCH /api/admin/feature-flags/[key]`
- **Équipe (RBAC)**
  - `POST /api/admin/team/bootstrap` (1er super-admin)
  - `GET /api/admin/team`, `GET|PATCH /api/admin/team/[id]`

### B) Index `db_refonte` (par fichier, par domaine)
Objectif : savoir “où est défini quoi” côté DB, et quels modules/pages sont directement concernés.

- **Fondations / sécurité**
  - `db_refonte/00_extensions_enums.sql` : extensions + enums (types, statuts).
  - `db_refonte/01_functions_core.sql` : fonctions de base (helpers).
  - `db_refonte/10_triggers.sql` : triggers (mise à jour, historiques).
  - `db_refonte/11_rls_policies.sql` : RLS Brand/Creator (socle sécurité côté DB).
  - `db_refonte/38_rate_limits.sql` : `rate_limits` (anti-abus) → APIs sensibles (admin + auth).
  - `db_refonte/14_sanity_checks.sql` : checks “santé DB” (diagnostic).
- **Identité / orgs**
  - `db_refonte/02_profiles.sql` : `profiles`, `profile_brands`, `profile_creators` → tous espaces.
  - `db_refonte/15_orgs.sql` : `orgs`, `org_members` → Brand/Admin (marques, propriétaires).
- **Concours & participation**
  - `db_refonte/03_contests.sql` : `contests`, `contest_terms`, `contest_assets` → Brand/Admin (wizard + gestion).
  - `db_refonte/26_contest_terms_acceptances.sql` : acceptations CGU → Creator/Admin (compliance).
  - `db_refonte/25_contest_prizes_winnings.sql` : `contest_prizes`, `contest_winnings` → Creator (wallet) / Admin (finance).
  - `db_refonte/27_follows_favorites.sql` : `follows`, `contest_favorites` → engagement (Creator/Brand), insights admin.
- **Soumissions & métriques**
  - `db_refonte/04_submissions_metrics.sql` : `submissions`, `metrics_daily` → Creator/Brand/Admin.
  - `db_refonte/30_submission_comments.sql` : commentaires → Admin (modération), Creator/Brand (suivi).
  - `db_refonte/34_submission_limits.sql` + `db_refonte/35_weighted_views_calculation.sql` : contraintes + scoring.
  - `db_refonte/08_views_materialized.sql` : `leaderboard`, `contest_stats`, `leaderboard_materialized` → dashboards + rankings.
  - `db_refonte/33_analytics_materialized.sql` : agrégations analytics (dashboards / performance).
- **Modération, audit, observabilité**
  - `db_refonte/06_moderation_audit.sql` : `moderation_queue`, `moderation_rules`, `moderation_actions`, `audit_logs`.
  - `db_refonte/21_moderation_history.sql` : historique modération.
  - `db_refonte/45_moderation_rules_lifecycle.sql` : lifecycle (draft/published + versions).
  - `db_refonte/29_status_history.sql` : `status_history` (timeline statuts).
  - `db_refonte/24_event_log.sql` + `db_refonte/49_event_log_utm_views.sql` : `event_log` + vues UTM → marketing/attribution.
- **Paiements / facturation**
  - `db_refonte/05_payments_cashouts.sql` : `payments_brand`, `cashouts`, `webhooks_stripe`.
  - `db_refonte/18_invoices_billing.sql` : `invoices`, `tax_evidence` → Brand/Admin (billing) + exports.
- **KYC / risque**
  - `db_refonte/19_kyc_risk.sql` : `kyc_checks`, `risk_flags` → Admin (risk), Creator/Brand (compliance).
- **Messagerie & notifications**
  - `db_refonte/07_messaging_notifications.sql` : notifications (socle) + préférences.
  - `db_refonte/22_messaging.sql` + `db_refonte/36_messages_attachments.sql` : `messages_threads`, `messages`, `messages_attachments`.
  - `db_refonte/17_notification_center.sql` + `db_refonte/31_notification_templates.sql` : centre + templates.
- **Intégrations / ingestion**
  - `db_refonte/16_platform_links.sql` : `platform_accounts`, `platform_oauth_tokens`, `ingestion_jobs`, `ingestion_errors`.
  - `db_refonte/46_ingestion_errors_resolution.sql` : workflow de résolution ingestion.
  - `db_refonte/23_webhooks_outbound.sql` : `webhook_endpoints`, `webhook_deliveries`.
- **Assets & storage**
  - `db_refonte/20_assets.sql` : `assets` (métadonnées).
  - `db_refonte/12_storage_policies.sql` + `db_refonte/12*_create_*_bucket.sql` : buckets + policies storage.
  - `db_refonte/12c_fix_contest_assets_rls.sql` / `db_refonte/12e_verify_and_fix_contest_assets_rls.sql` : scripts de correction.
- **Admin “Ops Center” (inbox, vues, RBAC, guides)**
  - `db_refonte/39_admin_tables.sql` : tables admin-support (ex: `platform_settings`, `feature_flags`, `support_tickets`, `sales_leads`, `email_outbox`, `email_logs`).
  - `db_refonte/41_admin_saved_views.sql` : `admin_saved_views` (vues sauvegardées).
  - `db_refonte/42_admin_rbac.sql` : `admin_staff`, `admin_roles`, `admin_permissions`, mappings + RLS/RBAC.
  - `db_refonte/43_admin_inbox_permissions.sql` : permission `inbox.read`.
  - `db_refonte/44_admin_guide_permissions.sql` : permissions guide/admin docs.
  - `db_refonte/47_admin_ops_data.sql` : `admin_tasks`, `admin_task_events`, `admin_notes`, `admin_playbooks`, `admin_ui_preferences`.
  - `db_refonte/50_admin_ops_permissions.sql` : permissions `tasks.*`, `notes.*`, `playbooks.*`, `ui_prefs.*`, `campaigns.*`.
- **Marketing**
  - `db_refonte/48_marketing_campaigns.sql` : `campaigns`, `campaign_contests`, `campaign_assets`, `campaign_metrics_daily` → Admin/Brand (pilotage).
- **Orchestration**
  - `db_refonte/13_seed_minimal.sql`, `db_refonte/40_seed_admin_minimal.sql` : seeds (démarrage).
  - `db_refonte/RUN_ALL_LOCALLY.sql` : exécution locale (bootstrap complet).
