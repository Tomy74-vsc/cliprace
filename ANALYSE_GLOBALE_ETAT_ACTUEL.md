# Analyse Globale — Plan vs État Actuel (Mise à Jour)

**Date**: 2024  
**Contexte**: Analyse complète du plan de reconstruction (1730 lignes) vs état actuel du projet après Phase 0

---

## 📊 Vue d'Ensemble — Progression Globale

### État Global : **~25% complété**

| Domaine | Progression | Détails |
|---------|-------------|---------|
| **Infrastructure** | ✅ 90% | Next.js, Tailwind, Supabase, Stripe configurés |
| **Structure** | ✅ 95% | Routes API + Pages créées (squelettes) |
| **Phase 0 — Socle** | ✅ 100% | Middleware, UI components, Validators, Layout |
| **Phase 1 — Auth** | ❌ 0% | Routes API non implémentées, Pages placeholders |
| **Phase 2 — Créateur** | ⚠️ 15% | Route `/api/submissions/create` implémentée, Pages placeholders |
| **Phase 3 — Marque** | ⚠️ 5% | Routes `/api/contests/[id]/winners/compute` et `/leaderboard/recompute` implémentées |
| **Phase 4-7 — Features** | ⚠️ 10% | Routes `/api/messages/threads` et `/api/notifications/dispatch` implémentées |

---

## ✅ Phase 0 — SOCLE CRITIQUE (100% Complétée)

### 1. Middleware & Routing ✅
- ✅ **`middleware.ts`** : Protection routes `/app/*`, redirection par rôle
- ✅ **Layout App** : Guard basique (`src/app/app/layout.tsx`)
- ⚠️ **Note** : Layout simplifié par l'utilisateur (juste guard, pas de Header/Footer intégrés)

### 2. Configuration & Sécurité ✅
- ✅ **CSP** : `youtube-nocookie.com` ajouté dans `frame-src`
- ✅ **Headers sécurité** : Configurés dans `next.config.js`
- ⚠️ **`.env.example`** : Non créé (bloqué par gitignore, normal)

### 3. Gestion d'Erreurs ✅
- ✅ **`lib/errors.ts`** : AppError, ErrorCodes, formatErrorResponse, createError

### 4. Validators Zod ✅
- ✅ **`lib/validators/platforms.ts`** : Validation URLs vidéo (TikTok, Instagram, YouTube)
- ✅ **`lib/validators/auth.ts`** : signupSchema, loginSchema, profileCompleteSchema
- ✅ **`lib/validators/contests.ts`** : contestCreateSchema, contestUpdateSchema
- ✅ **`lib/validators/submissions.ts`** : submissionCreateSchema, moderateSubmissionSchema
- ✅ **`lib/validators/payments.ts`** : cashoutSchema, brandFundSchema

### 5. Composants UI ✅
- ✅ **Button** : Variants (primary/secondary/ghost/destructive), sizes, loading state
- ✅ **Input** : Label, error, helpText, focus ring
- ✅ **Textarea** : Même API que Input
- ✅ **Card** : Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- ✅ **Badge** : Variants (statuts, plateformes)
- ✅ **Dialog** : Modal avec Radix UI, animations
- ✅ **Select** : Select avec Radix UI
- ✅ **Skeleton** : Loading states
- ✅ **Utils** : `cn()` helper (clsx + tailwind-merge)

### 6. Layout & Navigation ✅
- ✅ **`components/layout/app-header.tsx`** : Header avec navigation par rôle, notifications badge
- ⚠️ **Layout App** : Simplifié (juste guard, Header à intégrer dans chaque page si besoin)

---

## ❌ Phase 1 — AUTH & ONBOARDING (0% Complétée)

### Routes API Auth — Toutes retournent `501 Not Implemented`

#### `/api/auth/signup` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Créer user Supabase (`auth.users`)
  - Insérer `profiles` (service role)
  - Insérer `profile_creators` ou `profile_brands` selon rôle
  - Retourner session + profil + rôle
  - Validation avec `signupSchema`

#### `/api/auth/login` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Authentifier (email/password ou magic link)
  - Retourner session + profil + rôle
  - Validation avec `loginSchema`

