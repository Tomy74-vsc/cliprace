# CLAUDE.md — ClipRace Project Intelligence v2.0
> Tu es l'agent d'exécution **Cursor / Claude Code (Opus 4.6)** du projet ClipRace.
> Ce fichier est ton **contexte absolu**. Lis-le entièrement avant chaque session.
> Lead Architect / Orchestrateur : Lead Engineer Senior (spécifications et review).
> **Dernière mise à jour : Mars 2026 — Post PR8 + Master Blueprint intégré**

---

## 0) PROJET EN UN PARAGRAPHE

ClipRace est une plateforme SaaS **B2B/B2C** qui connecte des **marques** (brands) et des **créateurs UGC** via des concours vidéo monétisés. Les marques créent des contests avec budget/prize pool, les créateurs soumettent des vidéos, un leaderboard classe les performances, et les paiements sont distribués via Stripe Connect Standard. Trois rôles : `brand`, `creator`, `admin`.

---

## 1) STACK — NON NÉGOCIABLE

```
Runtime      : Next.js 16 App Router + React 19 + TypeScript strict
Build        : Turbopack (dev) / standard Next build (prod)
Styling      : Tailwind v4 + CSS variables (tokens brand) + tailwind-merge + cva
UI primitives: shadcn/ui + Radix UI
Animation    : framer-motion (islands uniquement, springs du dictionnaire UNIQUEMENT)
Data viz     : recharts (client islands)
Premium libs : @number-flow/react · sonner · cmdk · vaul · cobe · @rive-app/react-canvas
Backend      : Supabase (Auth / RLS / Storage / RPC / Realtime / pgmq)
Payments     : Stripe (Checkout + Connect Standard)
Jobs longs   : Trigger.dev (tracking, scraping, retries)
Jobs courts  : Supabase pg_cron (housekeeping, refresh vues)
Forms        : react-hook-form + zod
Tables       : @tanstack/react-table
State        : zustand (client global) — pas de Redux
Dev tools    : react-scan · ESLint · Prettier · Vitest · Playwright
```

**Versions exactes dans `package.json` — ne jamais les changer sans instruction.**

---

## 2) ARCHITECTURE FICHIERS (état réel post-PR8)

```
src/
├── app/
│   ├── (auth)/               # Login, register, reset
│   ├── app/
│   │   ├── brand/            # Interface marque ✅ PR1-PR8 TERMINÉS
│   │   │   ├── dashboard/
│   │   │   ├── contests/
│   │   │   │   ├── [id]/     # 5 tabs: Overview/UGC/Leaderboard/Analytics/Settings
│   │   │   │   └── new/      # Wizard 5 steps + upload Storage
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   ├── creator/          # Interface créateur (en cours)
│   │   └── admin/            # Interface admin ✅ TERMINÉE (9.1/10)
│   └── api/
│       ├── admin/            # Routes admin — toutes protégées CSRF+RLS
│       ├── brand/            # Routes brand — sécurisées PR1
│       │   ├── contests/     # POST create, PATCH update, publish/pause/resume/end/duplicate
│       │   ├── submissions/  # ⚠️ approve/reject/contact — vérifier existence physique
│       │   └── upload/       # cover → Supabase Storage
│       └── webhooks/         # Stripe webhooks
├── components/
│   ├── brand-ui/             # ✅ Kit UI complet (PR2)
│   │   ├── Surface.tsx       # variants: default/hoverable/track/notched
│   │   ├── Panel.tsx
│   │   ├── Card.tsx          # ⚠️ prop 'variant' non supportée — voir BUGS CONNUS
│   │   ├── KpiHero.tsx       # data-testid="kpi-hero"
│   │   ├── Kpi.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── DataTable.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx    # prop: action (singulier, pas actions)
│   │   ├── ErrorState.tsx    # props: title, description, retry (pas retryLabel)
│   │   ├── ActionDialog.tsx
│   │   └── index.ts
│   ├── admin/
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── csrf.ts               # assertCsrf() — ⚠️ NON HMAC-signé (voir GAPS CRITIQUES)
│   ├── csrf-client.ts        # getCsrfToken() — utilisé dans wizard
│   ├── motion.ts             # ⚠️ À CRÉER — dictionnaire springs (voir section 3.3)
│   ├── supabase/
│   │   ├── ssr.ts            # getSupabaseSSR() — UTILISER CETTE FONCTION
│   │   └── client.ts
│   ├── stripe.ts
│   ├── brand/
│   │   ├── rate-limit.ts     # enforceBrandRateLimit(), BRAND_LIMIT_CRITICAL/STANDARD/READ_ENRICHED
│   │   ├── validators.ts     # submissionValidators, contestValidators
│   │   └── sanitize.ts
│   └── admin/
│       ├── rate-limit.ts
│       ├── audit.ts
│       ├── validators.ts
│       └── sanitize.ts
├── hooks/
├── types/
└── middleware.ts             # Auth + CSRF edge — ⚠️ pas de role-guard (voir GAPS CRITIQUES)
```

