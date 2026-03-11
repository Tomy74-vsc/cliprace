# CLAUDE.md — ClipRace Project Intelligence
> Tu es l'agent d'exécution **Cursor / Claude Code (Opus 4.6)** du projet ClipRace.
> Ce fichier est ton **contexte absolu**. Lis-le entièrement avant chaque session.
> Lead Architect / Orchestrateur : rôle Lead Engineer Senior (spécifications et review).

---

## 0) PROJET EN UN PARAGRAPHE

ClipRace est une plateforme SaaS **B2B/B2C** qui connecte des **marques** (brands) et des **créateurs UGC** via des concours vidéo monétisés. Les marques créent des contests avec budget/prize pool, les créateurs soumettent des vidéos, un leaderboard classe les performances, et les paiements sont distribués via Stripe Connect. Il y a trois rôles : `brand`, `creator`, `admin`.

---

## 1) STACK — NON NÉGOCIABLE

```
Runtime      : Next.js 16 App Router + React 19 + TypeScript strict
Build        : Turbopack (dev) / standard Next build (prod)
Styling      : Tailwind v4 + CSS variables (tokens brand) + tailwind-merge + cva
UI primitives: shadcn/ui + Radix UI
Animation    : framer-motion (islands uniquement) + lenis (pages longues)
Data viz     : recharts (client islands)
Premium libs : @number-flow/react · sonner · cmdk · vaul · cobe · @rive-app/react-canvas
Backend      : Supabase (Auth / RLS / Storage / RPC / Realtime)
Payments     : Stripe (Checkout + Connect Standard)
Forms        : react-hook-form + zod
Tables       : @tanstack/react-table
i18n         : next-intl
State        : zustand (client global) — pas de Redux
Dev tools    : react-scan (perf) · ESLint · Prettier · Vitest · Playwright
```

**Versions exactes dans `package.json` — ne jamais les changer sans instruction.**

---

## 2) ARCHITECTURE FICHIERS

```
src/
├── app/
│   ├── (auth)/               # Login, register, reset
│   ├── (brand)/              # Interface marque ← CHANTIER PRINCIPAL
│   │   ├── dashboard/
│   │   ├── contests/
│   │   │   ├── [id]/
│   │   │   └── new/          # Wizard création
│   │   ├── messages/
│   │   ├── billing/
│   │   └── settings/
│   ├── (creator)/            # Interface créateur
│   ├── (admin)/              # Interface admin ← TERMINÉE (9.1/10)
│   └── api/
│       ├── admin/            # Routes admin — toutes protégées CSRF+RLS
│       ├── brand/            # Routes brand — en cours de sécurisation
│       └── webhooks/         # Stripe webhooks
├── components/
│   ├── brand-ui/             # ← KIT UI BRAND (à construire en PR2)
│   │   ├── BrandShell.tsx
│   │   ├── Surface.tsx
│   │   ├── Panel.tsx
│   │   ├── Card.tsx
│   │   ├── KpiHero.tsx
│   │   ├── Kpi.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── DataTable.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   ├── ActionDialog.tsx
│   │   └── index.ts
│   ├── admin/                # Composants admin (terminés)
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── csrf.ts               # assertCsrf() — obligatoire sur toutes mutations brand
│   ├── supabase/
│   │   ├── server.ts         # createServerClient()
│   │   └── client.ts         # createBrowserClient()
│   ├── stripe.ts
│   ├── admin/
│   │   ├── rate-limit.ts     # enforceAdminRateLimit() — pattern à reproduire côté brand
│   │   ├── audit.ts          # logAdminAction() — pattern à reproduire côté brand
│   │   ├── validators.ts
│   │   └── sanitize.ts
│   └── brand/                # ← À créer en PR1
│       ├── rate-limit.ts
│       ├── validators.ts
│       └── sanitize.ts
├── hooks/                    # Client hooks (useOptimisticMutation, etc.)
├── types/                    # Types TS globaux
└── middleware.ts             # Auth + CSRF edge
```

---

## 3) DESIGN SYSTEM — RÈGLES ABSOLUES

### 3.1 Identité visuelle ClipRace (DOIT être visible)

**Signature 1 — Race Light** (emerald edge)
- Usage : live dot, focus rings, highlights sur surfaces premium
- Couleur : `--accent: #10B981`
- Règle : < 10% de la surface écran, jamais de floods néon

**Signature 2 — Track Pattern** (texture subtile 2-4% opacité)
- Usage : headers, panels overview, empty states
- Règle : quelques panels seulement (pas partout)