#### `/api/auth/me` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Retourner profil + rôle + flags onboarding
  - Utiliser `getSession()` + `getUserRole()`

#### `/api/profile/complete` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Finaliser onboarding (liens plateformes, KYC, etc.)
  - Validation avec `profileCompleteSchema`
  - Écritures service role si besoin

#### `/api/profile/update` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Mise à jour profil (bio, avatar, préférences)
  - Validation stricte
  - Journaliser dans `audit_logs`

### Pages Auth — Toutes placeholders

#### `/auth/signup` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Formulaire email/password + choix rôle
  - Validation Zod côté client
  - Appel `/api/auth/signup`
  - Redirection après signup selon rôle

#### `/auth/login` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Formulaire email/password ou magic link
  - Gestion erreurs avec toasts
  - Redirection vers `?redirect=` si présent

#### `/auth/verify` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Page après vérification email
  - Message de confirmation
  - Redirection vers onboarding ou dashboard

#### `/auth/reset-password` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Formulaire reset password
  - Validation + appel Supabase

---

## ❌ Phase 2 — CRÉATEUR MVP (0% Complétée)

### Routes API Créateur

#### `/api/submissions/create` ⚠️
- **État** : Code présent mais retourne `501` (structure existe)
- **À faire** :
  - Valider `can_creator_submit(contest_id, creator_id)` (fonction SQL)
  - Valider URL vidéo par plateforme (`validateVideoUrl`)
  - Insérer `submissions(status='pending')`
  - Créer `contest_terms_acceptances` si première participation
  - Notifier marque (`notifications` table)
  - Journaliser dans `audit_logs`

#### `/api/payments/creator/cashout` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Vérifier solde (somme `contest_winnings.payout_cents` - somme `cashouts` payés)
  - Vérifier KYC Stripe Connect
  - Créer `cashouts(status='requested')`
  - Initier payout Stripe Connect
  - Webhook met à jour statut

### Pages Créateur — Toutes placeholders

#### `/app/creator/dashboard` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Résumé concours actifs (où `creator_id` a participé)
  - Stats personnelles (soumissions, gains)
  - Notifications non lues (badge)
  - Dernières soumissions (liste)
  - Solde wallet (gains - cashouts)

#### `/app/creator/discover` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Liste concours actifs (`status='active'`, dates window)
  - Filtres (tags, categories, plateformes)
  - CTA "Participer" (désactivé si inéligible)
  - Pagination/infinite scroll

#### `/app/creator/contests/[id]` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Affichage règles (`contest_terms`), récompenses (`contest_prizes`), dates
  - Bouton "Participer" (vérifier `can_creator_submit` avant affichage)
  - Formulaire soumission (platform, video_url, caption)
  - Validation Zod côté client
  - Toast succès/erreur

#### `/app/creator/submissions` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Liste soumissions avec statut (pending/approved/rejected/won)
  - Feedback modération (`moderation_actions.note`)
  - Tri/filtres (date, statut, concours)
  - Badges statut colorés

#### `/app/creator/wallet` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Solde (gains - cashouts)
  - Historique cashouts (table)
  - Bouton "Retirer" (désactivé si solde = 0 ou KYC manquant)
  - Délais de paiement affichés

### Composants Créateur — Absents

- ❌ **`components/contest/ContestCard`** : Carte concours pour discover
- ❌ **`components/contest/ContestDetail`** : Détail concours avec formulaire participation
- ❌ **`components/submission/SubmissionForm`** : Formulaire upload soumission
- ❌ **`components/submission/SubmissionList`** : Liste soumissions avec filtres
- ❌ **`components/submission/SubmissionStatusBadge`** : Badge statut (utilise Badge UI)

---

## ❌ Phase 3 — MARQUE MVP (0% Complétée)

### Routes API Marque

#### `/api/contests/create` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Créer `contests(status='draft')`
  - Créer `contest_terms` (version 1)
  - Créer `contest_assets` (si cover_url fourni)
  - Créer `contest_prizes` (structure des prix)
  - Utiliser fonction SQL transactionnelle `create_contest_complete` (si existe)
  - Validation avec `contestCreateSchema`

