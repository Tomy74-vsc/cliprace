# ClipRace – Plan De Mise En Œuvre Full‑Stack Complet

> Objectif : livrer une application ClipRace totalement alignée avec la refonte PostgreSQL/Supabase, couvrant landing, authentification, interfaces brand/creator/admin, messagerie, métriques, paiements & notifications – en garantissant sécurité, performance et expérience professionnelle.

---

## 1. Gouvernance & Préambule
- **Mettre à jour la documentation** : README, 07_RUNBOOK.md, REPORT_DB_REFONTE_AUDIT.md avec le nouvel ordre d’exécution (00 → 36 → 11 → 10 → 14) et l’état « DB OK ».
- **Regénérer les types Supabase**  
  - Commande : `supabase gen types typescript --project-id <project-id> --schema public > src/types/supabase.ts` (puis mettre à jour `src/types/api.ts` si besoin).  
  - Conséquence : toutes les surfaces TS/React doivent être adaptées aux nouveaux champs (contest.brief_md, submissions.platform, etc.).
- **Mettre à jour les configs Supabase côté client** : vérifier `.env.local` (SUPABASE_URL, SUPABASE_ANON_KEY, SERVICE_ROLE); centraliser dans `lib/config`.
- **Sécurité** : valider l’owner des fonctions `SECURITY DEFINER` sur Supabase (owner = `postgres`/rôle projet).

---

## 2. Authentification & Profils
### 2.1 API signup/login
- **Adapter `/api/auth/signup`** (src/app/api/auth/signup/route.ts)  
  - Utiliser tables `profile_brands` & `profile_creators`. (Remplacer `profiles_brand`/`profiles_creator` → `profile_brands`/`profile_creators`.)  
  - Simplifier la création de profil :  
    - `profiles`: coller { id, email, role, display_name? (default email prefix), country? }  
    - Supprimer champs obsolètes (`name`, `is_verified`).  
    - Option: laisser le trigger DB créer `profile_*` automatiquement (si configuré) pour réduire le couplage.
  - Alignement RLS : requêtes via `getSupabaseAdmin()` (service_role) → ok.
- **Compléter `/api/auth/login`/`logout`/`reset`** : vérifier qu’ils n’écrivent pas dans des colonnes disparues.
- **Supprimer routes fantômes** comme `complete-profile` (dossier vide) ou les réécrire pour gérer l’étape 2 (profil + org) si nécessaire.

### 2.2 Signup UI (src/app/(auth)/signup/page.tsx)
- Champs : email, mot de passe, rôle (`admin?`), option org.  
- Étape 2 (email confirmé) : ajouter un bouton « Compléter mon profil » qui redirige vers `brand/onboarding` ou `creator/onboarding`.  
- Ajouter des validations alignées avec `SignupSchema`.  
- Supprimer les mentions de `SignupSchema` non alignées (ex : `setValue` de champs inexistants).

---

## 3. Logique Concours (Brand Side)
### 3.1 Création concours (`/api/brand/contests`, UI brand/new)
- Mapper le formulaire multi-step sur le schéma :  
  - `title` → `contests.title`  
  - `description` → `brief_md` (Markdown)  
  - `visual_url` → `cover_url`  
  - `hashtags` → insertion dans `contest_tags` + `contest_tag_links` (créer tags si absents)  
  - `rules_text` → `contest_terms` (option : `contest_terms` Markdown, lier via `contest_terms_id`)  
  - `creation` → slug unique (utiliser slugify).  
  - `dates` → `start_at`, `end_at`.  
  - `budget/prizes` : `budget_cents`, `prize_pool_cents` (option calcul 85%).  
  - `creator_selection` → `networks` (platform[]), `max_submissions_per_creator` si besoin.  
  - `selected_creators` → gérer via table `contest_terms_acceptances` ou `contest_invites` (non dispo => backlog).
- API  
  - Validation avec Zod alignée.  
  - Insertion `contest_prizes` (position, percentage/amount).  
  - Option: stocker `contest_assets` via `contest_assets` + stockage Supabase (à implémenter).

### 3.2 Gestion concours (list/detail)
- GET `/api/brand/contests`: filtrer `status`, `org_id`.  
  - Sélection `contests` + agrégats via `contest_stats` (vue).  
  - UI: tableau + KPI (total submissions, budget).  
  - Détail: intégrer `contest_terms`, `contest_assets`, leaderboard (vue), soumissions.

### 3.3 Paiements brand
- `payments_brand`: afficher l’historique, statut Stripe.  
- Ajouter interface de factures (`invoices`) via `brand/invoices` + API `/api/brand/invoices`.

---

## 4. Interface Creator
### 4.1 Découvrir & participer aux concours
- `creator/discover`: requêtes sur `contests` (status active), `contest_tags`, `networks`.  
- `cts` route: utiliser `contest_stats`.  
- `join` → bouton ouvre un modal logo CGU + `contest_terms_acceptances` (insérer via RPC ou `INSERT`).

