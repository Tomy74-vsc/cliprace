# BRAND_WORKFLOWS.md — ClipRace Brand Refactor Playbook (v1.0)

> **But**: Refondre **tout le frontend de l’interface marque** en mode **prod-grade**, sans casser le backend (Stripe/Supabase/RLS/CSRF/RPC/Realtime), avec une identité visuelle **ClipRace** (Race Light / Track Pattern / Clip Notch) et une qualité UX niveau **Apple/Uber/Revolut**.

**Références finish**: Apple, Uber, Revolut  
**Références dynamiques**: Netflix, TikTok (uniquement quand ça sert l’usage)  
**Stack verrouillée**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + Radix + Supabase + Stripe  
**Secret sauce**: framer-motion, lenis, cobe, @number-flow/react, sonner, cmdk, vaul, cva

---

## 0) Documents de référence (Source of Truth)
- **BRAND_UI_SPEC.md**: tokens + composants + identité (Race Light / Track / Notch)
- **BRAND_UI_PATTERNS.md**: layouts + interactions + états (loading/empty/error) + perf + a11y
- **Audit (dernier)**: liste P0/P1/P2 (edit/duplicate/realtime/RPC mismatch/messages authz/perf JS aggregations)

> **Règle**: toute UI brand doit être composée via `src/components/brand-ui/*` et respecter la constitution.

---

## 1) Objectifs non négociables (Quality Bar)
### 1.1 Trust & Simplicité
- 1 **CTA principal** par écran
- Actions sensibles → **ActionDialog** “finance-grade”
- Erreurs **actionnables** (pas de “Something went wrong”)

### 1.2 Performance & Fluidité
- **Server Components** par défaut
- **Client components** uniquement pour: realtime, charts, cmdk, framer-motion, lenis, number-flow, vaul
- **No waterfalls**: `Promise.all`
- **No CLS**: skeletons matchant la mise en page finale
- Réduire le bundle: pas d’import global framer-motion/lenis si évitable
- `prefers-reduced-motion` respecté

### 1.3 Sécurité & Intégrité
- CSRF crypto fort (jamais Math.random)
- Messages: authz stricte (brand owns contest + creator lié)
- Rate limit: userId + ip + ua, anti-spoof headers
- Stripe saga + webhook idempotence non régressifs
- RLS strict inchangé

---

## 2) Structure de travail (Comment on livre)
### 2.1 Règle PR
- **1 PR = 1 objectif** (ex: PR2 “Brand UI Kit”)
- Pas de refactor massif sans raison
- Chaque PR a:
  - Plan (5–10 bullets)
  - Diff clair
  - Checklist (a11y/perf/security)
  - Steps de test manuel

### 2.2 Workflow standard (à répéter)
1) **Scan repo** (ne jamais inventer routes/colonnes/RPC)
2) **Plan**
3) Implémentation
4) **Self-review** (checklists)
5) Tests (si critique)
6) Merge

---

## 3) Commands Cursor recommandées (workflows)
> Préfixe: `/`

### Fix & Stabilisation
- `/brand_p0_fix` — corriger les bloquants audit (edit/duplicate/realtime/RPC mismatch/messages authz)
- `/brand_security` — CSRF crypto + rate-limit + cohérence export/admin

### UI System
- `/brand_ui_kit` — tokens + `src/components/brand-ui/*` (Surface/Panel/Card/Kpi/States/Dialogs)
- `/brand_release_check` — audit final avant merge (a11y/perf/security/UX)

### Pages (refonte progressive)
- `/brand_refactor_dashboard`
- `/brand_refactor_contests_list`
- `/brand_refactor_contest_detail`
- `/brand_upload_real`
- `/brand_messages_deeplink`

---

## 4) Roadmap PR (ordre de merge)
> **Important**: on fixe P0 avant la refonte visuelle pour éviter de designer sur du cassé.

### PR0 — Stabilisation P0 (BLOQUANTS)
**Objectif**: rendre les parcours brand “fonctionnels sans trous”.
- Fix lien **Edit** cassé (créer route ou retirer CTA)
- Implémenter **Duplicate** (searchParams + préfill wizard ou server action duplication)
- Fix **Realtime pending submissions** (pas de `submissions.brand_id` → join/RPC)
- Aligner **RPC create contest** vs DB (migrations ou code)
- Sécuriser création de thread messages (authz contest↔brand↔creator)

**Definition of Done**
- Aucun lien cassé dans brand
- Duplicate crée un draft réel
- Pending realtime fonctionne via une stratégie valide
- RPC mismatch éliminé
- Messages: 403 si non autorisé + test minimal

---

### PR1 — Sécurité durcie (P0/P1)
**Objectif**: “bank-grade” sans ambiguïté.
- CSRF tokens **crypto strong**
- Rate limit messages: (userId + ip + ua), anti-spoof
- Export: admin/ownership cohérent sur toute la route

**Definition of Done**
- Plus aucun fallback Math.random
- Rate limit robuste et documenté
- Autorisations export cohérentes

---