**Signature 3 — Clip Notch** (cut corner)
- Usage : KPI Hero, panels premium (1-2 max par écran)

### 3.2 Tokens CSS (obligatoires)

```css
/* Backgrounds */
--bg-void: #050505;        /* Depth 0 — fond absolu */
--surface-1: #0A0F14;      /* Depth 1 — cards/panels */
--surface-2: #101721;      /* Depth 2 — hover/active */
--surface-3: #141C28;      /* Depth 3 — overlays internes */

/* Text */
--text-1: rgba(255,255,255,0.92);   /* primary */
--text-2: rgba(255,255,255,0.66);   /* secondary */
--text-3: rgba(255,255,255,0.44);   /* tertiary */

/* Borders */
--border-1: rgba(255,255,255,0.06); /* subtle */
--border-2: rgba(255,255,255,0.10); /* defined */

/* Accent */
--accent: #10B981;
--accent-soft: rgba(16,185,129,0.12);
--accent-edge: rgba(16,185,129,0.18);

/* Status */
--success: #10B981;
--warning: #F59E0B;
--danger:  #EF4444;

/* CTA (Uber-style) */
--cta-bg: #FFFFFF;
--cta-fg: #0A0D10;

/* Radius */
--r2: 12px;   /* buttons/inputs */
--r3: 16px;   /* cards */
--r4: 24px;   /* panels */
--r-pill: 999px; /* badges */

/* Shadows */
--shadow-1: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 20px rgba(0,0,0,0.45);
--shadow-2: 0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px rgba(0,0,0,0.55);
```

### 3.3 Typographie

- Font: Inter/Geist (sans) via `var(--font-sans)`
- KPIs : `tabular-nums` OBLIGATOIRE
- Display KPI : 48-64px, weight 600, tracking -0.03em
- H1 : 26-28px, weight 600
- Body : 14-16px, weight 400/500
- Labels : 12px, weight 500

### 3.4 Motion

```ts
// Springs Framer Motion
const springVif = { type: "spring", stiffness: 300, damping: 30 }   // actions, hovers
const springDoux = { type: "spring", stiffness: 150, damping: 20 }  // panels, reveals

// CSS natif (préféré quand possible)
// duration fast: 120ms | normal: 180ms
// easing: cubic-bezier(0.2, 0.8, 0.2, 1)

// TOUJOURS vérifier
@media (prefers-reduced-motion: reduce) { ... }
```

---

## 4) RÈGLES DE CODE — NON NÉGOCIABLES

### 4.1 Server vs Client

```ts
// ✅ Server Component par défaut — pas de 'use client' sauf si nécessaire
// Client uniquement pour : realtime · charts · motion · cmdk · lenis · number-flow · vaul · rive

// ✅ Parallel fetches obligatoires (no waterfalls)
const [contests, stats] = await Promise.all([
  fetchContests(brandId),
  fetchBrandStats(brandId),
])

// ❌ JAMAIS
const contests = await fetchContests(brandId)
const stats = await fetchBrandStats(brandId) // waterfall!
```

### 4.2 Sécurité (CRITIQUE)

```ts
// Toute route API mutative (POST/PATCH/DELETE) DOIT avoir :
import { assertCsrf } from '@/lib/csrf'
import { enforceBrandRateLimit } from '@/lib/brand/rate-limit'  // à créer en PR1

export async function POST(req: Request) {
  await assertCsrf(req)                    // 1. CSRF check
  await enforceBrandRateLimit(req, userId) // 2. Rate limit
  // ... ownership check via RLS
  // ... zod validation
  // ... action
}

// RLS : TOUJOURS utiliser createServerClient() avec la session user
// JAMAIS le service_role key côté brand (admin seulement si justifié)
```

### 4.3 CSS

```ts
// ✅ Toujours cn() pour merge classes
import { cn } from '@/lib/utils'

// ✅ CSS scope brand-ui
// Tous les composants brand-ui ont la classe .brand-scope sur leur root

// ❌ Jamais de styles inline sauf valeurs dynamiques documentées
// ❌ Jamais de one-off styles dans les pages — composer brand-ui/*
```

### 4.4 Composants

```ts
// ✅ Variants avec cva
import { cva, type VariantProps } from 'class-variance-authority'

// ✅ TypeScript strict — pas de `any`
// ✅ Props documentées (JSDoc sur composants publics brand-ui)
// ✅ forwardRef sur tous les composants qui wrappent des éléments HTML
```