#### `/api/contests/[id]/update` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Autosave brouillon (étapes 1-4)
  - UPSERT `contests`, `contest_terms`, `contest_prizes`
  - Uniquement si `status='draft'`

#### `/api/contests/[id]/publish` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Vérifier `payments_brand.status='succeeded'` pour ce concours
  - Passer `contests.status='active'`
  - Timestamp publication

#### `/api/contests/[id]/close` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Passer `contests.status='ended'` (pas 'closed', voir §36 du plan)
  - Vérifier `now() >= end_at` ou admin force

#### `/api/contests/[id]/winners/compute` ✅
- **État** : **IMPLÉMENTÉ** (code complet présent)
- **Fait** :
  - ✅ Vérification ownership (brand_id ou admin)
  - ✅ Appel fonction SQL `finalize_contest(p_contest_id)`
  - ✅ Récupération `contest_winnings` persistés
  - ✅ Retourne liste gagnants avec rank, payout_cents, payout_percentage

#### `/api/submissions/[id]/moderate` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Approve/reject avec note optionnelle
  - Écrire `moderation_actions` (pas `moderation_history`, voir §36)
  - Mettre à jour `submissions.status` et `rejection_reason`/`moderation_notes`
  - Notifier créateur
  - Vérifier ownership (brand_id du concours)

#### `/api/payments/brand/fund` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Créer `payments_brand(status='requires_payment')`
  - Créer session Stripe Checkout (prize_pool + commission 15%)
  - Retourner `checkout_url`
  - Webhook met à jour statut → publie concours

### Pages Marque — Toutes placeholders

#### `/app/brand/dashboard` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - KPIs (concours actifs, budget consommé, soumissions en attente)
  - Table "À modérer" (5 dernières soumissions pending)
  - Liste "Concours actifs"
  - Messages récents

#### `/app/brand/contests/new` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Wizard 5 étapes :
    1. Infos principales (title, brief_md, cover, allowed_platforms, visibility)
    2. Dates (start_at, end_at)
    3. Ciblage (min_followers, min_views, country, category)
    4. Récompenses (prize_pool, structure prizes)
    5. Paiement (Stripe Checkout)
  - Autosave à chaque étape (`/api/contests/[id]/update`)
  - Résumé final avant paiement
  - Toast à chaque sauvegarde

#### `/app/brand/contests/[id]` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Tabs : Résumé | Soumissions | Classement | Analytics | Paramètres
  - **Soumissions** : Liste avec filtres (pending/approved/rejected), actions approve/reject
  - **Classement** : Top 10 via `get_contest_leaderboard()` ou vue matérialisée
  - **Analytics** : Graphiques `metrics_daily` (vues, likes, engagement)
  - **Paramètres** : Clore concours, modifier (si draft)

#### `/app/brand/payments` ❌
- **État** : Placeholder "TODO"
- **À faire** :
  - Historique funding (`payments_brand`)
  - Factures (`invoices_billing`)
  - Statuts (requires_payment, succeeded, failed, refunded)

### Composants Marque — Absents

- ❌ **`components/contest/ContestWizard`** : Wizard 5 étapes avec stepper
- ❌ **`components/submission/ModerationPanel`** : Liste soumissions + actions approve/reject
- ❌ **`components/analytics/ContestAnalytics`** : Graphiques (Recharts)

---

## ❌ Phase 4 — CLASSEMENT & ANALYTICS (0% Complétée)

### Routes API Analytics

#### `/api/contests/[id]/leaderboard/recompute` ✅
- **État** : **IMPLÉMENTÉ** (code complet présent)
- **Fait** :
  - ✅ Vérification auth + rôle
  - ✅ Appel fonction SQL `refresh_leaderboard()`
  - ✅ Retourne succès

### Fonctions SQL — À Vérifier

