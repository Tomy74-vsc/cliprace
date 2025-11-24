# ClipRace â€” Plan de Reconstruction Complet (MVP â†’ V1)

Contexte: Tu as conservÃ© la homepage et la refonte complÃ¨te de la base Supabase. On reconstruit toutes les fonctionnalitÃ©s produit autour de cette base, avec un plan actionnable pour une IA ou un dev, clair, sÃ©curisÃ© et centrÃ© UX.

Sources dâ€™entrÃ©e utilisÃ©es: refonte DB (`db_refonte/**.sql`), audits/roadmaps du repo, Ã©tat Next.js actuel (App Router + Tailwind), contraintes manifestes (pas de Supabase CLI, secrets en `.env.local`).

---

## 0) Objectifs & Principes

- BÃ¢tir un MVP solide et extensible: Auth + 3 espaces (CrÃ©ateur / Marque / Admin) + concours UGC complet + paiements.
- UX simple, professionnelle, accessible (A11y), performante; parcours clairs, peu dâ€™Ã©tapes, feedback constant.
- SÃ©curitÃ© pragmatique: RLS cÃ´tÃ© DB, service role uniquement cÃ´tÃ© serveur, CSP stricte mais compatible YouTube nocookie, vÃ©rifs Stripe, journaux dâ€™audit.
- App Next.js modulaire, composants rÃ©utilisables, navigation rapide (loading states/skeletons, optimistic UI).

---

## 1) HypothÃ¨ses & Contraintes

- La base Supabase refondue est dÃ©jÃ  appliquÃ©e (via SQL Editor/psql). Pas dâ€™usage de Supabase CLI pour les migrations.
- Lâ€™app tourne sous Next.js 14 (App Router), Tailwind; `.editorconfig` (UTF-8) et `.eslintrc.json` ajoutÃ©s; scripts NPM nettoyÃ©s.
- Secrets et clÃ©s externes disponibles via `.env.local` (NON commitÃ©s): Supabase (anon/service), Stripe (keys + webhook), YouTube/TikTok/Instagram (optionnel), `APP_URL`.
- Les webhooks (Stripeâ€¦) seront gÃ©rÃ©s par des routes Next API; service_role nâ€™est JAMAIS exposÃ© au client.

---

## 2) Architecture Applicative

Technos principales
- Next.js 14 App Router, React 18, TypeScript strict.
- `@supabase/supabase-js` + `@supabase/ssr` (client/serveur) + RLS.
- TailwindCSS + design system simple, composantisÃ©.
- Stripe (paiements+connect), SendGrid (emails transactionnels, optionnel), next-themes (thÃ¨me), framer-motion (micro-animations lÃ©gÃ¨res).

Arborescence proposÃ©e
```
src/
  app/
    (marketing)/page.tsx            # homepage existante
    (auth)/
      login/page.tsx
      signup/page.tsx
      verify/page.tsx                # aprÃ¨s magic link / email vÃ©rifiÃ©
      reset-password/page.tsx        # optionnel si password
    (app)/
      layout.tsx
      creator/
        dashboard/page.tsx
        discover/page.tsx
        contests/[id]/page.tsx       # fiche concours (participation)
        submissions/page.tsx         # mes soumissions
        wallet/page.tsx              # gains / cashout
        messages/page.tsx
        settings/page.tsx
      brand/
        dashboard/page.tsx
        contests/new/page.tsx
        contests/[id]/page.tsx       # gestion concours (soumissions/modÃ©ration)
        payments/page.tsx            # funding + factures
        messages/page.tsx
        settings/page.tsx
      admin/
        dashboard/page.tsx
        moderation/page.tsx
        audit/page.tsx
    api/
      auth/
        signup/route.ts
        login/route.ts
        me/route.ts
      profile/complete/route.ts
      contests/
        create/route.ts
        [id]/publish/route.ts
        [id]/close/route.ts
        [id]/winners/compute/route.ts
      submissions/
        create/route.ts
        [id]/moderate/route.ts
      payments/
        stripe/webhook/route.ts
        brand/fund/route.ts
        creator/cashout/route.ts
      messages/
        threads/route.ts
        threads/[id]/messages/route.ts
      notifications/dispatch/route.ts
  components/
    ui/ ...                          # boutons, inputs, modals, toasts, tables
    auth/ ...                        # formulaires auth
    contest/ ...                     # cartes concours, liste, dÃ©tails
    submission/ ...                  # formulaire upload, listes, status badges
    payments/ ...                    # forms/funding/cashout, badges paiements
    messaging/ ...                   # threads, composer, message-item
  lib/
    env.ts                           # validation de process.env
    supabase/
      client.ts                      # client (anon)
      server.ts                      # admin (service role) â€“ server-only
    auth.ts                          # helpers (getSession, requireRole, etc.)
    csp.ts                           # helpers CSP (nonce) â€“ optionnel
    validators/ ...                  # zod schemas
    stripe.ts                        # client stripe server-only
    email.ts                         # sendgrid â€“ optionnel
  styles/
    globals.css
  types/
    db.ts                            # types supabase (si fournis manuellement)
```

Providers
- ToastProvider (existe), ThemeProvider (optionnel), SupabaseProvider (client), AuthGuard (server components) pour routes protÃ©gÃ©es.

