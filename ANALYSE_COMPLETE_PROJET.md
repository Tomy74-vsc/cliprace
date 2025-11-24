# Analyse Complète — ClipRace : Plan vs État Actuel

**Date**: 2024  
**Objectif**: Comparer le plan de reconstruction complet (1730 lignes) avec l'état actuel du projet pour identifier les écarts, les manques et les priorités d'implémentation.

---

## 📊 Vue d'Ensemble

### ✅ Ce qui est en place

#### Infrastructure & Configuration
- ✅ **Next.js 14 App Router** configuré avec TypeScript strict
- ✅ **TailwindCSS** avec design system (variables CSS, dark mode)
- ✅ **Supabase** : clients (anon + service role) + SSR helper
- ✅ **Stripe** : client serveur configuré
- ✅ **ESLint/Prettier** : configuration stricte avec plugins
- ✅ **CSP & Sécurité** : headers configurés dans `next.config.js` (manque `youtube-nocookie.com` dans `frame-src`)
- ✅ **Homepage** : landing page complète avec animations Framer Motion
- ✅ **Arborescence** : structure de dossiers conforme au plan (`src/app`, `src/components`, `src/lib`)

#### Base de Données
- ✅ **36 fichiers SQL** dans `db_refonte/` : schéma complet, RLS, fonctions, triggers
- ✅ **Schéma aligné** avec le plan (profiles, contests, submissions, payments, etc.)