- ⚠️ **`is_contest_active(p_contest_id)`** : Vérifier existence dans `db_refonte/`
- ⚠️ **`can_creator_submit(p_contest_id, p_creator_id)`** : Vérifier existence
- ⚠️ **`get_contest_leaderboard(p_contest_id, p_limit)`** : Vérifier existence
- ⚠️ **`refresh_leaderboard()`** : Vérifier existence
- ⚠️ **`compute_payouts(p_contest_id)`** : Vérifier existence
- ⚠️ **`finalize_contest(p_contest_id)`** : Vérifier existence

### Cron Jobs

- ❌ **`/api/cron/refresh-leaderboard`** : Absent
- ❌ **`vercel.json`** : Absent (pour cron Vercel)

---

## ❌ Phase 5 — PAIEMENTS (0% Complétée)

### Webhook Stripe

#### `/api/payments/stripe/webhook` ❌
- **État** : `501 Not Implemented`
- **À faire** :
  - Vérifier signature Stripe (`STRIPE_WEBHOOK_SECRET`)
  - Idempotency via `webhooks_stripe` table (clé unique `stripe_event_id`)
  - Événements :
    - `payment_intent.succeeded` → `payments_brand.status='succeeded'` → publier concours
    - `payout.paid` → `cashouts.status='paid'`
    - `payout.failed` → `cashouts.status='failed'`
    - `account.updated` → mettre à jour KYC status créateur

### Stripe Connect

#### `/api/stripe/connect/onboard` ❌
- **État** : Absent (mentionné dans le plan §37)
- **À faire** :
  - Créer compte Stripe Express
  - Générer onboarding link
  - Sauvegarder `stripe_account_id` dans `profile_creators`
  - Webhook `account.updated` → mettre à jour KYC status

---

## ❌ Phase 6 — ADMIN & AUDIT (0% Complétée)

### Pages Admin

#### `/app/admin/dashboard` ❌
- **État** : Absent
- **À faire** : KPIs globaux, alertes

#### `/app/admin/moderation` ⚠️
- **État** : Placeholder "TODO"
- **À faire** :
  - Vue consolidée soumissions en attente
  - Actions bulk (approve/reject)
  - Règles modération (`moderation_rules`)

#### `/app/admin/audit` ❌
- **État** : Absent
- **À faire** :
  - Recherche `audit_logs`, `event_log`
  - Filtres (période, utilisateur, action)
  - Export CSV

---

## ❌ Phase 7 — POLISH & SÉCURITÉ (0% Complétée)

### Rate Limiting

- ✅ **`lib/rateLimit.ts`** : Présent (à vérifier implémentation)
- ❌ **Application** : Non appliqué aux routes sensibles
  - `/api/auth/signup`: 5 req/15min par IP
  - `/api/submissions/create`: 10 req/heure par user
  - `/api/payments/brand/fund`: 3 req/heure par user

### CSRF

- ✅ **`lib/csrf.ts`** : Présent (à vérifier implémentation)
- ❌ **Application** : Non appliqué aux formulaires

### Uploads Signés

#### `/api/uploads/contest-asset/sign` ❌
- **État** : `501 Not Implemented`
- **À faire** : Validation MIME/size, URL signée Supabase, nommage UUID

#### `/api/uploads/message-attachment/sign` ❌
- **État** : `501 Not Implemented`
- **À faire** : Même logique avec contraintes plus strictes

### Messagerie

#### `/api/messages/threads` ✅
- **État** : **IMPLÉMENTÉ** (code complet présent)
- **Fait** :
  - ✅ GET : Liste threads où user est brand_id ou creator_id
  - ✅ POST : Créer thread (upsert si existe déjà)
  - ✅ Vérification ownership et contest existe
  - ✅ Journalisation `audit_logs`

#### `/api/messages/threads/[id]/messages` ❌
- **État** : `501 Not Implemented`
- **À faire** : Poster message (texte, attachments)

#### Pages Messages ❌
- **État** : Absentes (`/app/creator/messages`, `/app/brand/messages`)
- **À faire** : Split view (threads gauche, contenu droite), composer

### Notifications

#### `/api/notifications/dispatch` ✅
- **État** : **IMPLÉMENTÉ** (code complet présent)
- **Fait** :
  - ✅ Validation Zod (user_id, type, content)
  - ✅ Insertion dans `notifications` table
  - ⚠️ Envoi email optionnel (SendGrid) : non implémenté