### PR2 — Brand UI Kit v1 (fondation)
**Objectif**: créer la “Constitution exécutable” : tokens + briques.
- `src/components/brand-ui/*`:
  - BrandShell
  - Surface / Panel / Card (variants: hoverable, track, notched)
  - KpiHero / Kpi (NumberFlow wrapper)
  - StatusBadge
  - DataTable (finance)
  - Skeleton, EmptyState, ErrorState
  - ActionDialog
  - Toast/Banner (sonner)
  - CmdK (cmdk)
  - MobileDrawer wrappers (vaul)

**Definition of Done**
- Aucune page brand ne dépend de styles “one-off” nouveaux
- Les composants ont: hover/focus/disabled + a11y
- `prefers-reduced-motion` supporté pour motion lourde
- Identité ClipRace visible (Race Light + Track + Notch)

---

### PR3 — Refactor Dashboard (page pilote)
**Objectif**: cockpit premium “trust + live”.
- KPI Hero dominant (vues)
- KPI strip (budget/ROI/CPV/pending)
- Panel chart (recharts)
- Live rail realtime (submissions)
- Skeleton/empty/error premium (no CLS)

**Definition of Done**
- 1 CTA principal
- Realtime stable
- Perceived perf excellente (skeleton)
- Zéro régression fetch (Promise.all, RPC)

---

### PR4 — Refactor Contests List
**Objectif**: opérationnel type Uber.
- Search + filtres + table finance-grade
- Actions menu (view/edit/duplicate/close) + confirmations
- Drawer preview (vaul sur mobile)

**Definition of Done**
- Navigation rapide
- Actions safe
- Pas de grosses agrégations JS inutiles (RPC si besoin)

---

### PR5 — Refactor Contest Detail (Tabs)
**Objectif**: hub campagne.
- Tabs: Overview / UGC / Leaderboard / Analytics / Settings
- Overview: KPIs + chart + budget
- UGC: modération + deep-link messages (préparation)
- Leaderboard: propre + export

**Definition of Done**
- Tabs accessibles
- Parallel fetch
- States premium

---

### PR6 — Wizard polish + Upload réel
**Objectif**: créer concours sans “fake”.
- Remplacer upload simulé par Supabase Storage
- Progress UI + validations (zod)
- Fix double toggle plateformes

**Definition of Done**
- Upload fonctionne et stocke URL
- Wizard “Apple-like”: review + validation inline

---

### PR7 — Messages + Deep-link complet
**Objectif**: communication pro, anti-spam.
- Depuis modération: “Contacter créateur” ouvre messages avec thread sélectionné/créé
- Thread création authz stricte + rate-limit

**Definition of Done**
- Deep-link fonctionne
- 403 si non autorisé
- UX inbox premium (states)

---

### PR8 — Perf pass + Cleanup (P2)
**Objectif**: scaler.
- Remplacer agrégations JS par RPC/views (dashboard/list/detail)
- Rate limit atomique en SQL (si besoin)
- Scope framer-motion/lenis (bundle)
- Ajout/renforcement tests Playwright

**Definition of Done**
- Moins de requêtes et moins de data transfer
- Bundle maîtrisé
- Tests smoke E2E stables

---

## 5) Checklists “toujours”
### 5.1 Checklist UX (Apple/Uber/Revolut)
- Le but de la page est clair en 3 secondes
- 1 CTA principal visible
- Hiérarchie typographique propre (titres vs labels vs data)
- Whitespace cohérent
- États loading/empty/error premium
- Copywriting court et pro

### 5.2 Checklist A11y
- Tab navigation OK
- Focus visible
- Aria-label sur icon buttons
- Contrast OK (AA)
- Dialog/Drawer trap focus + escape

### 5.3 Checklist Perf
- Pas de waterfalls
- Skeleton = layout final (no CLS)
- Client components isolés (charts/realtime/motion)
- `prefers-reduced-motion` respecté
- Pas de re-renders inutiles (react-scan en dev)

### 5.4 Checklist Sécurité
- CSRF crypto, présent sur mutations
- RLS non contournée
- Authz messages contest↔brand↔creator
- Rate limit robuste
- Stripe idempotence intacte

---

## 6) Guidelines d’intégration des libs “Premium”
### framer-motion
- Dock + micro transitions uniquement
- Pas importé globalement si possible
- Respect reduced-motion

### lenis
- Activé uniquement sur pages longues (analytics/feed)
- Désactivé si reduced-motion

### number-flow
- Seulement sur KPIs critiques (pas 20 compteurs)
- Wrapper client-only

### sonner
- Toasts pour actions utilisateur (create/update/fail)
- Pas pour rafraîchissements automatiques

### cmdk
- Accessible partout (⌘K)
- Actions: search contests, create contest, go-to pages, open billing portal

### vaul
- Drawer sur mobile: preview contest/submission, filtres

### cobe
- Dashboard/overview uniquement
- Lazy-load + fallback low power/reduced-motion

---

## 7) “Golden Paths” (tests manuels minimum)
1) Brand login → Dashboard load (KPI + rail)
2) Contests list → open contest detail
3) Duplicate contest → draft created
4) Open UGC moderation → approve/reject
5) Contact creator → messages deep-link thread selected
6) Billing → open Stripe portal

---

## 8) Definition of Done (global refactor)
- Toutes les pages brand utilisent BrandShell + brand-ui kit
- Aucune page brand en “TODO/placeholder”
- A11y + reduced motion OK
- P0 audit résolus
- Perf perçue premium (skeleton, no CLS)
- Tests smoke E2E passent