---

## 3) DESIGN SYSTEM — RÈGLES ABSOLUES

### 3.1 Identité visuelle ClipRace

**Signature 1 — Race Light** : `--accent: #10B981` — < 10% écran, jamais de floods
**Signature 2 — Track Pattern** : SVG `/public/track-pattern.svg` 2-4% opacité, quelques panels
**Signature 3 — Clip Notch** : `clip-path: polygon(0 0,calc(100%-16px) 0,100% 16px,...)`, 1-2 par écran

**Effect budget** : max 1 Magic UI effect + max 1 Rive par écran. Border Beam = KpiHero uniquement.

### 3.2 Tokens CSS

```css
--bg-void: #050505;
--surface-1: #0A0F14;
--surface-2: #101721;
--surface-3: #141C28;
--text-1: rgba(255,255,255,0.92);
--text-2: rgba(255,255,255,0.66);
--text-3: rgba(255,255,255,0.44);
--border-1: rgba(255,255,255,0.06);
--border-2: rgba(255,255,255,0.10);
--accent: #10B981;
--accent-soft: rgba(16,185,129,0.12);
--accent-edge: rgba(16,185,129,0.18);
--success: #10B981; --warning: #F59E0B; --danger: #EF4444;
--cta-bg: #FFFFFF; --cta-fg: #0A0D10;
--r2: 12px; --r3: 16px; --r4: 24px; --r-pill: 999px;
--shadow-1: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 20px rgba(0,0,0,0.45);
--shadow-2: 0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px rgba(0,0,0,0.55);
```

### 3.3 Springs Framer Motion — DICTIONNAIRE CENTRAL (source de vérité)

```ts
// src/lib/motion.ts — SEULE source autorisée pour les springs
export const springVif      = { type: "spring", stiffness: 400, damping: 30, mass: 0.8 }
export const springDoux     = { type: "spring", stiffness: 150, damping: 20, mass: 1.0 }
export const springAmbiante = { type: "spring", stiffness: 80,  damping: 15, mass: 1.2 }
export const springFeedback = { type: "spring", stiffness: 600, damping: 40 }
export const stagger        = { staggerChildren: 0.05, delayChildren: 0.1 }

// ❌ INTERDIT : transition={{ duration: 0.25, ease: 'easeOut' }}
// ✅ OBLIGATOIRE : transition={springVif}
// TOUJOURS respecter prefers-reduced-motion
```

---

## 4) RÈGLES DE CODE — NON NÉGOCIABLES

### 4.1 Server vs Client

- Server Components par défaut pour toutes les pages `/app/*`
- Client Islands uniquement pour : realtime · charts · framer-motion · cmdk · lenis · number-flow · vaul · rive · react-hook-form
- `Promise.all` OBLIGATOIRE — zéro waterfall
- Un parent `'use client'` ne doit jamais encapsuler un layout entier