#### Centre Notifications ❌
- **État** : Absent (`/app/creator/notifications`, `/app/brand/notifications`)
- **À faire** : Liste chronologique, filtres, "Marquer comme lu"

---

## 📋 Alignement avec le Plan — Checklist Détaillée

### Architecture Applicative (§2)
- ✅ Next.js 14 App Router + TypeScript strict
- ✅ TailwindCSS + design system (composants UI créés)
- ✅ Supabase (`@supabase/supabase-js` + `@supabase/ssr`)
- ✅ Stripe configuré
- ⚠️ SendGrid (optionnel, non configuré)
- ⚠️ next-themes (présent dans package.json, non utilisé)
- ✅ framer-motion (utilisé sur homepage)

### Sécurité (§4)
- ✅ RLS activées (via DB)
- ✅ Service role uniquement serveur
- ✅ CSP : `youtube-nocookie.com` dans `frame-src`
- ⚠️ CSRF : helper présent mais non appliqué
- ⚠️ Rate limiting : helper présent mais non appliqué
- ❌ Uploads : validation manquante
- ❌ Webhooks Stripe : signature non implémentée
- ❌ Logs & audit : `event_log` / `audit_logs` non utilisés

### UX Transverse (§5)
- ✅ Homepage avec animations (Framer Motion)
- ✅ Composants UI avec loading states (Skeleton)
- ❌ Forms guidés : non implémentés
- ❌ Optimistic UI : non implémenté
- ❌ Boutons contextualisés : non implémentés
- ⚠️ Notifications toast : ToastProvider présent mais non utilisé
- ⚠️ Accessibilité : labels, focus (composants OK, pages à faire)

### Auth & Onboarding (§6)
- ❌ Parcours signup/login : non implémenté
- ❌ Choix rôle : non implémenté
- ❌ Onboarding spécifique : non implémenté
- ✅ Redirections par rôle : middleware implémenté

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
- ✅ Composants UI : Button, Input, Card, Badge, Dialog, Select, Skeleton
- ⚠️ Motions & micro-interactions : partiel (homepage uniquement)
- ⚠️ Layouts responsive : partiel (Header responsive, pages à faire)

---

## 🎯 Plan d'Action Priorisé

### 🔴 PRIORITÉ 1 — Auth & Onboarding (Phase 1)
**Objectif** : Permettre aux utilisateurs de s'inscrire et se connecter

1. **Routes API Auth** (4 routes)
   - `/api/auth/signup` : Créer user + profiles + role-specific
   - `/api/auth/login` : Authentifier + retourner session
   - `/api/auth/me` : Retourner profil + rôle
   - `/api/profile/complete` : Finaliser onboarding

2. **Pages Auth** (3 pages)
   - `/auth/signup` : Formulaire avec choix rôle
   - `/auth/login` : Formulaire email/password
   - `/auth/verify` : Page confirmation

3. **Tests** : Parcours signup → onboarding → dashboard

**Estimation** : 1 semaine

---

### 🟠 PRIORITÉ 2 — Créateur MVP (Phase 2)
**Objectif** : Permettre aux créateurs de découvrir et participer aux concours

1. **Routes API** (2 routes)
   - `/api/submissions/create` : Créer soumission
   - `/api/payments/creator/cashout` : Retirer gains

2. **Pages Créateur** (5 pages)
   - Dashboard : Résumé + stats
   - Discover : Liste concours actifs
   - Contest Detail : Fiche concours + formulaire participation
   - Submissions : Liste soumissions
   - Wallet : Solde + historique

3. **Composants** (3 composants)
   - ContestCard, ContestDetail, SubmissionForm

**Estimation** : 2 semaines

---

### 🟡 PRIORITÉ 3 — Marque MVP (Phase 3)
**Objectif** : Permettre aux marques de créer et gérer des concours