### 4.5 Skeletons

```ts
// Tout skeleton DOIT avoir les mêmes dimensions que le contenu final
// → Zéro CLS (Cumulative Layout Shift)
// Un fichier loading.tsx par route brand importante
```

---

## 5) SÉCURITÉ — CHECKLIST PAR ROUTE API BRAND

Chaque route `src/app/api/brand/...` DOIT avoir :

- [ ] `assertCsrf(req)` — import depuis `@/lib/csrf`
- [ ] `enforceBrandRateLimit(req, userId)` — import depuis `@/lib/brand/rate-limit`
- [ ] Ownership check via RLS (Supabase server client avec session)
- [ ] Validation input Zod avant toute logique
- [ ] Sanitization des strings libres
- [ ] Audit log pour actions critiques (paiement, publication, suppression)

**Routes déjà sécurisées (admin) — pattern de référence :**
- `src/lib/csrf.ts` → `assertCsrf()`
- `src/lib/admin/rate-limit.ts` → `enforceAdminRateLimit()` ← COPIER ce pattern pour brand

---

## 6) BASE DE DONNÉES — SCHÉMA CLÉS

### Tables principales
```sql
profiles          -- users (role: 'brand' | 'creator' | 'admin')
contests          -- concours (brand_id FK, status: draft|active|paused|ended|archived)
submissions       -- vidéos créateurs (contest_id FK, creator_id FK)
metrics_daily     -- vues/likes/comments/shares par submission
leaderboard       -- classement (view matérialisée)
contest_winnings  -- palmarès et paiements
payments_brand    -- paiements marque → plateforme
cashouts          -- demandes de paiement créateurs
messages          -- messagerie brand↔creator
message_threads   -- threads de conversation
notifications     -- notifications in-app
orgs              -- organisations multi-membres côté brand
org_members       -- membres d'org avec rôles
assets            -- métadonnées fichiers Storage
```

### Fonctions RPC utiles
```sql
get_contest_metrics(p_contest_id uuid)     -- métriques agrégées d'un concours
get_contest_leaderboard(p_contest_id, p_limit) -- classement top N
refresh_analytics_views()                  -- refresh toutes les vues matérialisées
```

### Vues matérialisées
```sql
brand_dashboard_summary    -- stats par marque (actifs/terminés/budgets/vues)
creator_dashboard_summary  -- stats par créateur
platform_stats_summary     -- stats globales
```

### Pattern Supabase server-side
```ts
import { createServerClient } from '@/lib/supabase/server'

// Dans un Server Component ou Route Handler :
const supabase = await createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

// Toujours passer par RLS — ne pas bypasser avec service_role côté brand
```

---

## 7) ÉTAT D'AVANCEMENT

### ✅ TERMINÉ
- **Interface Admin** : 9.1/10 — CSRF ✅ · Rate limit ✅ · Audit logs ✅ · Bulk actions ✅ · Skeletons ✅ · WCAG AA ✅
- **Schema BDD** : complet et stable (BASELINE.sql)
- **Stripe webhooks** : implémentés

### 🚧 EN COURS — Interface Brand (priorité)
```
PR1  Sécurité baseline brand (CSRF + rate-limit + math.random)    ← PROCHAIN
PR2  Brand UI Kit v1 (composants fondation)
PR3  Dashboard brand refactor
PR4  Contests List refactor
PR5  Contest Detail (Tabs: Overview/UGC/Leaderboard/Analytics/Settings)
PR6  Wizard création contest (upload réel Supabase Storage)
PR7  Messages + deep-link modération→messages
PR8  Perf pass + tests E2E Playwright
```

### ❌ MANQUE (post-brand)
- Tests automatisés (Vitest unitaires + Playwright E2E)
- Cache Redis (prod)
- Analytics graphiques avancés (recharts installé, non utilisé)

---

## 8) PATTERNS DE RÉFÉRENCE

### Fetch avec parallel + error boundary
```ts
// app/(brand)/dashboard/page.tsx
export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  try {
    const [{ data: stats }, { data: contests }] = await Promise.all([
      supabase.rpc('get_brand_dashboard_summary', { p_brand_id: user.id }),
      supabase.from('contests').select('*').eq('brand_id', user.id).limit(5),
    ])
    return <DashboardView stats={stats} contests={contests} />
  } catch {
    return <ErrorState retry="/dashboard" />
  }
}
```