### 4.2 Soumissions
- `/api/submissions` (POST)  
  - Champs requis : `contest_id`, `external_url`, `platform`, `title?`, `thumbnail_url?`.  
  - `submitted_at = now`.  
  - Vérifier `can_creator_submit()` avant insertion.  
  - Uploader assets (option) via `assets` + storage `ugc_videos`.  
- UI `creator/submissions/page.tsx`  
  - Remplacer `network` → `platform`, `video_url` → `external_url`.  
  - Joindre `public.contest_stats` pour KPIs.  
  - Afficher statut (pending/approved/rejected) + `moderation_notes`/`rejection_reason`.

### 4.3 Metrics & résultats
- `metrics_daily` : requêtes (latest row per submission) → `weighted_views`.  
- Leaderboard: consommer `public.leaderboard` ou `get_contest_leaderboard` via API (limit 30).  
- Widgets: courbe performance (agrégations par `metric_date`).  
- Notifications: informer quand submission approuvée/gagnée.

---

## 5. Interface Admin
### 5.1 Dashboard modération
- GET `/api/moderation/submissions`  
  - Adapter aux nouveaux statuts (`pending`, `approved`, `rejected`, `removed`).  
  - Utiliser `moderation_queue` (status `pending`, `processing`, `completed`).  
  - Enrichir via `moderation_actions` pour historique (JOIN).  
- Actions approve/reject  
  - Update `submissions` `status`, `moderation_notes`, `approved_at`, `moderated_by`.  
  - Insert `moderation_actions` (target, action, reason).  
  - Renvoyer notification (creator) avec `notifications`.

### 5.2 Messagerie flagged
- Nouveau flux (cf. Section 6) une fois messaging refait → tri sur `messages_attachments`/`moderation_queue`.

### 5.3 Audit & logs
- Consommer `audit_logs` + `status_history`.  
- Tableau `admin/audit` (filtres par table, action).  
- Option: Grafana/Metabase (hors scope).

---

## 6. Messagerie Brand/Creator
### 6.1 Modèle à implémenter
- Tabs DB :
  - `messages_threads`: (id, contest_id, brand_id, creator_id, last_message, unread_for_brand, unread_for_creator, org_id?).  
  - `messages`: (id, thread_id, sender_id, body, read?, created_at).  
  - `messages_attachments`: (id, message_id, asset_id?, url?, mime_type).  
- Storage: bucket `message_attachments` → policies à ajouter (upload par participants).  
- RLS : déjà existantes (11_rls_policies).  

### 6.2 Services
- Reprendre `src/services/messaging.ts` :
  - `listMessageThreads`: query `messages_threads` + join `profiles`.  
  - `createMessageThread`: insert dans `messages_threads`, puis message initial (si texte/attachment).  
  - `getThreadMessages`: SELECT sur `messages` + join `messages_attachments`; set `read`.  
  - `addThreadReply`: upload attachments → storage + `messages_attachments`, update `last_message`.  
  - `flagThreadMessage`: flag via `moderation_queue` ou `moderation_actions` (selon design).  

### 6.3 API routes
- `/api/messages` (GET/POST)  
  - GET: rename params (brand_id/creator_id).  
  - POST: valider contest selon user rôle (option).  
- `/api/messages/[threadId]` (GET): list messages.  
- `/api/messages/[threadId]/reply` (POST): envoi message + attachments.  
- `/api/messages/[threadId]/flag` (POST): insérer `moderation_queue` (type message) + `moderation_actions`.

### 6.4 UI
- Threads: nouvelle grille (liste, preview last msg).  
- Conversation: timeline + upload attachments (drag’n drop).  
- Notifications: mention badge & push via `notifications`.  
- Intégration brand/creator portal + admin flagged.

---

## 7. Notifications & Préférences
- Tables : `notifications`, `notification_preferences`, `push_tokens`, `notification_templates`.  
- **Service `createNotification`**  
  - Lire `notification_preferences` (user_id,event,channel).  
  - Insérer dans `notifications` (user_id, type, content JSONB, read=false).  
  - Option: templating email/push via `notification_templates`.  
- **UI**  
  - Dropdown/centre de notifications (brand/creator/admin).  
  - Page préférences → `notification_preferences` (CRUD).  
  - Support push (PWA) via `push_tokens`.  
- **Emails**  
  - Connecter un provider (Resend, Mailjet) pour envoyer via `notification_templates` (HTML).  
  - Stocker `invoices` + email brand.

---

## 8. Metrics & Leaderboards
- `metrics_daily`  
  - Champ `metric_date` (Date).  
  - Trigger `update_weighted_views`.  
  - Services metrics → upsert (submission_id, metric_date, views, likes, comments, shares).  
- API  
  - `/api/metrics/refresh` (cron) → appelle `compute_daily_metrics`.  
  - `/api/contests/[id]/leaderboard`: lire `get_contest_leaderboard`.  