### 4.2 Sécurité (CRITIQUE)

```ts
// Pattern OBLIGATOIRE sur toute route mutative brand
import { assertCsrf } from '@/lib/csrf'
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit'
import { getSupabaseSSR } from '@/lib/supabase/ssr'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // 1. CSRF
  const cookieHeader = req.headers.get('cookie')
  const csrfHeader = req.headers.get('x-csrf')
  try { assertCsrf(cookieHeader, csrfHeader) }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }) }

  // 2. Auth
  const supabase = await getSupabaseSSR()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 3. Rate limit
  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL)

  // 4. Ownership (join explicite, jamais par id nu)
  const { data: contest } = await supabase
    .from('contests')
    .select('id, brand_id, status')
    .eq('id', params.id)
    .eq('brand_id', user.id)
    .single()
  if (!contest) return Response.json({ error: 'Not found' }, { status: 404 })

  // 5. Zod validation
  // 6. Action
}
```

**Rate limit presets** :
- `BRAND_LIMIT_CRITICAL` : 10 req/min (publish, upload, paiement)
- `BRAND_LIMIT_STANDARD` : 30 req/min (update, create)
- `BRAND_LIMIT_READ_ENRICHED` : 5 req/min (export, bulk)

### 4.3 Routing canonique

```
/app/brand/*   → accessible uniquement si profiles.role = 'brand'
/app/creator/* → accessible uniquement si profiles.role = 'creator'
/app/admin/*   → accessible uniquement si profiles.role = 'admin' + AAL2
```

⚠️ Le middleware actuel ne vérifie PAS le rôle — guard à ajouter (GAP-02).

### 4.4 CSS

- `cn()` pour merge classes
- `.brand-scope` sur le root de chaque composant brand-ui
- Zéro inline style sauf valeurs dynamiques (documenter avec `// dynamic: reason`)
- Zéro one-off style dans les pages — composer `brand-ui/*`
- `<Image>` next/image TOUJOURS — jamais `<img>` natif

---

## 5) BASE DE DONNÉES — SCHÉMA CLÉS

### Tables principales

```sql
profiles          -- role: 'brand' | 'creator' | 'admin', onboarding_complete
contests          -- brand_id, status: draft|active|paused|ended|archived
                  -- ⚠️ manque: ranking_formula_version, ranking_weights_snapshot, ranking_frozen_at
submissions       -- contest_id, creator_id, external_url (PAS video_url), thumbnail_url
                  -- ⚠️ manque: verification_status
metrics_daily     -- submission_id, metric_date (PAS recorded_at), views, likes, comments, shares
                  -- ⚠️ manque: method, confidence, formula_version, weights_snapshot
leaderboard       -- VUE (pas table): contest_id, creator_id, agrégats
contest_winnings  -- rank, payout_cents, paid_at
                  -- ⚠️ manque: eligibility_status
messages_threads  -- brand_id, creator_id, contest_id (UNIQUE triplet), unread_for_brand/creator
messages          -- thread_id, sender_id, sender_role: 'brand'|'creator', content
payments_brand    -- brand_id, contest_id, stripe_payment_intent_id, status
cashouts          -- creator_id, amount_cents, stripe_transfer_id
platform_accounts -- creator_id, platform, oauth connecté
ingestion_jobs    -- submission_id, status: queued|running|succeeded|failed_retryable|failed_final|paused
```

### RPCs disponibles

```sql
get_contest_metrics(p_contest_id uuid)
get_contest_leaderboard(p_contest_id uuid, p_limit int)
get_brand_views_timeseries(p_brand_id uuid, p_days int)
-- Vues : brand_dashboard_summary, contest_stats, leaderboard
```

### Jointures critiques

```ts
// submissions → profiles (nom créateur)
'profiles!submissions_creator_id_fkey(display_name, avatar_url)'

// messages_threads → profiles
'profiles!messages_threads_creator_id_fkey(display_name, avatar_url)'

// submissions ownership via join
'.from("submissions").select("..., contests!inner(brand_id)").eq("contests.brand_id", user.id)'
```