### Route API mutative brand (pattern PR1)
```ts
// app/api/brand/contests/[id]/publish/route.ts
import { assertCsrf } from '@/lib/csrf'
import { enforceBrandRateLimit } from '@/lib/brand/rate-limit'
import { createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await assertCsrf(req)

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await enforceBrandRateLimit(req, user.id)

  // Ownership via RLS automatique (supabase utilise la session)
  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, brand_id, status')
    .eq('id', params.id)
    .single()

  if (error || !contest) return Response.json({ error: 'Not found' }, { status: 404 })
  if (contest.brand_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (contest.status !== 'draft') return Response.json({ error: 'Cannot publish' }, { status: 422 })

  const { error: updateError } = await supabase
    .from('contests')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) return Response.json({ error: 'Update failed' }, { status: 500 })

  return Response.json({ success: true })
}
```

### Composant brand-ui (pattern PR2)
```tsx
// src/components/brand-ui/Surface.tsx
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const surfaceVariants = cva(
  'brand-scope rounded-[var(--r3)] border transition-all duration-[180ms]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-1)] border-[var(--border-1)] shadow-[var(--shadow-1)]',
        hoverable: 'bg-[var(--surface-1)] border-[var(--border-1)] hover:border-[var(--border-2)] hover:-translate-y-px cursor-pointer',
        track: 'bg-[var(--surface-1)] border-[var(--border-1)] [background-image:url(/track-pattern.svg)] [background-size:400px]',
        notched: 'bg-[var(--surface-1)] border-[var(--border-1)] [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof surfaceVariants> {}

export function Surface({ className, variant, ...props }: SurfaceProps) {
  return <div className={cn(surfaceVariants({ variant }), className)} {...props} />
}
```

---

## 9) COMMANDES UTILES

```bash
npm run dev          # dev avec Turbopack
npm run build        # build prod
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
npm run audit:csrf         # vérifie couverture CSRF
npm run audit:rate-limit   # vérifie couverture rate limit
npm run audit:audit-logs   # vérifie couverture audit logs
```

---

## 10) INTERDITS ABSOLUS

- ❌ `Math.random()` pour tokens de sécurité → utiliser `crypto.randomUUID()` ou `crypto.getRandomValues()`
- ❌ `service_role` Supabase côté brand (admin seulement, et justifié)
- ❌ Inline styles sauf valeurs dynamiques documentées
- ❌ One-off classes CSS dans les pages → toujours composer `brand-ui/*`
- ❌ `use client` sans justification commentée
- ❌ Waterfalls de fetch (toujours `Promise.all`)
- ❌ Requêtes sans ownership check (RLS doit couvrir)
- ❌ Mutations sans CSRF + rate limit
- ❌ Composants sans état loading/empty/error
- ❌ Plus d'1 Magic UI effect par écran
- ❌ Glow/néon partout (emerald < 10% écran)
- ❌ `any` TypeScript
- ❌ localStorage/sessionStorage dans les artifacts

---

## 11) CONVENTIONS DE NOMMAGE

```
Fichiers         : kebab-case (brand-shell.tsx, use-contests.ts)
Composants       : PascalCase (BrandShell, KpiHero)
Hooks            : camelCase avec use- prefix (useContests, useOptimisticMutation)
API routes       : REST-like (/api/brand/contests/[id]/publish)
Types            : PascalCase avec suffix (ContestRow, BrandStats, ApiResponse<T>)
CSS vars         : --kebab-case (--bg-void, --accent-soft)
Zod schemas      : camelCase avec Schema suffix (publishContestSchema)
```

---

## 12) DEFINITION OF DONE (toute PR)

- [ ] TypeScript compile sans erreur (`npm run typecheck`)
- [ ] ESLint passe (`npm run lint`)
- [ ] Skeleton sur chaque page/section asynchrone
- [ ] États empty + error sur chaque liste/table
- [ ] Keyboard navigation fonctionnelle
- [ ] Focus visible (WCAG AA)
- [ ] `prefers-reduced-motion` respecté pour toute animation
- [ ] Pas de `console.error` en runtime
- [ ] Pas de CLS (skeletons dimensionnés)
- [ ] Fetches parallélisés
- [ ] CSRF + rate limit sur toute route mutative
- [ ] RLS coverage (pas de data leak cross-brand)
- [ ] Mobile responsive (drawer patterns si nécessaire)

---

*Dernière mise à jour : Mars 2026 — Version 1.0*
*Maintenu par : Lead Engineer Senior ClipRace*