Access Control (haut niveau)
- Middleware role-based (ou guard par page): si non connectÃ© â†’ (auth); si crÃ©ateur â†’ (app)/creator/*; si marque â†’ (app)/brand/*; si admin â†’ (app)/admin/*.

---

## 3) DonnÃ©es (mapping â†’ fonctionnalitÃ©s)

- profiles, profile_creators, profile_brands: identitÃ©, rÃ´le, prÃ©fÃ©rences, liens sociaux.
- contests, contest_terms, contest_assets: dÃ©finition concours, CGU/versioning, assets visuels.
- submissions, submission_comments: participations, commentaires.
- metrics_daily, analytics (materialized): stats agrÃ©gÃ©es (vues/engagements), leaderboard.
- payments_brand, invoices_billing: funding marque, facturation.
- cashouts: retraits cÃ´tÃ© crÃ©ateur (Stripe Connect Payouts).
- moderation_queue, moderation_rules, moderation_history: contenu Ã  modÃ©rer, dÃ©cisions et traÃ§abilitÃ©.
- messages_threads, messages, messages_attachments: messagerie interne.
- notifications, notification_templates, notification_center: systÃ¨me de notifications multi-supports.
- follows_favorites, tags_categories: dÃ©couverte et ciblage.
- event_log: journal dâ€™Ã©vÃ©nements applicatifs (audit + analytics produit).
- storage (policies): assets concours, soumissions, avatars.

RÃ¨gle dâ€™or: Toute Ã©criture sensible respecte RLS. Les opÃ©rations Â« systÃ¨me Â» (ex: compute payouts, assignation gagnants, envoi webhooks) passent par une route serveur utilisant le service role.

---

## 4) SÃ©curitÃ© (simple et efficace)

- RLS: activÃ©es partout; requÃªtes client = anon uniquement; routes Next API serveur = service_role (server-only) pour actions privilÃ©giÃ©es.
- Secrets: `.env.local` ignorÃ© par git; vÃ©rifier `.gitignore` pour `.env*`.
- CSP: 
  - Autoriser `youtube-nocookie.com` dans `frame-src` si embed.
  - `connect-src`: `https://*.supabase.co` `wss://*.supabase.co` + Stripe.
  - `img-src`: `self` `https:` `data:` `blob:`.
  - Option nonce si inline script (sinon, Ã©viter l'inline).
- CSRF: 
  - Routes mutatives â†’ anti-CSRF (double submit cookie + header) pour formulaires.
  - Les requÃªtes authentifiÃ©es cÃ´tÃ© Supabase (JWT) sont dÃ©jÃ  limitÃ©es par RLS.
- Rate limiting: 
  - Par IP + user_id pour endpoints sensibles (signup, submissions, funding) via simple store (ex: Supabase table `rate_limit` ou middleware mÃ©moire + ban Ã©phÃ©mÃ¨re).
  - Limites recommandÃ©es:
    - `/api/auth/signup`: 5 req/15min par IP
    - `/api/submissions/create`: 10 req/heure par user
    - `/api/payments/brand/fund`: 3 req/heure par user
    - `/api/auth/login`: 10 req/15min par IP
  - ImplÃ©mentation: middleware rÃ©utilisable `withRateLimit()` ou table Supabase `rate_limit` avec TTL.
- Uploads: 
  - VÃ©rifier type/mime cÃ´tÃ© client et serveur; bloquer SVG non maÃ®trisÃ©s; taille max; nommage UUID; scan antivirus optionnel (file scanning as a service) si critique.
  - Validation serveur stricte: whitelist MIME types, vÃ©rification signature fichier, quota par user.
- Webhooks Stripe: signature requise; idempotency key pour opÃ©rations de paiement.
- Logs & audit: Ã©crire dans `event_log` + `audit_logs` pour actions critiques.
- Gestion des secrets: rotation pÃ©riodique, validation au dÃ©marrage via `lib/env.ts`, jamais de secrets dans le code source.

---

## 5) UX Transverse

- Forms guidÃ©s, Ã©tapes courtes, validation immÃ©diate (zod) + messages dâ€™erreurs clairs.
- Skeletons/spinners pour chargements; optimistic UI pour petites MAJ.
- Boutons toujours contextualisÃ©s (dÃ©sactivÃ©s/inactifs si non Ã©ligible) avec tooltip.
- Notifications: toast sur succÃ¨s/erreur + centre de notifications page dÃ©diÃ©e.
- AccessibilitÃ©: labels, focus visible, contraste, support reduced motion.
- Contenu embarquÃ© (vidÃ©os): `youtube-nocookie` + poster thumbnail; fallback textuel.

---

## 6) Auth & Onboarding

Parcours
1) Signup: email + mot de passe (ou magic link). Option OAuth: Google, TikTok, Instagram (selon clÃ©s dispo).
2) VÃ©rification email (si activÃ©e). 
3) Choix du rÃ´le: CrÃ©ateur ou Marque.
4) Onboarding spÃ©cifique: 
   - CrÃ©ateur: pseudo, bio courte, plateformes (YouTube/TikTok/Instagram) via `platform_links`, prÃ©fÃ©rences notifs.
     - Structure transmise : `platform_links = { tiktok: '@handle', instagram: 'https://instagram.com/...', youtube: 'https://youtube.com/@...', x: '@handle' }`
     - L’API `/api/profile/complete` synchronise ces valeurs avec `platform_accounts` (1 entrée par plateforme, suppression si champ vidé).
     - Test manuel recommandé : compléter l’onboarding créateur, renseigner/modifier les liens puis vérifier `platform_accounts` (Supabase) pour confirmer l’upsert/suppression.
   - Marque: nom entreprise, TVA/SIREN, adresse, dÃ©marrer onboarding Stripe Connect (compte de destination pour gains), prÃ©fÃ©rences notifs.
5) Redirection vers dashboard selon rÃ´le.

Back-end
- `/api/auth/signup` crÃ©e lâ€™utilisateur Supabase + row `profiles` (service role) + `profile_creators`/`profile_brands` selon rÃ´le.
- `/api/auth/login` authentifie et renvoie profil (+ rÃ´le) pour routing cÃ´tÃ© app.
- `/api/profile/complete` finalise onboarding (Ã©critures service role si besoin, ex. validations KYC states cÃ´tÃ© marque).

AccÃ¨s
- Garde cÃ´tÃ© serveur: 
  - non connectÃ© â†’ (auth)
  - crÃ©ateur â†’ (app)/creator/*
  - marque â†’ (app)/brand/*
  - admin â†’ (app)/admin/*

---

## 7) Interface CrÃ©ateur

Pages & actions
- Dashboard: rÃ©sumÃ© (concours actifs, mes stats, notifications non lues).
- Discover: liste concours publics actifs (filtres par tags/categories), CTA Â« Participer Â».
- Contest details: `contests/[id]` â†’ affichage rÃ¨gles, rÃ©compenses, dates; bouton Â« Participer Â» si Ã©ligible â†’ formulaire `submissions.create` (upload vidÃ©o/URL, description, tags). Enregistrement de `contest_terms_acceptances` si premiÃ¨re participation.
- Mes soumissions: liste, statut (pending/approved/rejected/won), feedback modÃ©ration.
- Wallet: gains, statut cashouts; bouton Â« Retirer Â» â†’ initier payout (Stripe Connect), afficher dÃ©lais.
- Messages: threads avec marques, composer, piÃ¨ces jointes (limitÃ©es).
- Settings: profil, liens plateformes, notifications, suppression compte.

DB mapping
- `submissions` insert via route API â†’ storage upload (bucket `submissions/â€¦`) + row DB.
- `metrics_daily` alimente stats (lecture seule cÃ´tÃ© client); leaderboard via vues materialized.
- `cashouts` crÃ©ation via route serveur (service role), webhooks Stripe pour statut.

---

## 8) Interface Marque

Pages & actions
- Dashboard: Ã©tat de mes concours (actifs/Ã  venir/terminÃ©s), budget consommÃ©, messages rÃ©cents.
- Nouveau concours: wizard 5 Ã©tapes (infos gÃ©nÃ©rales, dates, ciblage/tags, rÃ©compenses, visuels) â†’ crÃ©e `contests`, `contest_terms`, `contest_assets`, `contest_prizes`.
- DÃ©tail concours `[id]`: onglets RÃ©sumÃ© | Soumissions (modÃ©ration: approve/reject, commentaires) | Classement | Analytics | ParamÃ¨tres.
- Paiements: funding (Stripe PaymentIntent/Checkout) â†’ `payments_brand`, factures (`invoices_billing`).
- Messages: threads avec crÃ©ateurs, annonces.
- Settings: profil entreprise, prÃ©fÃ©rences, KYC Ã©tat.

DB mapping
- CrÃ©ation concours = Ã©critures multiples atomiques (transaction cÃ´tÃ© serveur, ou sÃ©quence robuste + rollback logique).
- ModÃ©ration = `moderation_queue` + `moderation_history` + statut dans `submissions`.
- Funding = `payments_brand` + `invoices_billing`; webhooks pour mise Ã  jour statut.

### Gestion des Transactions DB

**StratÃ©gie: Fonction SQL Transactionnelle**

```typescript
// lib/supabase/transactions.ts
import { getAdminClient } from './server';
import type { ContestCreateInput } from '@/types/contests';

export async function createContestWithDependencies(
  contestData: ContestCreateInput,
  brandId: string
) {
  const adminClient = getAdminClient();
  
  // Utiliser une fonction SQL transactionnelle (recommandÃ©)
  const { data, error } = await adminClient.rpc('create_contest_complete', {
    p_brand_id: brandId,
    p_title: contestData.title,
    p_brief_md: contestData.brief_md,
    p_starts_at: contestData.starts_at,
    p_ends_at: contestData.ends_at,
    p_prize_pool_cents: contestData.total_prize_pool_cents,
    p_allowed_platforms: contestData.allowed_platforms,
    // ... autres champs
  });
  
  if (error) {
    throw new AppError('CONTEST_CREATE_FAILED', error.message, 500);
  }
  
  return data;
}
```

**Fonction SQL Transactionnelle** (Ã  crÃ©er dans DB)

```sql
CREATE OR REPLACE FUNCTION create_contest_complete(
  p_brand_id uuid,
  p_title text,
  p_brief_md text,
  -- ... autres paramÃ¨tres
) RETURNS uuid AS $$
DECLARE
  v_contest_id uuid;
BEGIN
  -- Insert contest
  INSERT INTO contests (brand_id, title, brief_md, status, ...)
  VALUES (p_brand_id, p_title, p_brief_md, 'draft', ...)
  RETURNING id INTO v_contest_id;
  
  -- Insert contest_terms
  INSERT INTO contest_terms (contest_id, version, content_md)
  VALUES (v_contest_id, 1, p_terms_content);
  
  -- Insert contest_prizes (si fournis)
  -- ...
  
  RETURN v_contest_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create contest: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 9) Interface Admin

Pages & actions
- Dashboard global: KPIs principaux, alertes.
- ModÃ©ration: vue consolidÃ©e des contenus en attente, actions bulk, rÃ¨gles (`moderation_rules`).
- Audit: recherche `audit_logs`, Ã©vÃ©nements `event_log`, exports.
- ParamÃ¨tres: templates notifications, tags/categories, bannissements.

AccÃ¨s
- Routes serveur avec vÃ©rification rÃ´le admin (RLS + guards). Certaines actions passent par fonctions SQL si existantes.

---

## 10) Concours â€” DÃ©tails Techniques

Cycle de vie
1) CrÃ©ation (draft) â†’ publication (published) â†’ clÃ´ture (closed) â†’ attribution des gagnants â†’ versements.
2) Terms & consentements: versionnage `contest_terms`; accepter avant 1Ã¨re participation.
3) Participation: insertion `submissions` + upload storage; validation rÃ¨gles (formats/tailles, unicitÃ© par concours/utilisateur si applicable).
4) ModÃ©ration: file dâ€™attente â†’ approve/reject; feedback au crÃ©ateur; statut visible.
5) Classement: lecture vues/engagements `metrics_daily` + calcul score pondÃ©rÃ© (`weighted_views_calculation.sql`), vues matÃ©rialisÃ©es (rafraÃ®chies pÃ©riodiquement).
6) Attribution: route serveur Â« compute winners Â» â†’ Ã©crit dans table des gains persistÃ©s; notifie gagnants.
7) Versements: funding marque existant â†’ triggers pour prÃ©parer paiements aux gagnants; cashouts cÃ´tÃ© crÃ©ateur.

Automations (cron / tÃ¢ches planifiÃ©es)
- RafraÃ®chir vues matÃ©rialisÃ©es analytics.
- Recalculer leaderboard si nÃ©cessaire.
- VÃ©rifier webhooks en attente / rÃ©essais.
- Entretien `event_log` (rotation), notifications programmÃ©es.

### ImplÃ©mentation Cron Jobs

**Option 1: Vercel Cron Jobs** (recommandÃ© si hÃ©bergÃ© sur Vercel)

```typescript
// app/api/cron/refresh-leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = getAdminClient();
  const { error } = await adminClient.rpc('refresh_analytics_views');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
```

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/refresh-leaderboard",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/close-ended-contests",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Option 2: Supabase Edge Functions + pg_cron**
- CrÃ©er Edge Function qui appelle fonctions SQL
- Programmer via `pg_cron` dans Supabase

**Option 3: Service Externe**
- Inngest, Trigger.dev, ou autre service de cron managÃ©

---

## 10bis) Concours â€” SpÃ©cification CrÃ©ateur (parcours complet)

DÃ©couverte et Ã©ligibilitÃ©
- Page `/app/creator/discover`: liste des concours oÃ¹ `contests.status = 'active'` et dans la fenÃªtre `[starts_at, ends_at]`.
- DÃ©tail `/app/creator/contests/[id]`: affiche `brief_md`, rÃ¨gles, plateformes autorisÃ©es (TikTok, Instagram Reels, YouTube Shorts) via un champ JSONB (ex: `allowed_platforms = { tiktok: true, instagram: true, youtube: true }`).
- Avant dâ€™afficher le CTA Â« Participer Â», appeler la fonction SQL `can_submit_to_contest(p_contest_id, auth.uid())` afin de vÃ©rifier:
  - concours actif (status='active' et date courante entre `starts_at` et `ends_at`),
  - pas dÃ©jÃ  participÃ© (contrainte unique (creator_id, contest_id)),
  - critÃ¨res dâ€™Ã©ligibilitÃ© (followers, pays, rÃ©seau) satisfaits.

Soumission
- Formulaire minimal: `platform` (enum 'tiktok' | 'instagram' | 'youtube'), `video_url` (URL publique valide), `caption` (facultatif).
- Backend `/api/submissions/create`:
  - Valide `contest_id` et rÃ©sultat `can_submit_to_contest`.
  - Valide lâ€™URL selon la `platform` (patterns officiels: TikTok share URL, Instagram Reels, YouTube Shorts nocookie acceptÃ© si pertinent).
  - InsÃ¨re dans `submissions` avec `status = 'pending'`, `creator_id = auth.uid()`.
  - Ecrit un log dans `audit_logs` (type=`submission_create`).
  - DÃ©clenche une notification pour la marque (ligne dans `notifications`).

ModÃ©ration et mÃ©triques
- La marque approuve/rejette via `/api/submissions/[id]/moderate` (status: 'approved'|'rejected', optional feedback), et Ã©crit dans `moderation_history`.
- Un cron/edge function met Ã  jour `metrics_daily` (vues, likes, engagement) reliÃ© Ã  `submissions`. Seule une fonction interne (service role) peut insÃ©rer/mettre Ã  jour ces mÃ©triques (RLS).
- Le leaderboard est alimentÃ© par la vue matÃ©rialisÃ©e et/ou la fonction `update_contest_leaderboard`.

DÃ©partage final et gains
- Ã€ `ends_at` dÃ©passÃ©, le concours passe en 'closed'.
- Top 30 (`LIMIT 30`) gagnants selon le score pondÃ©rÃ©; les gains sont calculÃ©s dâ€™aprÃ¨s `contest_prizes` et persistÃ©s.
- Le crÃ©ateur voit ses gains dans `/app/creator/wallet` et peut demander un retrait (insert `cashouts`). Le webhook Stripe met Ã  jour le statut payout.

SÃ©curitÃ©/Contraintes
- Une seule soumission par `(creator_id, contest_id)` (unique index + check dans `can_submit_to_contest`).
- URLs strictement validÃ©es par plateforme (regex + HEAD/GET check optionnelle).
- RLS active; `metrics_daily` modifiable uniquement via fonction interne (service role) ou tÃ¢ches planifiÃ©es.

UX
- CTA Â« Participer Â» dÃ©sactivÃ© si inÃ©ligible (tooltip avec raison).
- Formulaire simple, retour dâ€™erreur clair, toasts succÃ¨s/erreur, spinner lors de la soumission.
- Page Â« Mes soumissions Â»: badges de statut, tri par date/status.

---

## 11) Paiements (Stripe)

Marque (entrÃ©es)
- Funding dâ€™un concours: Checkout/PaymentIntent â†’ `payments_brand` + facture (`invoices_billing`).
- Webhooks: `payment_intent.succeeded`, `charge.succeeded` â†’ marquer paiement confirmÃ©.

CrÃ©ateur (sorties)
- Compte Stripe Connect requis (onboarding guidÃ© cÃ´tÃ© Settings Marque/CrÃ©ateur selon modÃ¨le choisi). Pour MVP: payouts aux crÃ©ateurs via Connect Standard/Express.
- Cashout: crÃ©ation `cashouts` â†’ initier payout via API Stripe; maj statut via webhooks (`payout.paid`/`failed`).

SÃ©curitÃ© & conformitÃ©
- Signature webhook; idempotency; pas de clÃ© secrÃ¨te Stripe cÃ´tÃ© client; gestion des devises/taxes conforme.

---

## 11bis) Concours â€” SpÃ©cification Marque (crÃ©ation â†’ gestion)

Wizard `/app/brand/contests/new` (5 Ã©tapes)
1) Infos principales: `title`, `brief_md`, `cover_image`, `allowed_platforms` (JSONB), `visibility` (public/unlisted).
2) Dates: `starts_at`, `ends_at` (validation: `ends_at > starts_at`).
3) Ciblage: `min_followers`, `min_views`, `country` (ISO), `category` (tag). Ces critÃ¨res sont pris en compte par `can_submit_to_contest`.
4) RÃ©compenses: `total_prize_pool_cents` + structure des prix â†’ inserts `contest_prizes` (top N, montants, rÃ©partition).
5) Paiement: ouverture Stripe Checkout avec `total_prize_pool_cents` + commission 15%. AprÃ¨s succÃ¨s webhook: `payments_brand.status='paid'` et `contests.status='active'`.

Gestion concours `/app/brand/contests/[id]`
- Liste des `submissions` (filtres: pending/approved/rejected), actions approve/reject avec note.
- Classement: lecture leaderboard calculÃ© (fonction `update_contest_leaderboard`, vues matÃ©rialisÃ©es).
- Analytics: graphiques Ã  partir de `metrics_daily`.
- ParamÃ¨tres: possibilitÃ© de clore le concours (`status='closed'`) manuellement Ã  la fin.
- Rapport final: rÃ©capitulatif des soumissions, gagnants, budget, efficacitÃ© (export PDF/CSV optionnel).

SÃ©curitÃ©
- Seul `brand_id = auth.uid()` gÃ¨re le concours (RLS et vÃ©rifications API).
- Ecritures protÃ©gÃ©es par RLS; paiements validÃ©s par webhook Stripe avant activation.

UX
- Statuts clairs: 'draft' â†’ 'active' â†’ 'closed' â†’ 'archived'.
- Autoâ€‘save Ã  chaque Ã©tape du wizard; toasts Ã  chaque sauvegarde; blocage des actions non disponibles.

---

## 18) Contrats API â€” Endpoints principaux

Auth
- POST `/api/auth/signup`: body { email, password?, role, profileFields }. Effets: crÃ©e user + profiles + (profile_creators|profile_brands). Renvoyer session + profil.
- POST `/api/auth/login`: body { email, password? } (ou magic link). Effets: session + profil + rÃ´le.
- GET `/api/auth/me`: session â†’ profil + rÃ´le.
- POST `/api/profile/complete`: finalise onboarding (Ã©critures profil spÃ©cifiques).

Concours (marque)
- POST `/api/contests/create`: crÃ©e `contests`, `contest_terms`, `contest_assets`, `contest_prizes`. SÃ©curisÃ© (role=brand).
- POST `/api/contests/[id]/publish`: passe en 'active' si paiement confirmÃ©.
- POST `/api/contests/[id]/close`: passe en 'closed' si `ends_at` atteint.
- POST `/api/contests/[id]/winners/compute`: calcule gagnants, persiste gains.

Soumissions (crÃ©ateur/marque)
- POST `/api/submissions/create`: body { contest_id, platform, video_url, caption? } â†’ insert `submissions(status='pending')` si `can_submit_to_contest`.
- PATCH `/api/submissions/[id]/moderate`: body { status:'approved'|'rejected', note? } (role=brand & owner du contest) â†’ update + `moderation_history`.

Paiements
- POST `/api/payments/brand/fund`: body { contest_id } â†’ crÃ©e PaymentIntent/Checkout et URL redirection.
- POST `/api/payments/creator/cashout`: body { amount_cents } â†’ insert `cashouts` + init payout.
- POST `/api/payments/stripe/webhook`: traite Ã©vÃ©nements Stripe (secure/signature + idempotency).

Messaging
- POST `/api/messages/threads`: crÃ©er thread marqueâ†”crÃ©ateur.
- GET `/api/messages/threads`: lister mes threads.
- POST `/api/messages/threads/[id]/messages`: poster message (texte, attachments limitÃ©s).

Notifications
- POST `/api/notifications/dispatch`: utilitaire serveur pour pousser une notif (template â†’ notification).

Notes
- Toutes les routes mutatives: vÃ©rifier session + rÃ´le + propriÃ©tÃ© des ressources + RLS cÃ´tÃ© DB (ou service role uniquement cÃ´tÃ© serveur).

---

## 19) Validation (Zod) â€” SchÃ©mas clÃ©s

Signup/Login
- Email (RFC), password (min 8), role âˆˆ {'creator','brand'}. Profils: champs strings bornÃ©s, URLs sociales validÃ©es.

ContestCreate
- title (1..120), brief_md (1..5000), cover (URL), allowed_platforms (shape bools), visibility âˆˆ {public, unlisted}.
- starts_at < ends_at, min_followers â‰¥ 0, min_views â‰¥ 0.
- prize structure: tableau d'objets { rank_from, rank_to?, amount_cents > 0 } cohÃ©rent avec `total_prize_pool_cents`.

SubmissionCreate
- contest_id (uuid), platform âˆˆ {'tiktok','instagram','youtube'}, video_url (regex plateforme + https), caption (0..2200).

ModerateSubmission
- status âˆˆ {'approved','rejected'}, note (0..500).

Cashout
- amount_cents > 0 et â‰¤ solde gagnant disponible.

### Validation URLs VidÃ©o par Plateforme

```typescript
// lib/validators/platforms.ts
export const PLATFORM_URL_PATTERNS = {
  tiktok: /^https:\/\/(www\.)?(tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com\/[\w-]+)/,
  instagram: /^https:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+\/?/,
  youtube: /^https:\/\/(www\.)?(youtube\.com\/shorts\/[\w-]+|youtu\.be\/[\w-]+)/,
} as const;

export function validateVideoUrl(url: string, platform: Platform): boolean {
  const pattern = PLATFORM_URL_PATTERNS[platform];
  if (!pattern) return false;
  return pattern.test(url);
}

// Zod schema avec validation
export const submissionCreateSchema = z.object({
  contest_id: z.string().uuid(),
  platform: z.enum(['tiktok', 'instagram', 'youtube']),
  video_url: z.string().url().refine(
    (url, ctx) => {
      const platform = ctx.parent.platform;
      return validateVideoUrl(url, platform);
    },
    { message: 'URL invalide pour cette plateforme' }
  ),
  caption: z.string().max(2200).optional(),
});
```

### Gestion des Erreurs StandardisÃ©e

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  STRIPE_ERROR: 'STRIPE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

// Helper pour formater les rÃ©ponses d'erreur
export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { code: error.code, message: error.message, details: error.details },
      { status: error.statusCode }
    );
  }
  return Response.json(
    { code: 'INTERNAL_ERROR', message: 'Une erreur est survenue' },
    { status: 500 }
  );
}
```

---

## 20) Ã‰tats & RÃ¨gles â€” Source of Truth

Enums/Statuts (cÃ´tÃ© DB)
- contests.status: 'draft' | 'active' | 'paused' | 'ended' | 'archived' (alignÃ© avec `db_refonte/00_extensions_enums.sql`).
- submissions.status: 'pending' | 'approved' | 'rejected' | 'won' | 'removed' (alignÃ© avec DB).
- payments_brand.status: 'created' | 'paid' | 'failed' | 'refunded'.
- cashouts.status: 'requested' | 'processing' | 'paid' | 'failed'.

RÃ¨gles critiques
- UnicitÃ© `(creator_id, contest_id)` (unique index) + `can_submit_to_contest`.
- `metrics_daily` writable via service role only (functions/cron).
- `payments_brand` set to 'paid' uniquement via webhook Stripe vÃ©rifiÃ©.
- Gagnants persistÃ©s au moment du close/winners compute; visibles en lecture seule aprÃ¨s.

### Fonction SQL `can_submit_to_contest`

```sql
-- Fonction Ã  crÃ©er dans la DB (ou vÃ©rifier si existe dÃ©jÃ )
CREATE OR REPLACE FUNCTION can_submit_to_contest(
  p_contest_id uuid,
  p_user_id uuid
) RETURNS boolean AS $$
DECLARE
  v_contest contests%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_creator profile_creators%ROWTYPE;
  v_already_submitted boolean;
BEGIN
  -- VÃ©rifier que le concours existe et est actif
  SELECT * INTO v_contest
  FROM contests
  WHERE id = p_contest_id
    AND status = 'active'
    AND now() BETWEEN starts_at AND ends_at;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- VÃ©rifier que l'utilisateur est un crÃ©ateur
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id AND role = 'creator';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- VÃ©rifier qu'il n'a pas dÃ©jÃ  participÃ©
  SELECT EXISTS(
    SELECT 1 FROM submissions
    WHERE contest_id = p_contest_id AND creator_id = p_user_id
  ) INTO v_already_submitted;
  
  IF v_already_submitted THEN
    RETURN false;
  END IF;
  
  -- VÃ©rifier critÃ¨res d'Ã©ligibilitÃ© (followers, pays, plateforme)
  SELECT * INTO v_creator FROM profile_creators WHERE user_id = p_user_id;
  
  IF v_contest.min_followers > 0 AND v_creator.followers < v_contest.min_followers THEN
    RETURN false;
  END IF;
  
  IF v_contest.country IS NOT NULL AND v_profile.country != v_contest.country THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 21) Storage â€” Buckets & Limites

- Buckets: `avatars/`, `contest_assets/`, `submissions/`.
- Nommage fichiers: `uuid` + extension; metadata (mime, size, user_id, contest_id).
- Tailles max (exemples): avatars 1MB, assets concours 10MB, piÃ¨ces jointes messages 5MB.
- Interdire SVG non sÃ»rs; thumbnails via proxy si nÃ©cessaire.
- Politiques Storage: lecture publique limitÃ©e (ex: assets concours), Ã©criture restreinte par user_id/owner.

### StratÃ©gie Upload ComplÃ¨te

**PrÃ©-upload: GÃ©nÃ©ration URL SignÃ©e**

```typescript
// app/api/uploads/[bucket]/sign/route.ts
export async function POST(
  request: Request,
  { params }: { params: { bucket: string } }
) {
  const { mime, size, filename } = await request.json();
  
  // Validation
  const allowedMimes = {
    avatars: ['image/jpeg', 'image/png', 'image/webp'],
    contest_assets: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    submissions: ['video/mp4', 'video/webm'],
  };
  
  if (!allowedMimes[params.bucket]?.includes(mime)) {
    return Response.json({ error: 'MIME type not allowed' }, { status: 400 });
  }
  
  const maxSizes = { avatars: 1_000_000, contest_assets: 10_000_000, submissions: 50_000_000 };
  if (size > maxSizes[params.bucket]) {
    return Response.json({ error: 'File too large' }, { status: 400 });
  }
  
  // GÃ©nÃ©rer nom UUID
  const ext = filename.split('.').pop();
  const uuid = crypto.randomUUID();
  const path = `${uuid}.${ext}`;
  
  // CrÃ©er URL signÃ©e Supabase
  const adminClient = getAdminClient();
  const { data, error } = await adminClient.storage
    .from(params.bucket)
    .createSignedUploadUrl(path, { upsert: false });
  
  if (error) throw new AppError('UPLOAD_SIGN_FAILED', error.message);
  
  return Response.json({ upload_url: data.signedUrl, path });
}
```

**Post-upload: Validation & MÃ©tadonnÃ©es**

```typescript
// Webhook Supabase Storage (optionnel) ou validation manuelle aprÃ¨s upload
export async function validateUpload(
  bucket: string,
  path: string,
  userId: string
) {
  // VÃ©rifier que le fichier existe
  // VÃ©rifier taille rÃ©elle
  // InsÃ©rer mÃ©tadonnÃ©es dans table `assets` si nÃ©cessaire
  // Notifier l'utilisateur du succÃ¨s
}
```

---

## 22) UX â€” DÃ©tails & Microcopie

- Wizard concours: autosave ("Brouillon enregistrÃ©"), validation par Ã©tape, rÃ©sumÃ© final avant paiement.
- Discover: cartes concises (logo marque, dates, tags, rÃ©compenses), filtres persistants, pagination/infinite scroll.
- DÃ©tail concours: CTA unique, rappel des rÃ¨gles, preview vidÃ©o lors de la saisie URL si possible.
- Soumission: 3 champs, messages dâ€™erreur explicites, lien vers CGU/terms versionnÃ©s.
- ModÃ©ration: liste compactÃ©e, clavier (J/K) pour naviguer, dÃ©cision rapide, badge colorÃ© par statut.
- Wallet: solde, historique, CTA Â« Retirer Â», temps estimÃ© de rÃ¨glement.
- Notifications: toasts + centre dÃ©diÃ©; possibilitÃ©s dâ€™optâ€‘in email.
- AccessibilitÃ©: focus ring, labels, aria-live pour toasts, contraste OK; respect `prefers-reduced-motion`.

---

## 23) Tests â€” Parcours ClÃ©s (manuels/automatisables)

Auth
- Signup â†’ verify â†’ onboarding â†’ redirection rÃ´le.

CrÃ©ateur
- DÃ©couvrir â†’ Ã©ligibilitÃ© OK (CTA actif) â†’ soumission â†’ statut pending â†’ notification marque.
- ModÃ©ration par marque â†’ statut approved/rejected â†’ feedback visible.
- Fin concours â†’ gains visibles â†’ cashout demandÃ© â†’ webhook paid.

Marque
- Wizard crÃ©ation complet â†’ paiement Stripe (test) â†’ concours actif.
- ModÃ©ration â†’ leaderboard visible â†’ close â†’ compute winners â†’ rapport final.

Paiements
- Webhook Stripe idempotent; erreurs gÃ©rÃ©es; statuts corrects en DB.

SÃ©curitÃ©
- RLS empÃªche lecture/Ã©criture crossâ€‘user; `metrics_daily` non Ã©ditable cÃ´tÃ© client; 1 soumission par (creator,contest).

### Tests AutomatisÃ©s

**Unit Tests** (Jest/Vitest)
- Validation Zod schemas
- Helpers auth (`requireRole`, `requireOwnership`)
- Validators plateformes (URLs vidÃ©o)
- Formatage erreurs

**Integration Tests** (API Routes)
- Routes API avec mocks Supabase/Stripe
- ScÃ©narios complets: crÃ©ation concours â†’ soumission â†’ modÃ©ration
- Webhooks Stripe (signature + idempotency)

**E2E Tests** (Playwright)
- Parcours complet crÃ©ateur: signup â†’ discover â†’ submission â†’ wallet
- Parcours complet marque: signup â†’ wizard â†’ funding â†’ moderation
- Tests sÃ©curitÃ©: accÃ¨s non autorisÃ©, RLS cross-user

**Fixtures & Mocks**
- DonnÃ©es de test rÃ©utilisables (`fixtures/`)
- Mocks Stripe (test mode)
- Seeds DB pour tests (`db_refonte/13_seed_minimal.sql`)

---

## 24) AmÃ©liorations & Manques comblÃ©s

- PrÃ©â€‘visualisation liens vidÃ©o et validation HEAD pour Ã©viter URL cassÃ©es.
- Compte Â« Ã©quipe marque Â»: plusieurs membres sur une organisation (table `orgs` si prÃ©sente), rÃ´les internes (owner, editor, viewer).
- Ã‰tiquetage automatique (tags) via NLP lÃ©ger (optionnel) pour meilleures dÃ©couvertes.
- Export rapport concours (PDF/CSV) et partage lien consultable.
- SEO basique sur pages marketing et pages concours publiques (si visibility=public).
- Centre dâ€™aide intÃ©grÃ© (FAQ) et onboarding contextuel (tooltips, coachmarks) pour les wizards.


## 12) Messagerie & Notifications

Messagerie
- CrÃ©ation de thread lors dâ€™une interaction (ex: soumission notable) ou via Â« Nouveau message Â» (marqueâ†’crÃ©ateur, ou inverse selon rÃ¨gles).
- Messages texte + attachments lÃ©gers (images/pdf) avec quotas.

Notifications
- `notification_templates`: gabarits (soumission acceptÃ©e, refusÃ©e, gagnant, funding reÃ§uâ€¦).
- `notifications`: envoi en base + option email via SendGrid; page Centre de notifications pour lecture/archivage.

---

## 13) ObservabilitÃ©

- `event_log`: journaliser Ã©vÃ©nements (auth, submissions, moderation, payments, cashouts, messages).
- `audit_logs`: actions sensibles (modÃ©ration, paiements) avec l'utilisateur, horodatage, dÃ©tails.
- Dash admin Â« Audit Â»: filtres par pÃ©riode, export CSV.

### Monitoring & Alertes

**Error Tracking** (Sentry ou LogRocket)
- Frontend: capture erreurs React, erreurs rÃ©seau
- Backend: capture erreurs API routes, exceptions non gÃ©rÃ©es
- Contexte enrichi: user_id, request_id, stack trace

**Logs StructurÃ©s**
```typescript
// lib/logger.ts
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  metadata?: Record<string, unknown>
) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    event,
    request_id: metadata?.request_id,
    user_id: metadata?.user_id,
    ...metadata,
  };
  
  // Envoyer Ã  service de logs (ex: Logtail, Datadog)
  console.log(JSON.stringify(log));
}
```

**Alertes Critiques**
- Webhook Stripe Ã©chouÃ© > 3 fois consÃ©cutives
- Cashout en Ã©chec > 1h sans rÃ©solution
- Concours sans soumission aprÃ¨s 24h (marque notifiÃ©e)
- Taux d'erreur API > 5% sur 5min
- Base de donnÃ©es lente (query > 2s)

**Health Checks**
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    stripe: await checkStripe(),
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  
  return Response.json(checks, {
    status: healthy ? 200 : 503,
  });
}
```

---

## 14) Plan dâ€™ImplÃ©mentation (phases & critÃ¨res)

Phase 0 â€” Socle
- Mettre Ã  jour `next.config` (CSP compatible YouTube nocookie; connect-src Supabase/Stripe). 
- `lib/env.ts` (validation), `lib/supabase/client.ts` (anon), `lib/supabase/server.ts` (service role server-only), `lib/auth.ts` (helpers).
- Layout global, providers (Toast, Theme), styles.
CritÃ¨res: app build OK, pages publiques accessibles.

Phase 1 â€” Auth & Onboarding
- Pages `(auth)`: signup/login/verify/reset. RÃ´le choisi au signup; onboarding par rÃ´le.
- Routes API: `/api/auth/*`, `/api/profile/complete`.
- CrÃ©ation rows `profiles` + spÃ©cifiques rÃ´le; redirections par rÃ´le.
CritÃ¨res: inscription/connexion fonctionnelles; onboarding crÃ©e des donnÃ©es propres.

Phase 2 â€” CrÃ©ateur MVP
- Pages: dashboard, discover, contest details `[id]`, submissions, wallet, messages, settings.
- Upload soumission (storage + DB), affichage statut, notifications basiques.
CritÃ¨res: un crÃ©ateur peut participer Ã  un concours de bout en bout.

Phase 3 â€” Marque MVP
- Wizard Â« nouveau concours Â», dÃ©tail concours (gestion soumissions), funding & factures, messages, settings.
CritÃ¨res: une marque peut crÃ©er/publier/clore un concours et accepter/refuser des soumissions.

Phase 4 â€” Classement & Analytics
- Leaderboard (vues matÃ©rialisÃ©es), page analytics concours, recalcul planifiÃ©.
CritÃ¨res: classement sâ€™affiche et se met Ã  jour.

Phase 5 â€” Paiements
- IntÃ©gration Stripe: funding marque (webhook), cashout crÃ©ateur (webhook), vue paiements.
CritÃ¨res: un concours financÃ©, gagnants payÃ©s (flux test Stripe).

Phase 6 â€” Admin & Audit
- Pages admin: modÃ©ration globale, audit, paramÃ¨tres.
CritÃ¨res: admin peut superviser et auditer.

Phase 7 â€” Polish & SÃ©curitÃ©
- Rate limiting clÃ©s endpoints, CSRF, CSP finale, logs.
CritÃ¨res: audits de sÃ©curitÃ© basiques OK, UX fluide.

---

## 15) DÃ©tails par Ã‰cran (actions â†’ DB)

(extraits reprÃ©sentatifs, Ã  dÃ©cliner)

CrÃ©ateur / contests/[id]
- Bouton Â« Participer Â» â†’ ouvre formulaire:
  - Upload fichier vers bucket `submissions/â€¦` (POST signÃ© si nÃ©cessaire), crÃ©er `submissions` (status=pending), crÃ©er `contest_terms_acceptances` si absent.
  - Event: `submission_created` dans `event_log`.

Marque / contests/new
- Wizard Ã©tapes â†’ POST `/api/contests/create` (server): insÃ¨re `contests`, `contest_terms`, `contest_assets`, `contest_prizes`.
  - Event: `contest_created`.

Marque / contests/[id] / Soumissions
- Actions Approve/Reject: PATCH `/api/submissions/[id]/moderate` (server): maj `submissions.status`, Ã©crire `moderation_history`.
  - Event: `submission_moderated`.

CrÃ©ateur / wallet
- Bouton Â« Retirer Â» â†’ POST `/api/payments/creator/cashout` (server): crÃ©e `cashouts` + init Stripe payout.
  - Event: `cashout_requested`.

Marque / payments
- Bouton Â« Financer Â» â†’ POST `/api/payments/brand/fund` â†’ redirige vers Stripe Checkout; webhook met `payments_brand.status=confirmed`.
  - Event: `brand_funded`.

Admin / audit
- Lecture `audit_logs`, export CSV; recherche multi-critÃ¨res.

---

## 16) AmÃ©liorations ProposÃ©es

- OAuth plateformes crÃ©ateurs (YouTube/TikTok/Instagram) pour preuves dâ€™audience; rafraÃ®chissement tokens (table `platform_oauth_tokens`).
- Anti-triche: pondÃ©ration vues + dÃ©tection anomalies (ratio vues/likes, duplications).
- Centre de notifications enrichi: prÃ©fÃ©rences granulaires, digest email.
- Public pages Â« DÃ©couvrir Â» (SEO) + embed cartes concours partageables.
- Feature flags (lancement progressif), AB testing UX des formulaires longs.
- Export data utilisateur (RGPD) + suppression complÃ¨te (dÃ©jÃ  pensÃ©e cÃ´tÃ© DB).

---

## 17) Checklists rapides

Env
- `.env.local`: SUPABASE_URL/ANON_KEY/SERVICE_ROLE, STRIPE_KEYS, APP_URL.

CSP (next.config.js)
- `frame-src` inclut `https://www.youtube-nocookie.com`.
- `connect-src` inclut Supabase (https + wss) et Stripe.
- Pas dâ€™inline script sans nonce.

SÃ©curitÃ©
- Service role uniquement cÃ´tÃ© serveur.
- Webhook Stripe vÃ©rifiÃ© et idempotent.
- Uploads validÃ©s (mime/poids) et politiques storage resserrÃ©es.

UX
- Toasts sur toute action; states disabled; skeletons.
- Messages dâ€™erreur utiles.

---

Fin â€” Ce plan est prÃªt Ã  Ãªtre suivi itÃ©rativement pour reconstituer lâ€™application de A Ã  Z autour de la base Supabase refondue, en gardant une UX pro et une sÃ©curitÃ© pragmatique.

---

## 25) Routing, Guards & Flows d'accÃ¨s (durcissement)

- Protection globale: tout sous `(app)` nÃ©cessite une session valide; sinon â†’ `(auth)`.
- Redirections rÃ´le aprÃ¨s login: creator â†’ `/app/creator/dashboard`, brand â†’ `/app/brand/dashboard`, admin â†’ `/app/admin/dashboard`.
- Guards par page (server components): `requireRole('creator'|'brand'|'admin')` + vÃ©rif ownership des ressources (contest/submission/message thread).
- Pages d'erreur: `/app/forbidden` (role mismatch/ownership), `/app/not-found` (404), redirection aprÃ¨s logout vers marketing.
- Boutons d'action rendus/activÃ©s uniquement si l'API renverrait 200 (prÃ©â€‘check d'Ã©ligibilitÃ©/ownership pour Ã©viter erreurs Ã  l'envoi).

### ImplÃ©mentation Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession(request);

  // Routes publiques
  if (
    pathname.startsWith('/api/auth/') ||
    pathname === '/' ||
    pathname.startsWith('/legal/')
  ) {
    return NextResponse.next();
  }

  // Routes protÃ©gÃ©es /app/*
  if (pathname.startsWith('/app/')) {
    if (!session) {
      return NextResponse.redirect(
        new URL('/auth/login?redirect=' + encodeURIComponent(pathname), request.url)
      );
    }

    const role = session.user.role;
    
    // VÃ©rification rÃ´le vs route
    if (pathname.startsWith('/app/creator/') && role !== 'creator') {
      return NextResponse.redirect(new URL('/app/forbidden', request.url));
    }
    if (pathname.startsWith('/app/brand/') && role !== 'brand') {
      return NextResponse.redirect(new URL('/app/forbidden', request.url));
    }
    if (pathname.startsWith('/app/admin/') && role !== 'admin') {
      return NextResponse.redirect(new URL('/app/forbidden', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
};
```

### Helpers Auth (lib/auth.ts)

```typescript
// lib/auth.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/types/db';

export async function getSession(request?: Request) {
  // ImplÃ©mentation avec Supabase SSR
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect('/auth/login');
  return session;
}

export async function requireRole(role: UserRole) {
  const session = await requireAuth();
  if (session.user.role !== role) {
    redirect('/app/forbidden');
  }
  return session;
}

export async function requireOwnership(
  resource: { brand_id?: string; creator_id?: string },
  session: Session
) {
  if (session.user.role === 'admin') return true;
  if (resource.brand_id && resource.brand_id === session.user.id) return true;
  if (resource.creator_id && resource.creator_id === session.user.id) return true;
  throw new Error('Forbidden: not owner');
}
```

---

## 26) Inventaire â€” Pages â†” Routes API â†” Tables (rÃ©sumÃ©)

- Auth
  - Pages: `(auth)/login|signup|verify|reset-password`
  - API: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/profile/complete`
  - Tables: `profiles`, `profile_creators|profile_brands`, `audit_logs`
- CrÃ©ateur
  - `/app/creator/dashboard`: `contests`, `submissions`, `notifications`, `cashouts`
  - `/app/creator/discover`: `contests` (active, date window), `tags_categories`
  - `/app/creator/contests/[id]`: `contests`, `contest_terms`, `contest_prizes`, `contest_assets` | API: `submissions/create`
  - `/app/creator/submissions`: `submissions`, `moderation_history|submission_comments`
  - `/app/creator/wallet`: gains persistÃ©s, `cashouts` | API: `payments/creator/cashout`
  - `/app/creator/messages`: `messages_threads`, `messages`
  - `/app/creator/notifications`: `notifications`
- Marque
  - `/app/brand/dashboard`: `contests`, `submissions(pending)`, `metrics_daily`
  - `/app/brand/contests`: `contests`
  - `/app/brand/contests/new`: `contests`, `contest_terms`, `contest_assets`, `contest_prizes` | API: `contests/create`, `payments/brand/fund`
  - `/app/brand/contests/[id]`: `submissions`, `moderation_history`, leaderboard (vue matÃ©rialisÃ©e), `metrics_daily` | API: `submissions/[id]/moderate`, `contests/[id]/(publish|close|winners/compute)`
  - `/app/brand/payments`: `payments_brand`, `invoices_billing` | API: `payments/stripe/webhook`
  - `/app/brand/messages`: `messages_threads`, `messages`
- Admin
  - `/app/admin/dashboard`: `contests`, `submissions`, `metrics_daily`
  - `/app/admin/moderation`: `submissions(pending)`, `moderation_rules`, `moderation_history` | API: `submissions/[id]/moderate`
  - `/app/admin/audit`: `audit_logs`, `event_log`
- LÃ©gales
  - `/legal/*`: `contest_terms` global ou contenu statique alignÃ©

---

## 27) Performance, ObservabilitÃ© & DX

- Performance UI: pagination/infinite scroll sur discover/listings; `react.use`/SWR sur listes; prioritÃ© LCP sur images critiques; rÃ©duire payload des routes (select ciblÃ©).
- Caching: revalidate sur pages publiques; noâ€‘store sur API sensibles; CDN static assets.
- Bundling: `optimizePackageImports` (dÃ©jÃ ), codeâ€‘split par onglet (pages concours marque), Ã©viter librairies lourdes inutiles.
- ObservabilitÃ©: `event_log` enrichi (corrÃ©lation `request_id`); logs cÃ´tÃ© API (niveau info/warn/error) + alerte sur anomalies paiements.
- DX: ESLint/Prettier stricts, `.editorconfig` (UTFâ€‘8), commentaires â€œSource: table/routeâ€ en tÃªte de chaque page/route, mocks/fixtures pour dÃ©mo locale (env fake tokens Stripe test).

---

## 28) Internationalisation & AccessibilitÃ©

- i18n: structure `next-intl` prÃªte (fr par dÃ©faut, en option), messages dâ€™UI externalisÃ©s.
- A11y: contrastes suffisants, labels for, aria-live pour toasts, focus management modals, shortcuts clavier sur modÃ©ration (J/K), respect `prefers-reduced-motion`.

---

## 29) IA â€” FaisabilitÃ© & MÃ©thodologie de mise en Å“uvre

Faisable avec de lâ€™IA: Oui.
- Conditions: ce plan dÃ©taillÃ© (structures, endpoints, validations, rÃ¨gles RLS/ownership) + `.env.local` fourni + clÃ©s Stripe (test) + URL Supabase; prÃ©ciser schÃ©mas Zod et signatures dâ€™API.
- StratÃ©gie:
  - Phase 0/1: lâ€™IA peut scaffolder arborescence, providers, guards, endpoints vides avec validations zod + commentaires â€œSource: â€¦â€.
  - Phase 2/3: implÃ©mentation pages crÃ©ateur/marque en itÃ©rations, en branchant exactement les endpoints + mapping tables.
  - Phase 4/5: intÃ©gration leaderboard (lecture SQL/vues) et paiements Stripe (webhooks signÃ©s/idempotents) avec tests manuels (Stripe mode test).
  - Phase 6/7: modÃ©ration admin, audit, rateâ€‘limit, antiâ€‘CSRF, polish UX.
- Points de vigilance (assistance humaine peut accÃ©lÃ©rer):
  - Secrets/config Stripe & Supabase (crÃ©ation webhooks, endpoints publics),
  - DonnÃ©es de test suffisantes (concours, profils, prix) pour valider lâ€™UX,
  - Ajustements CSP (YouTube nocookie, Supabase, Stripe) selon hÃ©bergeur.

---

## 30) Contrats API dÃ©taillÃ©s (spÃ©cifications)

Principes communs
- AuthN/AuthZ: session Supabase requise; vÃ©rification de rÃ´le (creator/brand/admin) et ownership (brand_id, user_id) pour toute mutation.
- RLS: tables protÃ©gÃ©es; toutes les Ã©critures passent par service role cÃ´tÃ© serveur (never in client).
- Validation: toutes les entrÃ©es validÃ©es par Zod; rÃ©ponses typÃ©es; erreurs normalisÃ©es `{ code, message, details? }`.
- Audits: chaque mutation Ã©crit dans `audit_logs` + Ã©vÃ¨nement `event_log`.
- Rateâ€‘limit: endpoints sensibles protÃ©gÃ©s (voir Â§27).
- Antiâ€‘CSRF: POST/PATCH exigent cookie/entÃªte (doubleâ€‘submit) sur formulaires web.

Auth
- POST `/api/auth/signup`
  - Body: { email, password?, role: 'creator'|'brand', profileFields }
  - Effets: crÃ©e user Supabase; insert `profiles` + (`profile_creators`|`profile_brands`) via service role; renvoie session + profil + rÃ´le.
  - Erreurs: 409 email exists; 400 validations; 500 gÃ©nÃ©rique.
- POST `/api/auth/login`
  - Body: { email, password? } ou magic link; renvoie session + profil + rÃ´le; redirection selon rÃ´le cÃ´tÃ© UI.
- GET `/api/auth/me`
  - Renvoie profil, rÃ´le, flags dâ€™onboarding.
- POST `/api/profile/complete`
  - Body: champs spÃ©cifiques rÃ´le (ex: liens plateformes, sociÃ©tÃ© TVA); Ã©critures dans tables profil; retourne profil complet.
- POST `/api/profile/update` (ajout)
  - Body: mise Ã  jour profil (bio, avatar, prÃ©fÃ©rences notifs) â€” validations strictes; journalise dans `audit_logs`.

Concours (marque/admin)
- POST `/api/contests/create`
  - Body (wizard Ã©tape 1): { title, brief_md, cover_url, allowed_platforms, visibility }
  - Effets: insert `contests(status='draft')`; crÃ©e `contest_terms`, `contest_assets` si fournis; retourne `contest_id`.
- PATCH `/api/contests/[id]/update` (autosave brouillon)
  - Body: patch partiel depuis Ã©tapes 1â€‘4 (dates, ciblage, rÃ©compensesâ€¦)
  - Effets: met Ã  jour lignes `contests`, `contest_terms`, `contest_prizes` (UPSERT) tant que `status='draft'`.
- POST `/api/contests/[id]/publish`
  - PrÃ©â€‘requis: `payments_brand.status='paid'` pour ce concours OU `force=true` par admin.
  - Effets: `contests.status='active'`, timestamp publication.
- POST `/api/contests/[id]/close`
  - Condition: `now() >= ends_at` (ou admin force close).
  - Effets: `contests.status='closed'`.
- POST `/api/contests/[id]/archive`
  - Effets: `contests.status='archived'` (aprÃ¨s close), masquÃ© des listings.
- POST `/api/contests/[id]/winners/compute`
  - Effets: appelle la fonction SQL; persiste gagnants/gains; idempotent.
- POST `/api/contests/[id]/leaderboard/recompute`
  - Effets: rafraÃ®chit vue matÃ©rialisÃ©e/score; renvoie top10.

Soumissions (crÃ©ateur/marque/admin)
- POST `/api/submissions/create`
  - Body: { contest_id, platform, video_url, caption? }
  - PrÃ©â€‘check: `can_submit_to_contest(contest_id, auth.uid())`; validation URL par plateforme; contrainte unique `(creator_id, contest_id)`.
  - Effets: insert `submissions(status='pending')`, `contest_terms_acceptances` si absent; notification Ã  la marque.
  - RÃ©ponse: { submission_id, status }.
- PATCH `/api/submissions/[id]/moderate`
  - Body: { status: 'approved'|'rejected', note? }
  - Condition: owner du concours ou admin; Ã©crit `moderation_history` (et `submission_comments` si prÃ©sent), met `submissions.status`.

Paiements (Stripe)
- POST `/api/payments/brand/fund`
  - Body: { contest_id }
  - Effets: crÃ©e `payments_brand(status='created')`, crÃ©e session Checkout/PaymentIntent; renvoie `checkout_url`.
- POST `/api/payments/stripe/webhook`
  - SÃ©curitÃ©: vÃ©rification signature + idempotency keys.
  - Effets: met `payments_brand.status` (paid/failed/refunded); si paid â†’ active le concours (publish) selon rÃ¨gles.
- POST `/api/payments/creator/cashout`
  - Body: { amount_cents }
  - Conditions: solde suffisant; KYC ok cÃ´tÃ© Stripe Connect.
  - Effets: insert `cashouts(status='requested')`; init payout Stripe; status mis Ã  jour par webhook.

Messagerie & notifications
- POST `/api/messages/threads`
  - Body: { participant_id } (crÃ©ateurâ†”marque)
  - Effets: insert thread si pas dÃ©jÃ  existant; RLS limite aux participants.
- GET `/api/messages/threads`
  - Effets: liste mes threads avec dernier message + compte non lus.
- POST `/api/messages/threads/[id]/messages`
  - Body: { content, attachment? }
  - Effets: insert `messages`; upload signÃ© prÃ©alable si piÃ¨ce jointe; notification.
- POST `/api/notifications/dispatch`
  - Body: { template, user_id, params }
  - Effets: insert `notifications`; envoi email optionnel via SendGrid.

Uploads signÃ©s (optionnels)
- POST `/api/uploads/contest-asset/sign`
  - Body: { mime, size }
  - Effets: retourne URL signÃ©e; applique limites (MIME/size), nommage UUID; storage policies en lecture publique si asset marketing.
- POST `/api/uploads/message-attachment/sign`
  - Idem, avec contraintes plus strictes (types autorisÃ©s).

Erreurs standard
- 400 validation, 401 non authentifiÃ©, 403 interdit/ownership, 404 ressource absente, 409 conflit (doublon submission), 429 rateâ€‘limit, 500 inconnu.

---

## 31) Points sensibles verrouillÃ©s (garanties)

- Activation concours via webhook Stripe ou admin seulement
  - `contests.status='draft'` par dÃ©faut; `/publish` vÃ©rifie `payments_brand.status='paid'` ou rÃ´le admin; discover ne liste que `status='active'`.
- 1 soumission par (user, contest)
  - Contrainte unique DB `(creator_id, contest_id)` + fonction `can_submit_to_contest` cÃ´tÃ© SQL + 409 cÃ´tÃ© API en cas de reâ€‘soumission.
- RLS / service role only
  - Toutes lectures via anon; toutes Ã©critures mutatives via service role dans API serveur; clÃ© service jamais exposÃ©e au client; ownership vÃ©rifiÃ© systÃ©matiquement.
- Leaderboard fiable
  - Calcul par fonction SQL + vues matÃ©rialisÃ©es; endpoint de recompute; idempotence; fallback JS cÃ´tÃ© UI si vue absente; planning de rafraÃ®chissement via cron.
- Cashouts sÃ©curisÃ©s
  - `amount_cents` â‰¤ solde; crÃ©ation `cashouts(status='requested')`; payouts Stripe Connect; statuts mis Ã  jour par webhook; RLS: seul le crÃ©ateur voit ses retraits.

---

## 32) Design System & UX â€” Styleguide complet (alignÃ© homepage)

Fondations (tokens)
- Couleurs (CSS vars dÃ©jÃ  prÃ©sentes):
  - `--accent-indigo` #635bff, `--accent-violet` #7c3aed â†’ dÃ©gradÃ© â€œbrandâ€ (primaire)
  - `--background` / `--foreground` (light/dark), `--surface-muted`, `--surface-elev-1(â€‘dark)` (glass)
  - Ã‰tats: success `#16a34a`, warning `#f59e0b`, danger `#ef4444`, info `#3b82f6` (dÃ©clinÃ©s en `-600` light / `-400` dark)
  - Bordures: gris zinc 200/800 (light/dark)
- Typographie: Plus Jakarta Sans (titre/CTA), Inter (texte long). Ã‰chelle: h1/h2/h3 conformÃ©ment Ã  la homepage; `displayâ€‘1/2` conservÃ©s.
- Espacements: base 4px; sections 24â€“48px; borderâ€‘radius 12â€“16px pour cartes/inputs; ombres douces (y=10â€“25, blur 25â€“40, alpha 0.08â€“0.15).
- ThÃ¨me: Dark mode vérifié (contrastes, dégradés, images adaptées si besoin).
- DonnÃ©es (charts): palette dÃ©rivÃ©e de lâ€™accent (indigo/violet) + complÃ©mentaires (cyan, amber, emerald). 6â€“8 teintes max.
- Iconographie: Lucide (stroke 1.75), cohÃ©rence tailles 16/20/24, couleurs par statut.

Composants (UI kit)
- Buttons: Primary (dÃ©gradÃ© indigoâ†’violet), Secondary (outline), Ghost (texte), Destructive (rouge), Loading (spinner intÃ©grÃ©), Sizes (sm/md/lg). Ã‰tats hover/focus/disabled.
- Inputs: text/email/url, textarea, select, checkbox, radio; labels visibles, helpâ€‘text, messages dâ€™erreur; zones focus `ringâ€‘accent`.
- Navigation: Header glass collant + Sidebar par rÃ´le; onglets (Tabs) pour les vues â€œdÃ©tail concoursâ€.
- Cards: surfaces glass pour rÃ©sumÃ©s (KPIs, concours), padding 16â€“24, ombre lÃ©gÃ¨re.
- Badges: status (pending=slate, approved=green, rejected=red, won=amber), â€œplatformâ€ (TikTok/IG/YT) en tiny pill.
- Tables: header sticky, lignes zebra/hoveÂ­r, actions inline, colonnes responsives (collapse sur mobile), tri/filtre.
- Dialogs/Modals: confirmation (reject/close), formulaires courts; focusâ€‘trap + ESC.
- Toasts: success/erroÂ­r/info; ariaâ€‘live; durÃ©es 3â€“5s; bouton Undo quand possible.
- Empty states: icÃ´ne + titre + explication + CTA (ex: â€œCrÃ©e ton 1er concoursâ€).
- Skeletons: shimmer pour cartes, tableaux et fiches dÃ©tail.

Motions & microâ€‘interactions (Framer Motion, cohÃ©rentes homepage)
- Progress bar top (2px, dÃ©gradÃ© indigo/violet) prÃ©sente sur `(app)` comme sur la homepage.
- Revealâ€‘onâ€‘scroll doux pour blocs (opacity/translate 16â€“24px, 400â€“700ms, ease [0.2,0.8,0.2,1]). Respect `prefersâ€‘reducedâ€‘motion`.
- Gradient animÃ© trÃ¨s subtil sur titres/CTAs premium (8s, ease inâ€‘out), jamais distrayant en formulaires.
- Parallax variable `--hero-parallax` conservÃ©e pour headers de pages (amplitude faible: 4â€“8px).
- Transitions dâ€™Ã©tat (loadingâ†’success): fondu 180â€“240ms; listes avec `layout` pour rÃ©ordonner sans â€œsautsâ€.
- Effets â€œwowâ€ contextuels: confetti discret lors â€œwinners computedâ€ et â€œcashout paidâ€ (toggleable), highlight liserÃ© dÃ©gradÃ© sur carte gagnant.

Layouts (responsive)
- Breakpoints: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. Contenu centrÃ© max 1200â€“1280.
- Grille: 12 colonnes desktop; 1â€“2 colonnes mobile/tablette; sidebar collapsible < lg.
- App shell par rÃ´le: header (logo mini + avatar + notifications) + sidebar (sections propres) + contenu; footer minimal.
- Barres outils: filtres/tags sous le header des vues lists; sticky avec glass.

SpÃ©cifiques pages (exemples clÃ©s)
- Creator Dashboard: hero compact (salutation + solde), â€œConcours en coursâ€ (cards 2â€“3), â€œMes derniÃ¨res soumissionsâ€, â€œNotifications rÃ©centesâ€. CTA Ã‰largi â€œDÃ©couvrirâ€.
- Discover: cartes concours (cover, dates, rÃ©compenses, tags, plateformes), filtres sticky (tags/country/platform), pagination/infinite scroll.
- Contest Detail (creator): header visuel (cover + dÃ©gradÃ©), tabs: Brief | RÃ©compenses | RÃ¨gles | Participer. Bloc â€œÃ‰ligibilitÃ©â€ (statut en temps rÃ©el). Formulaire participation simple.
- Submissions (creator): table + filtres; colonne statut + note de modÃ©ration.
- Wallet (creator): solde en carte verre, historique (table), CTA â€œRetirerâ€, bandeau dâ€™info (dÃ©lais/fees).
- Brand Dashboard: KPIs (cards), â€œÃ€ modÃ©rerâ€ (table 5 derniÃ¨res), â€œConcours actifsâ€, â€œBudget consommÃ©â€.
- Wizard Contest (brand): 5 steps avec autosave; stepper visible; rÃ©sumÃ© final; avant paiement afficher total+commission.
- Contest Detail (brand): tabs RÃ©sumÃ© | Soumissions | Classement | Analytics | ParamÃ¨tres. Classement top10, courbes vues/engagement, actions modÃ©ration inline.
- Admin Moderation: table fullâ€‘width avec filtres (concours/marque/crÃ©ateur), actions bulk, raccourcis clavier J/K.
- Admin Audit: table filtrable, export CSV, dÃ©tail log en slideâ€‘over.
- Messages: split view (threads Ã  gauche, contenu Ã  droite), composer fixe bas, upload PJ avec preview.
- Notifications Center: liste chronologique groupÃ©e par jour, filtres (type: system/modÃ©ration/paiement), bouton â€œMarquer comme luâ€.

Constance avec la homepage
- Reprendre: dÃ©gradÃ©s indigo/violet, surfaces glass, progress bar top, revealâ€‘onâ€‘scroll, typographies et microâ€‘copie.
- Ã‰viter: surâ€‘animation dans les formulaires et listes de travail; â€œwowâ€ rÃ©servÃ© aux moments clÃ©s (succÃ¨s, victoire, paiement confirmÃ©).

Performance & mÃ©dias
- `next/image` partout (sizes explicites), `priority` sur visuels clÃ©s; formats webp/avif; prefetch liens critiques.
- Fonts via `next/font` (dÃ©jÃ ), `display: swap`; limiter variantes.
- Embeds vidÃ©o: YouTube `nocookie`; TikTok/IG: fallback preview carte (oEmbed SSR â†’ poster + lien) pour Ã©viter charge scripts tiers.

RÃ©daction & accessibilitÃ©
- Microâ€‘copie positive, concise, orientÃ©e action (CTA = verbe clair). Messages dâ€™erreurs actionnables.
- A11y: contrastes >= AA, focus visible, libellÃ©s explicites, ariaâ€‘live pour toasts; tests clavier sur dialogues/menus.

Checklist UI finale
- Ã‰tats: loading/empty/error/success/disabled/forbidden couverts pour chaque Ã©cran.
- Tooltips là où besoin (boutons désactivés: expliquer pourquoi).
- Skeletons configurés pour tables, cartes et vues détail.
- Dark mode vérifié (contrastes, dégradés, images adaptées si besoin).
- CohÃ©rence icÃ´nes/tailles/paddings entre pages.

---

## 33) Gestion des Conflits & Concurrence

- **Optimistic Locking**: Utiliser `updated_at` pour dÃ©tecter modifications concurrentes sur concours.
- **Retry Logic**: Backoff exponentiel pour soumissions simultanÃ©es (Ã©viter race condition).
- **Lock DistribuÃ©**: Pour compute winners (Ã©viter double calcul) via table `locks` ou Redis.

```typescript
// lib/locks.ts
export async function withLock<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const lock = await acquireLock(key, ttl);
  if (!lock) {
    throw new AppError('LOCK_FAILED', 'Resource is locked', 409);
  }
  try {
    return await fn();
  } finally {
    await releaseLock(key);
  }
}
```

---

## 34) Migration & Rollback

- **Scripts de Migration**: NumÃ©rotÃ©s sÃ©quentiellement, idempotents (`CREATE IF NOT EXISTS`).
- **Rollback Plan**: Pour chaque phase critique, script de rollback documentÃ©.
- **Backup Automatique**: Avant migrations critiques (via Supabase Dashboard ou script).
- **Tests de Non-RÃ©gression**: AprÃ¨s chaque migration, vÃ©rifier intÃ©gritÃ© donnÃ©es.

**Checklist Migration**:
1. Backup DB complet
2. ExÃ©cuter migration en mode test (dry-run si possible)
3. Valider structure (sanity checks)
4. Tests fonctionnels sur donnÃ©es rÃ©elles
5. DÃ©ploiement progressif (feature flags si nÃ©cessaire)

---

## 35) Documentation Technique

### README Principal

```markdown
# ClipRace â€” Plateforme UGC Concours

## Setup Local

### PrÃ©requis
- Node.js 18+
- Compte Supabase
- Compte Stripe (mode test)

### Installation
1. `npm install`
2. Copier `.env.example` vers `.env.local`
3. Remplir variables d'environnement
4. `npm run dev`

### Structure
- `/src/app`: Pages Next.js (App Router)
- `/src/components`: Composants React rÃ©utilisables
- `/src/lib`: Utilitaires (auth, supabase, validators)
- `/db_refonte`: Scripts SQL de migration
```

### Documentation API

- **OpenAPI/Swagger**: GÃ©nÃ©rer depuis routes API avec annotations
- **tRPC** (optionnel): Type-safe API avec gÃ©nÃ©ration automatique docs

### SchÃ©ma DB

- Diagram ER: GÃ©nÃ©rer avec `dbdiagram.io` ou Mermaid
- Documentation tables: Commentaires SQL dans fichiers migration

---

## 36) RGPD & ConformitÃ©

### Export DonnÃ©es Utilisateur

```typescript
// app/api/user/export/route.ts
export async function GET() {
  const session = await requireAuth();
  const adminClient = getAdminClient();
  
  const data = {
    profile: await getProfile(session.user.id),
    submissions: await getSubmissions(session.user.id),
    cashouts: await getCashouts(session.user.id),
    messages: await getMessages(session.user.id),
  };
  
  return Response.json(data, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="cliprace-export-${Date.now()}.json"`,
    },
  });
}
```

### Suppression Compte

- Cascade propre: Supprimer toutes donnÃ©es utilisateur (RLS + triggers)
- Anonymisation optionnelle: Garder donnÃ©es agrÃ©gÃ©es pour analytics
- Confirmation email avant suppression dÃ©finitive

### Consentement Cookies/Tracking

- Banner consentement au premier visit
- PrÃ©fÃ©rences granulaires (analytics, marketing)
- Respect `Do Not Track` header

---

## 37) Onboarding Stripe Connect

### Flow CrÃ©ateur

1. **Initiation**: Clic "Configurer mon compte" dans Settings
2. **Onboarding Link**: GÃ©nÃ©rer via Stripe API `account.createLoginLink()`
3. **Webhook `account.updated`**: Mettre Ã  jour statut KYC dans DB
4. **Gestion Ã‰tats**:
   - `restricted`: Compte incomplet, bloquer cashouts
   - `enabled`: Compte complet, cashouts autorisÃ©s
   - `rejected`: KYC refusÃ©, notifier utilisateur

```typescript
// app/api/stripe/connect/onboard/route.ts
export async function POST() {
  const session = await requireRole('creator');
  
  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'FR',
    email: session.user.email,
  });
  
  // Sauvegarder account_id dans profile_creators
  await saveStripeAccountId(session.user.id, account.id);
  
  const onboardingLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.APP_URL}/app/creator/settings`,
    return_url: `${process.env.APP_URL}/app/creator/settings?onboarded=true`,
    type: 'account_onboarding',
  });
  
  return Response.json({ url: onboardingLink.url });
}
```

---

## 38) Gestion des Notifications

### In-App (Temps RÃ©el)

- Supabase Realtime: Abonnement Ã  `notifications` table
- Badge compteur non lus dans header
- Toast pour notifications importantes

### Email (SendGrid)

- Templates avec variables: `{{user_name}}`, `{{contest_title}}`, etc.
- PrÃ©fÃ©rences utilisateur: Opt-in/opt-out par type
- Digest quotidien/hebdomadaire optionnel

### Push (Optionnel)

- Firebase Cloud Messaging pour notifications push mobile
- Web Push API pour desktop

---

## 39) Analytics & Tracking

### Product Analytics (PostHog ou Mixpanel)

**Ã‰vÃ©nements ClÃ©s**:
- `user_signed_up` (role)
- `contest_created` (brand_id, prize_pool)
- `submission_created` (contest_id, platform)
- `cashout_requested` (amount_cents)
- `contest_closed` (winners_count)

**Privacy First**:
- Consentement avant tracking
- Mode anonyme si utilisateur refuse
- Pas de PII dans Ã©vÃ©nements

### Performance Monitoring

- **Vercel Analytics**: Web Vitals automatiques
- **Custom Metrics**: Temps de chargement pages critiques
- **Database Queries**: Logger queries lentes (>500ms)

---

## 40) Internationalisation (i18n)

### Structure next-intl

```
messages/
  fr.json
  en.json
```

### Formatage

- Dates: `Intl.DateTimeFormat` par locale
- Devises: `Intl.NumberFormat` avec currency
- Nombres: Formatage localisÃ© (virgule vs point)

### RTL Support

- Si nÃ©cessaire: Support arabe/hÃ©breu avec `next-intl` RTL

---

## 41) Performance Optimization

### Database

- **Index Manquants**: Identifier via `EXPLAIN ANALYZE`
  - `(contest_id, status)` sur `submissions`
  - `(creator_id, status)` sur `submissions`
  - `(brand_id, status)` sur `contests`
- **Partitioning**: `event_log` si > 1M lignes (par mois)
- **Connection Pooling**: PgBouncer si nÃ©cessaire

### Frontend

- **Code Splitting**: Par route automatique (Next.js)
- **Lazy Loading**: Composants lourds (charts, modals)
- **Image Optimization**: `next/image` partout, formats WebP/AVIF

### API

- **Cache Redis**: Leaderboard, stats frÃ©quentes (TTL 5min)
- **Pagination Cursor**: Pour grandes listes (Ã©viter OFFSET)
- **Select CiblÃ©**: Ne rÃ©cupÃ©rer que colonnes nÃ©cessaires

---

## 42) Gestion Multi-Devises

- Devise par concours (`contests.currency`)
- Conversion affichage: API externe (ex: exchangerate-api.com) ou taux fixes
- Stripe gÃ¨re multi-devises nativement (payouts dans devise locale)
- Affichage: Toujours montrer devise originale + Ã©quivalent EUR si diffÃ©rent

---

## 43) .env.example Complet

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=xxx

# SendGrid (optionnel)
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@cliprace.com

# Analytics (optionnel)
NEXT_PUBLIC_POSTHOG_KEY=xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry (optionnel)
NEXT_PUBLIC_SENTRY_DSN=xxx
```

---

## 44) Glossaire

- **RLS (Row Level Security)**: Politique PostgreSQL qui restreint l'accÃ¨s aux lignes selon l'utilisateur
- **Service Role**: ClÃ© Supabase avec droits administrateur (jamais exposÃ©e au client)
- **Anon Key**: ClÃ© Supabase publique, limitÃ©e par RLS
- **Stripe Connect**: Plateforme Stripe pour gÃ©rer paiements entre marques et crÃ©ateurs
- **Vue MatÃ©rialisÃ©e**: Vue PostgreSQL prÃ©-calculÃ©e et stockÃ©e (performance)
- **Idempotency Key**: ClÃ© unique pour Ã©viter traitement dupliquÃ© d'une requÃªte
- **Magic Link**: Lien d'authentification envoyÃ© par email (pas de mot de passe)
- **oEmbed**: Standard pour embed contenu externe (vidÃ©os YouTube/TikTok)

---

Fin â€” Plan complet et actionnable pour reconstruction MVP â†’ V1.


---

## 33) Normalisation & Détails d’implémentation

- Nommage récompenses: utiliser exclusivement `contest_prizes` (éviter `contest_prizes_winnings`).
- Idempotency-Key: accepter l’en-tête `Idempotency-Key` sur `POST /api/submissions/create`, `POST /api/contests/create`, `POST /api/payments/brand/fund` pour éviter doublons en cas de retry.
- Solde Wallet (créateur): `balance = SUM(gains_persistés) − SUM(cashouts WHERE status IN ('requested','processing','paid'))`. Refuser cashout si `balance < amount_cents` ou KYC manquant.
- Leaderboard (poids par défaut): vues=1x, likes=4x, shares=8x (exemple). Stocker la config côté SQL ou constante serveur; exposer un recompute endpoint; DoD: “top10 mis à jour ≤ 10 min”.
- Stripe (architecture): Marque paie via Checkout en tant que Customer (pas de compte Connect); Créateurs ont Stripe Connect pour payouts; job de nettoyage des paiements `created` abandonnés.
- CSRF (détail): GET formulaire émet token + cookie httpOnly `SameSite=Lax`; POST/PATCH exigent header `x-csrf` = valeur du cookie (sauf webhooks Stripe).
- Realtime (option): abonner messages/notifications (Supabase Realtime); feature flag pour couper si charge.
- Pagination/filtrage: curseur (`cursor`, `limit`) + index adaptés (voir §34) pour listings (concours, submissions, messages, payments).
- CSP: autoriser `frame-src https://www.youtube-nocookie.com`; limiter/retirer `images.dangerouslyAllowSVG` en prod.
- .env.example: fournir un gabarit des variables requises (Supabase/Stripe/APP_URL) pour onboarding rapide.

---

## 34) Indexation & Performances (DB)

- Index suggérés
  - `contests(brand_id, status, starts_at, ends_at)`
  - `submissions(contest_id, status, created_at)`
  - `submissions(creator_id, contest_id) UNIQUE`
  - `payments_brand(contest_id, status, created_at)`
  - `cashouts(user_id, status, created_at)`
  - `messages_threads(participant_id)`
  - `messages(thread_id, created_at)`
  - `notifications(user_id, created_at)`
- Rate‑limit store: table `rate_limits(key, route, ts)` avec index `(key, route, ts desc)`; quotas: signup 5/min/IP; submissions 1/min/user et 10/jour/user; payments 3/min/brand.

---

## 35) RGPD (Export/Suppression)

- Export: `POST /api/account/export` — génère un export JSON des données utilisateur (profils, submissions, cashouts, messages, notifications…)
- Suppression: `POST /api/account/delete` — suppression logique/physique encadrée (désactivation compte, anonymisation messages si nécessaire, purge storage lié).
- Journalisation: logguer les requêtes RGPD dans `audit_logs`.

---

## 36) Alignement exhaustif avec le schéma Supabase (db_refonte)

Corrections sémantiques (normatives)
- Statuts concours: utiliser `contest_status` = 'draft' | 'active' | 'paused' | 'ended' | 'archived' (remplace toute mention de 'closed' par 'ended').
- Dates concours: utiliser `start_at` / `end_at` (remplace `starts_at` / `ends_at`).
- Plateformes autorisées: utiliser `contests.networks platform[]` (remplace tout `allowed_platforms` JSONB).
- Historique modération: utiliser `moderation_actions` (remplace `moderation_history`).
- Leaderboard: utiliser `refresh_leaderboard()` et `get_contest_leaderboard()` (remplace `update_contest_leaderboard`).
- Paiements marque: statut `payment_status` → activation sur `'succeeded'` (remplace 'paid/confirmed' dans le texte par `'succeeded'`).
- Gagnants: utiliser `contest_prizes` + `contest_winnings` (les gagnants ne modifient pas `submissions.status`).

Tables et champs clés (par domaine)
- Profils: `profiles(id, role, email, ...)`, `profile_creators(followers, avg_views, primary_platform)`, `profile_brands(company_name, vat_number, ...)` — RLS activée.
- Concours: `contests(brand_id, title, slug, brief_md, cover_url, status, prize_pool_cents, start_at, end_at, networks platform[], max_winners, org_id?, contest_terms_id?)` ; assets via `contest_assets` ; tags via `contest_tags` + `contest_tag_links` ; CGU acceptées via `contest_terms_acceptances`.
- Soumissions: `submissions(contest_id, creator_id, platform, external_url, status, rejection_reason, moderated_by?, moderation_notes?)` ; unique `(contest_id, creator_id, external_url)` ; métriques `metrics_daily(views, likes, comments, shares, weighted_views)`.
- Classement/analytics: vue `leaderboard` (+ mat. `leaderboard_materialized`), vues `contest_stats`, mat. `brand_dashboard_summary`, `creator_dashboard_summary`.
- Prix & gains: `contest_prizes(position, percentage|amount_cents)` ; gains persistés `contest_winnings(contest_id, creator_id, rank, payout_cents, payout_percentage, paid_at?, cashout_id?)`.
- Paiements & cashouts: `payments_brand(brand_id, contest_id, amount_cents, status payment_status, stripe_* ids, org_id?)`, `cashouts(creator_id, amount_cents, status cashout_status, stripe_account_id, stripe_transfer_id)`, `webhooks_stripe(stripe_event_id unique, payload, processed)`.
- Messagerie/Notif: `messages_threads(contest_id?, brand_id, creator_id, unread flags)`, `messages(thread_id, sender_id, body)`, `messages_attachments(message_id, asset_id?, url?)`, `notifications(user_id, type, content, read)`, `notification_templates`, `notification_preferences`, `push_tokens`.
- Audit/Logs: `audit_logs(actor_id, action, table_name, row_pk, old_values, new_values, ip, ua)`, `event_log(user_id?, org_id?, event_name, properties)` ; `status_history(table_name, row_id, old_status, new_status, reason)`.
- Plateformes & ingestion: `platform_accounts(user_id, platform, platform_user_id?, handle?)`, `platform_oauth_tokens` (service_role only), `ingestion_jobs`, `ingestion_errors`; fonction `compute_daily_metrics(...)` à compléter par l’app.
- Storage & assets: table `assets` (métadonnées, public/private, moderation_status), policies pour buckets `avatars`, `contest_assets`, `ugc_videos`, `invoices`.

Fonctions utiles (métier)
- `is_contest_active(p_contest_id)` → bool. Vérifier activité avant participation.
- `can_creator_submit(p_contest_id, p_creator_id)` → bool. Respecte `contests.max_submissions_per_creator` (défaut 1).
- `get_contest_leaderboard(p_contest_id, p_limit)` → Top N courant (vue `leaderboard`).
- `refresh_leaderboard()` / `refresh_all_materialized_views()` → rafraîchir cache matérialisé.
- `compute_payouts(p_contest_id)` → pré‑calcul des gains (proportionnels sur Top N).
- `finalize_contest(p_contest_id)` → passe le concours à 'ended' et persiste les `contest_winnings`.

Flux alignés avec la DB
- Créateur → Participer: vérifier `is_contest_active` + `can_creator_submit` ; insérer `submissions(status='pending', external_url, platform)` ; si première participation, insérer `contest_terms_acceptances`.
- Marque → Modérer: écrire `moderation_actions(approve/reject, reason)` ; mettre `submissions.status` et éventuellement `rejection_reason`/`moderation_notes`, et `moderated_by`.
- Classement: lire via `get_contest_leaderboard`, rafraîchir via `refresh_leaderboard()` périodiquement (cron `refresh_all_materialized_views`).
- Fin concours: passer `contests.status` à 'ended' (route API) OU appeler `finalize_contest` pour persister `contest_winnings` ; l’UI gagnants s’appuie sur `contest_winnings` (et non un statut 'won' côté `submissions`).
- Paiements (activation): créer `payments_brand(status='requires_payment')` → Checkout Stripe → webhook écrit `webhooks_stripe` + met `payments_brand.status='succeeded'` → l’API publie le concours (`status='active'`).
- Wallet créateur: solde = somme des `contest_winnings.payout_cents` − somme des `cashouts` (requested/processing/paid) ; cashout crée une ligne `cashouts(status='requested')` et lie `contest_winnings.cashout_id` au paiement quand payé.

Points d’implémentation (API/UI)
- Éligibilité avancée (followers/avg_views/country): pas de colonnes dédiées dans `contests`; calculer côté API via `profile_creators.followers/avg_views`, `profiles.country` et `contests.networks`.
- Prizes UI: créer N lignes `contest_prizes(position, percentage|amount_cents)` ; l’aperçu des gains peut utiliser `compute_payouts` avant finalisation.
- Analytics UI (Marque): s’appuie sur `contest_stats`, `brand_dashboard_summary` ; Creator dashboard sur `creator_dashboard_summary`.
- Messaging attachments: utiliser `messages_attachments` et `assets` (ou URL) + policies de `storage` pour signed URLs.
- Idempotence webhooks: utiliser `webhooks_stripe` (clé unique `stripe_event_id`) pour ignorer les replays.