- UI  
  - Dashboard brand : `brand_dashboard_summary` (MV) + courbes.  
  - Dashboard creator : `creator_dashboard_summary`.  
  - Chart libs (Recharts, Tremor) pour visualiser trends (views/likes).

---

## 9. Paiements & Cashouts
- `payments_brand`  
  - Intégrer Stripe Checkout / Billing → webhook → `payments_brand` + `invoices`.  
  - Dashboard brand/invoices (liste + status).  
- `cashouts`  
  - Form submission (creator).  
  - Statuts `requested` → `processing` → `paid`.  
  - Intégrer Stripe Connect / Transfer (Edge Function).  
  - Notifications + `status_history`.
- `contest_winnings`  
  - Utiliser `finalize_contest` + `contest_prizes`.  
  - UI brand (gagnants) + creator (mes gains).  
  - Lier avec `cashouts`.

---

## 10. Stocks & Assets
- Utiliser table `assets` pour centraliser metadata (owner, org, bucket).  
- Lier :  
  - Avatars → `assets` (owner).  
  - Contest assets → `contest_assets`.  
  - Message attachments → `messages_attachments` + `assets`.  
- Storage policies : vérifier `12_storage_policies.sql` + ajouter bucket `message_attachments`.  
- UI: composants file uploader (drag drop, preview, progress).

---

## 11. Organisations & Collaboration
- Tables : `orgs`, `org_members` (rôles owner/admin/editor/finance).  
- Flows:  
  - Onboarding brand : créer org, inviter membres.  
  - UI `brand/settings/org` → CRUD org + membres.  
- RLS: policies déjà en place (vérifier `org_members_manage`).  
- Intégrer org_id sur contests/payments/assets.

---

## 12. Sécurité & Observabilité
- **RLS tests**: actualiser `tests/security/rls-*.test.ts` vs nouveau schéma.  
- **Logs**:  
  - `audit_logs` (Edge functions) → surfaces admin.  
  - `event_log` (tracking) → dashboard analytics.  
- **Monitoring**: intégrer Sentry/Logflare.  
- **Rate limiting**: `withRateLimit` sur routes critiques (auth, messaging, submissions).  
- **CSRF**: vérifier `api/csrf-token`.  
- **CORS**: ALLOWED_ORIGINS = build config.

---

## 13. UX/UI Pro
- Harmoniser branding (tailwind theme).  
- Layouts distincts : `(auth)`, `(app)` → nav, breadcrumbs.  
- Composants  
  - Tables (DataTable), form steps, modals confirm, toasts.  
  - Charts (Tremor).  
  - Skeletons/loading states constants.  
- Accessibilité  
  - Focus, aria-label, support dark mode, animations respect prefers-reduced-motion.  
- Performance  
  - Lazy load modules (Framer, charts).  
  - RSC pour pages statiques (landing).  
- Internationalisation (option) : next-intl.

---

## 14. Tests & QA
- **Unit tests**: services (messaging, notifications, metrics).  
- **API tests**: via Playwright/Vitest (auth flows, contests, submissions).  
- **E2E**: scénarios brand/creator/admin (depuis login → action).  
- **Seeds**: updater `13_seed_minimal.sql` pour nouveaux champs (facultatif pour dev).

---

## 15. Déploiement & Ops
- **CLI apply**: script `apply-migrations.ps1` → update pour nouveau plan.  
- **Cron jobs** (Supabase Edge Functions ou schedules)  
  - `refresh_analytics_views`  
  - `refresh_leaderboard` (ou utiliser MV)  
  - `archive_ended_contests`  
  - `cleanup_old_data`  
  - ingestion metrics/cron.  
- **Webhooks**: `webhook_endpoints` table → builder UI pour config (signatures HMAC).  
- **CI/CD**: pipeline tests RLS + lint + build.

---

## 16. Extensions & Idées Futures
- **Marketplace**: connecteurs TikTok/Meta API (stockage `platform_accounts`/`platform_oauth_tokens`).  
- **Analytics avancées**: partition `metrics_daily`, dashboards (Metabase).  
- **Gamification**: badges pour créateurs (table `achievements`).  
- **Webhooks entrants**: ingestion via `ingestion_jobs`.  
- **Mobile/PWA**: support push, offline.  
- **AI moderation**: pipeline Edge Function + `moderation_queue`.

---

## Synthèse – Ordre Recommandé
1. Typage & configs (Section 1).  
2. Auth/Profils (Section 2).  
3. Contests brand (Section 3).  
4. Creator submissions (Section 4).  
5. Messaging refonte (Section 6).  
6. Metrics/leaderboards (Section 8).  
7. Notifications & cashouts (Sections 7 & 9).  
8. UI polish + orgs (Sections 10–13).  
9. Tests + déploiement (Sections 14–15).  
10. Extensions futures (Section 16).

En suivant cette roadmap, ClipRace deviendra une plateforme cohérente, sécurisée et évolutive, parfaitement alignée avec la refonte Supabase/PostgreSQL.

