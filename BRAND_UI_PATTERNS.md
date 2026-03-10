# CLIPRACE — BRAND UI PATTERNS (v1.0)
This document defines **how the UI behaves**: layouts, flows, interactions, states, performance, and usage of premium libraries.

---

## 0) Core UX Rules (the “why”)
1) **Clarity in 3 seconds**: user instantly sees current status + next action.
2) **One primary CTA** per screen.
3) **Progressive disclosure**: advanced details behind tabs/drawers.
4) **Trust is in the edges**: loading/error/empty/confirmations must be premium.
5) **Perceived performance > raw performance**: skeleton + streaming + optimistic UI.

---

## 1) Page Layout Standards

### 1.1 Containers
- Desktop container: `max-w-7xl mx-auto px-6`
- Section spacing: `space-y-8`
- Grid standard: 12 columns
  - Primary content: 8 cols
  - Secondary rail: 4 cols (Live feed, context)

### 1.2 Headers
Every page header must include:
- Title + short context line (optional)
- Primary CTA (only one)
- Secondary actions as icon buttons / menu

### 1.3 Navigation
- BrandShell topbar always visible.
- Dock is optional but consistent; active route must be obvious.
- CmdK accessible everywhere (⌘K)

---

## 2) Interaction Patterns (Premium)

### 2.1 Hover / Active / Focus (must be consistent)
- Hoverable surfaces: subtle lift `translateY(-1px)` + border goes from border-1 → border-2
- Transitions: 120–180ms, easing from spec.
- Focus: visible ring with Race Light (emerald edge)

### 2.2 “Finance-grade confirmations”
Destructive actions (close contest, reject submission, payout actions) must:
- Open ActionDialog
- Explain consequences in one sentence
- Require explicit confirm

### 2.3 Toasts
Use sonner only:
- Success: short, factual
- Error: actionable (what to do next)
- Never spam toasts for background refreshes

---

## 3) Loading / Empty / Error (Trust-critical)

### 3.1 Loading
- Use skeletons that match final layout (no random blocks).
- Preserve layout sizes to avoid CLS.
- Prefer streaming: header first, then panels.

### 3.2 Empty States
Every empty state must have:
- Title
- 1-line explanation
- Primary CTA
- Optional Track Pattern background (subtle)

Examples:
- No contests → “Create your first campaign”
- No submissions → “Promote your contest to get creators”

### 3.3 Error States
Errors must be actionable:
- What failed (short)
- Retry action or next step
- If permission issue → show “Access denied” with guidance

---

## 4) Data Display Patterns

### 4.1 Numbers & KPIs
- Always `tabular-nums`.
- Use `@number-flow/react` for changes (client component wrapper).
- Avoid too many animated numbers at once (only key KPIs).

### 4.2 Tables (DataTable)
- Right-align numeric columns.
- Provide row actions in a menu.
- For large sets:
  - paginate server-side or infinite load
  - consider virtualization only if needed

### 4.3 Status System
All statuses must be visual + textual:
- Badge with dot + label
- Colors: success/warning/danger/neutral (subtle backgrounds)

---

## 5) Realtime Pattern (Supabase Realtime)
Use realtime only where it increases value:
- live submissions count
- live rail feed
- moderation updates

Guidelines:
- Realtime client component subscribes to minimal channels.
- Update UI optimistically but reconcile with server state.
- Do not rely on columns that do not exist: validate schema.

---

## 6) Charts (recharts)
Rules:
- Charts are client components only.
- Minimal chrome: subtle axes or none, depending on context.
- Provide fallback state:
  - “No data yet” message inside panel
- Never block first paint on chart; show skeleton first.

---

## 7) Motion & “Organic Feel”

### 7.1 framer-motion
Use only for:
- Dock elastic animations
- Page transitions (lightweight)
- Micro-interactions (rare)
Rules:
- Do not import framer-motion in global layout if avoidable.
- Respect `prefers-reduced-motion` by disabling heavy animations.

### 7.2 lenis
Use for:
- Long pages where smooth scroll improves feel (analytics, feeds).
Rules:
- Do not apply on every page by default.
- Ensure accessibility (reduced motion) and avoid scroll locking bugs.

### 7.3 cobe (Map Orb)
Use as a brand signature element:
- Dashboard / overview panel only
- Must not impact performance; lazy-load.
- Provide static fallback when reduced motion or low power.

---

## 8) Command Menu (cmdk)
CmdK must include:
- Search contests by name
- Jump to: Dashboard, Contests, UGC, Messages, Billing
- Action: Create contest
- Recent items: last opened contest

Rules:
- Must be keyboard-first, accessible.
- Should be fast: prefetch minimal data or recent items only.

---

## 9) Mobile Patterns (vaul)
Use drawers for:
- filters
- contest preview
- submission review details

Rules:
- Drawer has clear title and close button
- Supports swipe-to-close
- Keyboard focus handling

---

## 10) Performance Rules (hard)
- Parallel fetches with `Promise.all`.
- Prefer RPC/views for aggregates.
- Avoid `.in([...])` with big lists.
- No unnecessary re-renders:
  - use react-scan in dev to detect issues
  - memoize only when necessary (don’t over-optimize)

---

## 11) Page-by-Page “Golden Paths” (minimum)
### Dashboard
- Loads fast, shows KPIs, live rail updates.

### Contests List
- Search/filter, open contest detail, duplicate, edit.

### Contest Detail
- Tabs: Overview, UGC, Leaderboard, Analytics, Settings.

### Moderation
- Review submission, approve/reject with reason.

### Messages
- Deep-link from moderation selects correct thread.

### Billing
- Open Stripe portal; view invoices.

---

## 12) Definition of Done (DoD) for every brand page
- Uses BrandShell + brand-ui components
- Primary CTA is obvious
- Skeleton/Empty/Error states exist and look premium
- A11y keyboard + focus is correct
- No console errors
- No CLS
- Data fetch is parallelized where possible
- Works on mobile (drawer patterns if needed)