#### Routes API (Structure)
- ✅ **Toutes les routes API** sont créées (squelettes) :
  - Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`
  - Contests: `/api/contests/create`, `/api/contests/[id]/*`
  - Submissions: `/api/submissions/create`, `/api/submissions/[id]/moderate`
  - Payments: `/api/payments/brand/fund`, `/api/payments/creator/cashout`, `/api/payments/stripe/webhook`
  - Messages, Notifications, Uploads, Account (export/delete)
- ⚠️ **État**: Toutes retournent `501 Not Implemented`

#### Pages (Structure)
- ✅ **Pages Auth**: `/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/reset-password`
- ✅ **Pages Créateur**: `/app/creator/dashboard`, `/app/creator/discover`, `/app/creator/contests/[id]`, `/app/creator/submissions`, `/app/creator/wallet`
- ✅ **Pages Marque**: `/app/brand/dashboard`, `/app/brand/contests/new`, `/app/brand/contests/[id]`, `/app/brand/payments`
- ✅ **Pages Admin**: `/app/admin/moderation`
- ✅ **Pages Utilitaires**: `/app/forbidden`, `/app/not-found`, `/legal/terms`
- ⚠️ **État**: Toutes sont des placeholders avec "TODO"

#### Libs & Helpers
- ✅ `lib/env.ts` : validation des variables d'environnement
- ✅ `lib/auth.ts` : helpers `getSession`, `getUserRole`, `requireRole`, `hasOwnership`
- ✅ `lib/supabase/client.ts` : client anon
- ✅ `lib/supabase/server.ts` : admin client (service role)
- ✅ `lib/supabase/ssr.ts` : SSR helper pour Next.js
- ✅ `lib/stripe.ts` : client Stripe serveur
- ✅ `lib/csrf.ts` : helper CSRF (présent)
- ✅ `lib/rateLimit.ts` : helper rate limiting (présent)

#### Composants UI
- ✅ `components/ui/toast.tsx` : ToastProvider (présent)
- ❌ **Manque**: Tous les autres composants UI (buttons, inputs, modals, tables, badges, etc.)

---

## ❌ Ce qui manque (par priorité)

### 🔴 Phase 0 — Socle (Critique)

#### 1. Middleware de Routing & Guards
- ❌ **`middleware.ts`** : Absent
  - Protection routes `/app/*` (redirection si non connecté)
  - Redirection par rôle (creator → `/app/creator/*`, brand → `/app/brand/*`)
  - Gestion des redirections après login

#### 2. Variables d'Environnement
- ❌ **`.env.example`** : Absent (mentionné dans le plan §43)
- ⚠️ **`.env.local`** : Non commité (normal), mais pas de template

#### 3. CSP — YouTube Nocookie
- ⚠️ **`next.config.js`** : `frame-src 'none'` doit inclure `https://www.youtube-nocookie.com`
  - Actuel: `"frame-src 'none'"`
  - Requis: `"frame-src 'self' https://www.youtube-nocookie.com"`

#### 4. Composants UI de Base
- ❌ **Design System** : Aucun composant UI réutilisable
  - Buttons (Primary, Secondary, Ghost, Destructive)
  - Inputs (text, email, textarea, select, checkbox, radio)
  - Cards, Badges, Tables, Dialogs/Modals
  - Skeletons, Empty States
  - Navigation (Header, Sidebar par rôle)

#### 5. Layout App (`(app)/layout.tsx`)
- ❌ **Layout protégé** : Absent
  - Header avec avatar + notifications
  - Sidebar par rôle (creator/brand/admin)
  - Footer minimal
  - Progress bar top (comme homepage)

---

### 🟠 Phase 1 — Auth & Onboarding (Haute Priorité)

#### 1. Routes API Auth — Implémentation
- ❌ **`/api/auth/signup`** : Retourne `501`
  - Créer user Supabase
  - Insérer `profiles` + `profile_creators`/`profile_brands`
  - Retourner session + profil + rôle
- ❌ **`/api/auth/login`** : Retourne `501`
  - Authentifier (email/password ou magic link)
  - Retourner session + profil + rôle
- ❌ **`/api/auth/me`** : Retourne `501`
  - Retourner profil + rôle + flags onboarding
- ❌ **`/api/profile/complete`** : Retourne `501`
  - Finaliser onboarding (liens plateformes, KYC, etc.)

#### 2. Pages Auth — Implémentation
- ❌ **`/auth/signup`** : Placeholder
  - Formulaire email/password + choix rôle
  - Validation Zod
  - Redirection après signup selon rôle
- ❌ **`/auth/login`** : Placeholder
  - Formulaire email/password ou magic link
  - Gestion erreurs
- ❌ **`/auth/verify`** : Placeholder
  - Page après vérification email
- ❌ **`/auth/reset-password`** : Placeholder
  - Formulaire reset password

#### 3. Validators Zod
- ❌ **`lib/validators/`** : Dossier absent
  - `signupSchema`, `loginSchema`, `profileCompleteSchema`
  - Validation URLs vidéo par plateforme (`lib/validators/platforms.ts`)

#### 4. Gestion Erreurs Standardisée
- ⚠️ **`lib/errors.ts`** : Mentionné dans le plan (§19) mais absent
  - `AppError` class
  - `ErrorCodes` enum
  - `formatErrorResponse` helper

---

### 🟡 Phase 2 — Créateur MVP (Priorité Moyenne)

#### 1. Routes API Créateur
- ❌ **`/api/submissions/create`** : Retourne `501`
  - Valider `can_submit_to_contest` (fonction SQL)
  - Valider URL vidéo par plateforme
  - Insérer `submissions(status='pending')`
  - Créer `contest_terms_acceptances` si première participation
  - Notifier marque
- ❌ **`/api/payments/creator/cashout`** : Retourne `501`
  - Vérifier solde (gains - cashouts)
  - Créer `cashouts(status='requested')`
  - Initier payout Stripe Connect
  - Webhook met à jour statut

#### 2. Pages Créateur — Implémentation
- ❌ **`/app/creator/dashboard`** : Placeholder
  - Résumé concours actifs
  - Stats personnelles
  - Notifications non lues
  - Dernières soumissions
- ❌ **`/app/creator/discover`** : Placeholder
  - Liste concours actifs (filtres tags/categories)
  - CTA "Participer"
  - Pagination/infinite scroll
- ❌ **`/app/creator/contests/[id]`** : Placeholder
  - Affichage règles, récompenses, dates
  - Bouton "Participer" (désactivé si inéligible)
  - Formulaire soumission (platform, video_url, caption)
- ❌ **`/app/creator/submissions`** : Placeholder
  - Liste soumissions avec statut
  - Feedback modération
  - Tri/filtres
- ❌ **`/app/creator/wallet`** : Placeholder
  - Solde (gains - cashouts)
  - Historique cashouts
  - Bouton "Retirer"

#### 3. Composants Créateur
- ❌ **`components/contest/`** : Absent
  - `ContestCard`, `ContestDetail`, `ContestList`
- ❌ **`components/submission/`** : Absent
  - `SubmissionForm`, `SubmissionList`, `SubmissionStatusBadge`

---

### 🟡 Phase 3 — Marque MVP (Priorité Moyenne)

#### 1. Routes API Marque
- ❌ **`/api/contests/create`** : Retourne `501`
  - Créer `contests(status='draft')`
  - Créer `contest_terms`, `contest_assets`, `contest_prizes`
  - Utiliser fonction SQL transactionnelle `create_contest_complete` (si existe)
- ❌ **`/api/contests/[id]/update`** : Retourne `501`
  - Autosave brouillon (étapes 1-4)
  - UPSERT `contests`, `contest_terms`, `contest_prizes`
- ❌ **`/api/contests/[id]/publish`** : Retourne `501`
  - Vérifier `payments_brand.status='succeeded'`
  - Passer `contests.status='active'`
- ❌ **`/api/contests/[id]/close`** : Retourne `501`
  - Passer `contests.status='ended'`
- ❌ **`/api/contests/[id]/winners/compute`** : Retourne `501`
  - Appeler fonction SQL `finalize_contest` ou `compute_payouts`
  - Persister `contest_winnings`
- ❌ **`/api/submissions/[id]/moderate`** : Retourne `501`
  - Approve/reject avec note
  - Écrire `moderation_actions`
  - Mettre à jour `submissions.status`
- ❌ **`/api/payments/brand/fund`** : Retourne `501`
  - Créer `payments_brand(status='requires_payment')`
  - Créer session Stripe Checkout
  - Retourner `checkout_url`

#### 2. Pages Marque — Implémentation
- ❌ **`/app/brand/dashboard`** : Placeholder
  - KPIs (concours actifs, budget consommé)
  - Soumissions à modérer
  - Messages récents
- ❌ **`/app/brand/contests/new`** : Placeholder
  - Wizard 5 étapes (infos, dates, ciblage, récompenses, paiement)
  - Autosave à chaque étape
  - Résumé final avant paiement
- ❌ **`/app/brand/contests/[id]`** : Placeholder
  - Tabs: Résumé | Soumissions | Classement | Analytics | Paramètres
  - Modération (approve/reject)
  - Leaderboard (top 10)
  - Analytics (graphiques `metrics_daily`)
- ❌ **`/app/brand/payments`** : Placeholder
  - Funding (historique `payments_brand`)
  - Factures (`invoices_billing`)

#### 3. Composants Marque
- ❌ **`components/contest/ContestWizard`** : Absent
- ❌ **`components/submission/ModerationPanel`** : Absent
- ❌ **`components/analytics/ContestAnalytics`** : Absent

---

### 🟢 Phase 4 — Classement & Analytics (Priorité Basse)

#### 1. Routes API Analytics
- ❌ **`/api/contests/[id]/leaderboard/recompute`** : Retourne `501`
  - Appeler `refresh_leaderboard()` ou `refresh_all_materialized_views()`
  - Retourner top 10

#### 2. Fonctions SQL — Vérification
- ⚠️ **Fonctions métier** : À vérifier dans `db_refonte/`
  - `is_contest_active(p_contest_id)` → bool
  - `can_creator_submit(p_contest_id, p_creator_id)` → bool
  - `get_contest_leaderboard(p_contest_id, p_limit)` → Top N
  - `refresh_leaderboard()` / `refresh_all_materialized_views()`
  - `compute_payouts(p_contest_id)`
  - `finalize_contest(p_contest_id)`

#### 3. Cron Jobs
- ❌ **`/api/cron/refresh-leaderboard`** : Absent
- ❌ **`vercel.json`** : Absent (pour cron Vercel)

---

### 🟢 Phase 5 — Paiements (Priorité Basse)

#### 1. Webhook Stripe
- ❌ **`/api/payments/stripe/webhook`** : Retourne `501`
  - Vérifier signature
  - Idempotency via `webhooks_stripe` table
  - Mettre à jour `payments_brand.status` (succeeded/failed/refunded)
  - Si succeeded → publier concours (`status='active'`)
  - Mettre à jour `cashouts.status` (paid/failed)

#### 2. Stripe Connect
- ❌ **`/api/stripe/connect/onboard`** : Absent (mentionné dans le plan §37)
  - Créer compte Stripe Express
  - Générer onboarding link
  - Webhook `account.updated` → mettre à jour KYC status

---

### 🔵 Phase 6 — Admin & Audit (Priorité Basse)

#### 1. Pages Admin
- ❌ **`/app/admin/dashboard`** : Absent
- ❌ **`/app/admin/audit`** : Absent
  - Recherche `audit_logs`, `event_log`
  - Export CSV

#### 2. Routes API Admin
- ⚠️ Routes modération existent mais non implémentées

---

### 🔵 Phase 7 — Polish & Sécurité (Priorité Basse)

#### 1. Rate Limiting
- ✅ **`lib/rateLimit.ts`** : Présent (à vérifier implémentation)
- ❌ **Application** : Non appliqué aux routes sensibles
  - `/api/auth/signup`: 5 req/15min par IP
  - `/api/submissions/create`: 10 req/heure par user
  - `/api/payments/brand/fund`: 3 req/heure par user

#### 2. CSRF
- ✅ **`lib/csrf.ts`** : Présent (à vérifier implémentation)
- ❌ **Application** : Non appliqué aux formulaires

#### 3. Uploads Signés
- ❌ **`/api/uploads/contest-asset/sign`** : Retourne `501`
- ❌ **`/api/uploads/message-attachment/sign`** : Retourne `501`
  - Validation MIME/size
  - Génération URL signée Supabase
  - Nommage UUID

#### 4. Messagerie
- ❌ **`/api/messages/threads`** : Retourne `501`
- ❌ **`/api/messages/threads/[id]/messages`** : Retourne `501`
- ❌ **Pages messages** : Absentes (`/app/creator/messages`, `/app/brand/messages`)

#### 5. Notifications
- ❌ **`/api/notifications/dispatch`** : Retourne `501`
- ❌ **Centre notifications** : Absent (`/app/creator/notifications`, `/app/brand/notifications`)

---

## 📋 Checklist d'Alignement avec le Plan

### Architecture Applicative
- ✅ Arborescence conforme (§2)
- ✅ Next.js 14 App Router + TypeScript strict
- ✅ TailwindCSS + design system (partiel)
- ✅ Supabase (`@supabase/supabase-js` + `@supabase/ssr`)
- ✅ Stripe configuré
- ⚠️ SendGrid (optionnel, non configuré)
- ⚠️ next-themes (présent dans package.json, non utilisé)
- ✅ framer-motion (utilisé sur homepage)

### Sécurité (§4)
- ✅ RLS activées (via DB)
- ✅ Service role uniquement serveur
- ⚠️ CSP : manque `youtube-nocookie.com` dans `frame-src`
- ❌ CSRF : helper présent mais non appliqué
- ⚠️ Rate limiting : helper présent mais non appliqué
- ❌ Uploads : validation manquante
- ❌ Webhooks Stripe : signature non implémentée
- ❌ Logs & audit : `event_log` / `audit_logs` non utilisés

### UX Transverse (§5)
- ✅ Homepage avec animations (Framer Motion)
- ❌ Forms guidés : non implémentés
- ❌ Skeletons/spinners : non implémentés
- ❌ Optimistic UI : non implémenté
- ❌ Boutons contextualisés : non implémentés
- ⚠️ Notifications toast : ToastProvider présent mais non utilisé
- ❌ Accessibilité : labels, focus, contraste (partiel)

### Auth & Onboarding (§6)
- ❌ Parcours signup/login : non implémenté
- ❌ Choix rôle : non implémenté
- ❌ Onboarding spécifique : non implémenté
- ❌ Redirections par rôle : non implémentées

### Interface Créateur (§7)
- ❌ Dashboard : placeholder
- ❌ Discover : placeholder
- ❌ Contest details : placeholder
- ❌ Soumissions : placeholder
- ❌ Wallet : placeholder
- ❌ Messages : absent
- ❌ Settings : absent

### Interface Marque (§8)
- ❌ Dashboard : placeholder
- ❌ Wizard création : placeholder
- ❌ Détail concours : placeholder
- ❌ Paiements : placeholder
- ❌ Messages : absent
- ❌ Settings : absent

### Concours — Détails Techniques (§10)
- ❌ Cycle de vie : non implémenté
- ❌ Terms & consentements : non implémenté
- ❌ Participation : non implémentée
- ❌ Modération : non implémentée
- ❌ Classement : non implémenté
- ❌ Attribution gagnants : non implémentée
- ❌ Versements : non implémentés

### Paiements (§11)
- ❌ Funding marque : non implémenté
- ❌ Webhooks Stripe : non implémentés
- ❌ Cashout créateur : non implémenté
- ❌ Stripe Connect : non implémenté

### Design System (§32)
- ✅ Tokens couleurs (CSS vars)
- ✅ Typographie (Plus Jakarta Sans + Inter)
- ✅ Espacements, border-radius
- ✅ Dark mode (configuré)
- ❌ Composants UI : absents (buttons, inputs, cards, etc.)
- ❌ Motions & micro-interactions : partiel (homepage uniquement)
- ❌ Layouts responsive : partiel

---

## 🎯 Plan d'Action Recommandé

### Sprint 1 — Socle Critique (1-2 semaines)
1. **Middleware** : Routing + guards par rôle
2. **`.env.example`** : Template variables d'environnement
3. **CSP** : Ajouter `youtube-nocookie.com` dans `frame-src`
4. **Composants UI de base** : Buttons, Inputs, Cards, Badges, Modals
5. **Layout App** : Header + Sidebar + Footer

### Sprint 2 — Auth & Onboarding (1 semaine)
1. **Routes API Auth** : Signup, Login, Me, Profile Complete
2. **Pages Auth** : Signup, Login, Verify
3. **Validators Zod** : Schemas auth + platforms
4. **Gestion erreurs** : `lib/errors.ts`
5. **Tests** : Parcours signup → onboarding → dashboard

### Sprint 3 — Créateur MVP (2 semaines)
1. **Routes API** : Submissions Create, Cashout
2. **Pages Créateur** : Dashboard, Discover, Contest Detail, Submissions, Wallet
3. **Composants** : ContestCard, SubmissionForm, SubmissionList
4. **Intégration** : Tests parcours complet créateur

### Sprint 4 — Marque MVP (2 semaines)
1. **Routes API** : Contests Create/Update/Publish/Close, Submissions Moderate, Payments Fund
2. **Pages Marque** : Dashboard, Contest Wizard, Contest Detail, Payments
3. **Composants** : ContestWizard, ModerationPanel
4. **Intégration** : Tests parcours complet marque

### Sprint 5 — Paiements & Webhooks (1 semaine)
1. **Webhook Stripe** : Signature + idempotency
2. **Stripe Connect** : Onboarding créateurs
3. **Tests** : Flux paiement complet (test mode)

### Sprint 6 — Analytics & Classement (1 semaine)
1. **Routes API** : Leaderboard Recompute
2. **Cron Jobs** : Refresh leaderboard (Vercel cron)
3. **Pages** : Analytics dashboards

### Sprint 7 — Polish (1 semaine)
1. **Rate Limiting** : Application aux routes sensibles
2. **CSRF** : Application aux formulaires
3. **Uploads** : Validation + URLs signées
4. **Messagerie** : Routes + pages
5. **Notifications** : Centre + dispatch

---

## 📝 Notes Importantes

### Alignements avec la DB
- ✅ Le schéma DB (`db_refonte/`) est complet et aligné avec le plan
- ⚠️ **Vérifier** : Fonctions SQL métier existent-elles ?
  - `can_creator_submit`, `is_contest_active`, `get_contest_leaderboard`, `refresh_leaderboard`, `finalize_contest`
- ⚠️ **Vérifier** : Tables `webhooks_stripe`, `rate_limits` existent-elles ?

### Points de Vigilance
1. **Statuts concours** : Le plan mentionne `'closed'` mais la DB utilise `'ended'` (§36)
2. **Dates concours** : Le plan mentionne `starts_at`/`ends_at` mais la DB utilise `start_at`/`end_at` (§36)
3. **Plateformes** : Le plan mentionne `allowed_platforms` JSONB mais la DB utilise `networks platform[]` (§36)
4. **Modération** : Le plan mentionne `moderation_history` mais la DB utilise `moderation_actions` (§36)
5. **Gagnants** : Le plan mentionne `submissions.status='won'` mais la DB utilise `contest_winnings` (§36)

### Recommandations
1. **Créer un fichier de mapping** : Plan terminologie → DB terminologie
2. **Vérifier fonctions SQL** : S'assurer que toutes les fonctions mentionnées dans le plan existent dans `db_refonte/`
3. **Tests** : Créer des fixtures de test pour valider les parcours
4. **Documentation** : Ajouter des commentaires "Source: table/route" dans chaque fichier (mentionné dans le plan §27)

---

## ✅ Conclusion

**État actuel** : **~15% complété**
- ✅ Infrastructure : 80%
- ✅ Structure (routes/pages) : 90%
- ✅ Implémentation fonctionnelle : 5%
- ✅ Composants UI : 5%
- ✅ Intégrations (Stripe, Supabase) : 30%

**Prochaines étapes prioritaires** :
1. Middleware + Layout App
2. Composants UI de base
3. Auth complète (signup/login)
4. Créateur MVP (discover + submission)
5. Marque MVP (wizard + modération)

Le projet a une **excellente base structurelle** mais nécessite une **implémentation fonctionnelle complète** pour être opérationnel.