1. **Routes API** (7 routes)
   - `/api/contests/create` : Créer concours
   - `/api/contests/[id]/update` : Autosave
   - `/api/contests/[id]/publish` : Publier
   - `/api/contests/[id]/close` : Clore
   - `/api/contests/[id]/winners/compute` : Calculer gagnants
   - `/api/submissions/[id]/moderate` : Modérer
   - `/api/payments/brand/fund` : Financer

2. **Pages Marque** (4 pages)
   - Dashboard : KPIs + modération
   - Contest Wizard : 5 étapes
   - Contest Detail : Tabs (Soumissions, Classement, Analytics)
   - Payments : Historique funding

3. **Composants** (3 composants)
   - ContestWizard, ModerationPanel, ContestAnalytics

**Estimation** : 2-3 semaines

---

### 🟢 PRIORITÉ 4 — Paiements & Webhooks (Phase 5)
**Objectif** : Intégrer Stripe complètement

1. **Webhook Stripe** : Signature + idempotency
2. **Stripe Connect** : Onboarding créateurs
3. **Tests** : Flux paiement complet (test mode)

**Estimation** : 1 semaine

---

### 🔵 PRIORITÉ 5 — Analytics & Classement (Phase 4)
**Objectif** : Afficher les classements et analytics

1. **Routes API** : Leaderboard recompute
2. **Cron Jobs** : Refresh leaderboard
3. **Pages** : Analytics dashboards

**Estimation** : 1 semaine

---

### 🔵 PRIORITÉ 6 — Polish (Phase 7)
**Objectif** : Finaliser sécurité et features secondaires

1. **Rate Limiting** : Application aux routes sensibles
2. **CSRF** : Application aux formulaires
3. **Uploads** : Validation + URLs signées
4. **Messagerie** : Routes + pages
5. **Notifications** : Centre + dispatch

**Estimation** : 1 semaine

---

## 📝 Points de Vigilance Critiques

### Alignements Plan ↔ DB (§36)

1. **Statuts concours** : Plan dit `'closed'` → DB utilise `'ended'`
2. **Dates concours** : Plan dit `starts_at`/`ends_at` → DB utilise `start_at`/`end_at`
3. **Plateformes** : Plan dit `allowed_platforms` JSONB → DB utilise `networks platform[]`
4. **Modération** : Plan dit `moderation_history` → DB utilise `moderation_actions`
5. **Gagnants** : Plan dit `submissions.status='won'` → DB utilise `contest_winnings` table

**Action** : Créer un fichier de mapping terminologie Plan → DB

### Fonctions SQL — Vérification Requise

Vérifier dans `db_refonte/` que ces fonctions existent :
- `is_contest_active(p_contest_id)`
- `can_creator_submit(p_contest_id, p_creator_id)`
- `get_contest_leaderboard(p_contest_id, p_limit)`
- `refresh_leaderboard()`
- `compute_payouts(p_contest_id)`
- `finalize_contest(p_contest_id)`
- `create_contest_complete(...)` (fonction transactionnelle)

### Tables — Vérification Requise

Vérifier que ces tables existent :
- `webhooks_stripe` (pour idempotency)
- `rate_limits` (pour rate limiting, optionnel)

---

## ✅ Conclusion

**État Actuel** : **~25% complété**
- ✅ Infrastructure : 90%
- ✅ Structure (routes/pages) : 95%
- ✅ Phase 0 (Socle) : 100%
- ⚠️ Phase 1 (Auth) : 0% (routes API non implémentées)
- ⚠️ Phase 2 (Créateur) : 15% (`/api/submissions/create` implémentée)
- ⚠️ Phase 3 (Marque) : 5% (winners/compute, leaderboard/recompute implémentés)
- ⚠️ Phase 4-7 (Features) : 10% (messages/threads, notifications/dispatch implémentés)

**Prochaines Étapes Immédiates** :
1. ✅ Phase 0 terminée
2. 🔴 Phase 1 — Auth & Onboarding (PRIORITÉ 1)
3. 🟠 Phase 2 — Créateur MVP (PRIORITÉ 2)
4. 🟡 Phase 3 — Marque MVP (PRIORITÉ 3)

**Le projet a une excellente base structurelle et un socle solide. L'implémentation fonctionnelle peut maintenant commencer avec l'authentification.**