---

## 6) ÉTAT D'AVANCEMENT (post-PR8)

### ✅ TERMINÉ — Interface Brand

| PR | Sujet |
|----|-------|
| PR1 | Sécurité baseline (rate-limit, validators, sanitize) |
| PR2 | Brand UI Kit (Surface/Panel/KpiHero/DataTable/StatusBadge/States) |
| PR3 | Dashboard (KPIs + Live Rail realtime + chart 30j) |
| PR4 | Contests list (filters URL + table + 5 API routes) |
| PR5 | Contest detail (5 tabs + moderation) |
| PR6 | Wizard création (5 steps + upload Storage) |
| PR8 | Analytics recharts + sort Radix + tests Playwright |

### ✅ TERMINÉ — Interface Admin (9.1/10)

### ❌ MANQUE / EN COURS

- Routes modération submissions (BUG-01 — vérifier existence)
- Interface créateur complète
- Billing brand (portail Stripe)
- CSRF HMAC-signé (GAP-01)
- Role-guard middleware (GAP-02)
- Wizard → Stripe Checkout obligatoire (GAP-03)
- Migrations DB (GAP-04/05/06)
- `src/lib/motion.ts` dictionnaire springs

---

## 7) BUGS CONNUS

### 🔴 Bloquants

| ID | Fichier | Problème |
|----|---------|---------|
| BUG-01 | `api/brand/submissions/[id]/approve\|reject\|contact` | Fichiers possiblement absents — tab UGC non fonctionnel |
| BUG-02 | `app/brand/contests/loading.tsx` | Double export default lignes 3 et 33 |
| BUG-03 | `step-basics/budget/schedule.tsx` | Labels non associés aux inputs (a11y WCAG) |
| BUG-04 | `brand-ui/BrandTopBar.tsx` | `<img>` natif → LCP dégradé sur toutes les pages |
| BUG-05 | `dashboard-quick-actions.tsx` | Prop `variant` inexistante sur `Card` (erreur TS) |
| BUG-06 | `step-schedule.tsx` | `register` non câblé → inputs date peuvent retourner null |

### 🟡 Importants

| ID | Fichier | Problème |
|----|---------|---------|
| DETTE-03 | — | `src/lib/motion.ts` absent — springs non centralisés |
| DETTE-04 | `transaction-list.tsx` | `<img>` natif ligne 125 |
| DETTE-05 | `submission-actions.tsx` | `contestId` inutilisé — deep-link messages cassé |
| DETTE-06 | `submission-card.tsx` | `isPending` non affiché — double-clic possible |
| DETTE-07 | `contests-table.tsx` | `filters` non consommé |
| DETTE-08 | `tools/*.js` | `require()` CommonJS → lint fail CI |
| DETTE-09 | — | `vitest` non installé |

---

## 8) GAPS CRITIQUES — MASTER BLUEPRINT

### GAP-01 — CSRF HMAC-signé (sécurité haute priorité)

Le blueprint impose OWASP "Signed Double-Submit Cookie" :
- Cookie : `__Host-csrf`
- Header : `x-csrf`
- Token : `sigHex.nonceHex`
- sig = `HMAC_SHA256(CSRF_HMAC_SECRET, uid:${userId}!${nonce})`
- Validation constant-time
- Var env requise : `CSRF_HMAC_SECRET` (32 bytes min)

### GAP-02 — Role-guard middleware

```ts
// À ajouter dans middleware.ts
if (pathname.startsWith('/app/brand') && profile.role !== 'brand') → 403
if (pathname.startsWith('/app/creator') && profile.role !== 'creator') → 403
if (pathname.startsWith('/app/admin') && profile.role !== 'admin') → 403
```

### GAP-03 — Wizard sans paiement Stripe (critique business)

Flux actuel : wizard → POST crée contest → `status: 'active'` sans paiement
Flux cible : wizard → `create_draft_contest_and_payment_intent()` → Stripe Checkout → webhook active + freeze ranking

### GAP-04/05/06 — Migrations DB auditabilité

```sql
-- metrics_daily
ALTER TABLE metrics_daily ADD COLUMN method text NOT NULL DEFAULT 'unknown';
ALTER TABLE metrics_daily ADD COLUMN confidence numeric NOT NULL DEFAULT 0;
ALTER TABLE metrics_daily ADD COLUMN formula_version int NOT NULL DEFAULT 1;
ALTER TABLE metrics_daily ADD COLUMN weights_snapshot jsonb;

-- contests
ALTER TABLE contests ADD COLUMN ranking_formula_version int NOT NULL DEFAULT 1;
ALTER TABLE contests ADD COLUMN ranking_weights_snapshot jsonb DEFAULT '{}';
ALTER TABLE contests ADD COLUMN ranking_frozen_at timestamptz;

-- submissions + contest_winnings
ALTER TABLE submissions ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified';
ALTER TABLE contest_winnings ADD COLUMN eligibility_status text NOT NULL DEFAULT 'needs_verification';
```

### GAP-07 — Stripe Connect onboarding GET → POST

```
api/payments/creator/onboarding/route.ts utilise GET pour créer un compte Connect
→ Migrer en POST + CSRF + rate limit (blueprint interdit les mutations en GET)
```

---

## 9) INTERDITS ABSOLUS

- ❌ `Math.random()` pour tokens → `crypto.randomUUID()`
- ❌ `service_role` Supabase côté brand
- ❌ Inline styles sauf valeurs dynamiques documentées
- ❌ One-off classes CSS → composer `brand-ui/*`
- ❌ `use client` sans justification commentée
- ❌ Waterfalls → `Promise.all`
- ❌ Mutations sans CSRF + rate limit
- ❌ Ownership check absent
- ❌ Plus d'1 Magic UI effect par écran
- ❌ Springs `easeOut` → dictionnaire `src/lib/motion.ts`
- ❌ `any` TypeScript
- ❌ `proxy.ts` sans RFC (un seul point d'entrée = `middleware.ts`)
- ❌ GET pour mutations
- ❌ `metrics_daily` sans `method`/`confidence`/`formula_version`
- ❌ `<img>` natif → `<Image>` next/image
- ❌ Activation contest sans freeze `ranking_weights_snapshot`

---

## 10) COMMANDES UTILES

```bash
npm run dev              # dev Turbopack
npm run build            # build prod
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run format           # prettier
npm run test:e2e         # playwright test
npm run test:e2e:ui      # playwright --ui
npm run audit:csrf
npm run audit:rate-limit
npm run audit:brand-security
```

---

## 11) DEFINITION OF DONE (toute PR)

- [ ] `typecheck` → 0 erreur sur fichiers modifiés
- [ ] `lint` → 0 erreur sur fichiers modifiés
- [ ] Skeleton iso-layout sur chaque section async
- [ ] États empty + error sur chaque liste/table
- [ ] Labels associés aux inputs (`htmlFor` + `id`)
- [ ] Keyboard navigation (Tab + Enter + Escape)
- [ ] Focus visible WCAG AA
- [ ] `prefers-reduced-motion` respecté
- [ ] Pas de `console.error` runtime
- [ ] Zéro CLS
- [ ] `Promise.all` sur fetches parallèles
- [ ] CSRF + rate limit sur toutes routes mutatives
- [ ] Ownership check explicite
- [ ] Mobile responsive
- [ ] Springs du dictionnaire `src/lib/motion.ts`
- [ ] `<Image>` next/image (jamais `<img>`)

---

*Version 2.0 — Mars 2026 — Post PR1-PR8 + Master Blueprint intégré*
*Maintenu par : Lead Engineer Senior ClipRace*