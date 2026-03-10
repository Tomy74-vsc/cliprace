# CLIPRACE — BRAND UI SPEC (v1.1)
**North Star:** “Finance-grade trust” + “Live campaign energy”  
**References (finish level):** Apple / Uber / Revolut  
**References (dynamic patterns):** Netflix / TikTok (only where useful)  
**Theme:** Ink Dark (void #050505, surfaces #121212+) + subtle emerald. **Contrast:** WCAG AA (text #F4F4F5, borders 10–15% white). “Race Light”  
**Design Trinity:** shadcn/ui (foundation) + Magic UI / Origin UI (polish) + Rive (micro-interactions)  
**Constraint:** Simple. Fast. Accessible. No gimmicks. “Wow” must increase trust, not noise.

---

## 0) Non-negotiables
- **A11y WCAG AA**: focus visible, keyboard navigation, aria labels, contrast, dialog focus trap.
- **No CLS**: skeletons match final layout, reserve chart/table heights.
- **No waterfalls**: parallel fetches with `Promise.all`.
- **Server Components by default**; client only for realtime/charts/motion/cmdk/lenis/number-flow/vaul/rive.
- **No one-off UI** in pages; compose `src/components/brand-ui/*`.
- **No inline styles**, except rare dynamic values (document why).
- **Effect budget**: max **1 Magic UI “wow effect” per screen** + **1 Rive micro-interaction** (optional). Everything else stays minimal.

---

## 1) ClipRace Visual Identity (must be visible)
### 1.1 Signature 1 — Race Light (emerald edge light)
Used for:
- “Live” indicator dot
- focus rings
- subtle highlights on premium surfaces

Rules:
- Subtle only (edge/border/outline glow).
- Emerald visible area must remain **< 10%** of the screen.
- Never use neon floods; only thin edges, dots, small highlights.

### 1.2 Signature 2 — Track Pattern (subtle texture)
A faint “track-line” pattern (2–4% opacity) used on:
- headers
- select panels (overview/analytics)
- empty states/onboarding hints

Rules:
- Only on **some** panels to keep it special.
- Must not reduce readability (no text over busy pattern).

### 1.3 Signature 3 — Clip Notch (cut corner)
A minimal cut-corner (notch) on premium surfaces:
- KPI Hero panel
- key “overview” panels
- special callouts

Rules:
- Not everywhere. Only on 1–2 premium surfaces per screen.

---

## 2) Design Tokens (Tailwind v4 + CSS variables)
> Canon “Ink Void” background remains **#050505**, surfaces must be #121212+ for WCAG AA. No grey-on-grey.

### 2.1 Color System
**Background**
- `--bg-void`: `#050505` (Depth 0)
- `--bg-ink`: `#0a0a0a` (Depth 0.5 optional)
- `--surface-1`: `#121212` (Depth 1 — minimum for readability)
- `--surface-2`: `#1a1a1a` (Depth 2 hover/active)
- `--surface-3`: `#242424` (Depth 3 overlays inside panels)

**Text (WCAG AA on dark)**
- `--text-1`: `#F4F4F5` (primary)
- `--text-2`: `rgba(255,255,255,0.72)` (secondary)
- `--text-3`: `rgba(255,255,255,0.52)` (tertiary)

**Borders (visible in daylight)**
- `--border-1`: `rgba(255,255,255,0.10)` (subtle)
- `--border-2`: `rgba(255,255,255,0.15)` (defined)

**Accent**
- `--accent`: `#10B981` (emerald Race Light)
- `--accent-soft`: `rgba(16,185,129,0.12)`
- `--accent-edge`: `rgba(16,185,129,0.18)`

**Status**
- `--success`: `#10B981`
- `--warning`: `#F59E0B`
- `--danger`:  `#EF4444`

**CTA (Uber-like)**
- Primary CTA: **white background** + dark text
  - `--cta-bg`: `#FFFFFF`
  - `--cta-fg`: `#0A0D10`

### 2.2 Typography
- Font: Inter/Geist (sans)
- Numbers: `tabular-nums` mandatory for KPIs and tables.
- Scale:
  - Display KPI: 48–64, weight 600, tracking -0.03em
  - H1: 26–28, weight 600
  - H2: 18–20, weight 600
  - Body: 14–16, weight 400/500
  - Label: 12, weight 500 (uppercase optional, tracking-wide)

### 2.3 Radius / Spacing / Shadows
**Radius**
- `--r2`: 12px (buttons/inputs)
- `--r3`: 16px (cards)
- `--r4`: 24px (panels)
- `--r-pill`: 999px (badges)

**Spacing scale**
4 / 8 / 12 / 16 / 24 / 32 / 48

**Shadows (premium, subtle)**
- `--shadow-1`: `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 20px rgba(0,0,0,0.45)`
- `--shadow-2`: `0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 50px rgba(0,0,0,0.55)`

### 2.4 Motion
- Duration fast: 120ms
- Duration normal: 180ms
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Must respect `prefers-reduced-motion`.

---

## 3) Design Trinity (Foundation + Polish + Micro-interactions)
> The goal: **craft** (Apple/Uber/Revolut), not “effects everywhere”.

### 3.1 Foundation: shadcn/ui + Radix (mandatory)
- All primitives must be shadcn/Radix-based for accessibility:
  - Dialog, DropdownMenu, Tabs, Popover, Tooltip, ScrollArea, Accordion, NavigationMenu, etc.
- Styling is overridden to match Ink tokens (no default theme drift).

### 3.2 Polish: Origin UI patterns (interaction feel)
Use Origin UI-inspired interaction patterns for:
- Forms (label, help text, inline validation, spacing)
- Lists (dense but readable), menus, command palette UX
- Dialog hierarchy (title → description → actions)
- Subtle motion feedback with framer-motion springs

Rules:
- Origin UI is inspiration for patterns, not copy/paste.
- All spacing/typography must follow our tokens and component kit.

### 3.3 Wow: Magic UI effects (controlled, max 1 per screen)
Allowed effects (sparingly):
- **Border Beam**: only for **KPI Hero** or **one premium panel** per screen.
- **Subtle Particles**: only in onboarding/empty states; opacity <= 4%.
- **Text Gradient**: generally discouraged; allowed only for tiny highlights and must stay within Ink + neutral + emerald.

Rules:
- Max **1 Magic UI effect per screen**.
- No rainbow gradients. No multicolor neon.
- Effects must use our CSS vars (`--accent`, `--border-*`, surfaces) and stay subtle.

### 3.4 Micro-interactions: Rive (@rive-app/react-canvas)
Use Rive for:
- **Loaders** (replace generic spinners) on key panels (dashboard metrics, export generation)
- **Success check** after critical actions (duplicate contest, save draft)
- Optional: small empty state “motion icon” (not illustrations everywhere)

Rules:
- Must respect `prefers-reduced-motion` (fallback to static SVG or minimal CSS).
- Must be lazy-loaded (do not block first paint).
- Assets must be local and versioned (no remote dependency).

---

## 4) Core Components (src/components/brand-ui)
All components:
- Typed (TS)
- Accessible
- Variants via **cva**
- Use Tailwind tokens / CSS vars
- No ad-hoc styles in pages
- Must support `data-state` patterns from Radix when relevant

### 4.1 BrandShell
Purpose: Layout wrapper for brand pages.
Includes:
- Topbar (glass overlay) with:
  - Logo
  - Live indicator (Race Light)
  - CmdK shortcut
- Nav / Dock (framer-motion) with active state clarity.
- Container: `max-w-7xl mx-auto px-6`

### 4.2 Surface / Panel / Card
- `Surface`: default container (surface-1, border-1, shadow-1, r3)
- `Panel`: Surface with header slot + bigger padding (r4)
- `Card`: compact surface (r3)

Variants:
- `hoverable`
- `track` (Track Pattern)
- `notched` (Clip Notch)
- `beam` (**Magic UI Border Beam**, only where allowed by Effect Budget)

### 4.3 KPI Components
- `KpiHero`: big number + label + delta + optional sparkline
- `Kpi`: smaller KPI for strip

Use `@number-flow/react` for animated transitions (client-only wrapper).
Rules:
- Animate only key KPIs (not every number).

### 4.4 StatusBadge
- Pill badge with dot indicator and subtle background
- Colors: success/warning/danger + neutral
- Must be readable on dark background

### 4.5 DataTable (finance-grade)
- Numbers right-aligned, tabular-nums
- Header subtle
- Row hover subtle
- Empty state integrated
- Pagination/infinite strategy depending on dataset size
- Must support mobile via drawer (vaul) for row details if needed

### 4.6 States
- `Skeleton` (layout-matching)
- `EmptyState` (title, 1-line description, CTA)
- `ErrorState` (actionable + retry CTA)

Rive integration:
- `RiveLoader` (optional usage inside panels)
- `RiveSuccess` (optional, after critical actions)

### 4.7 ActionDialog
- Finance-grade confirm dialog for destructive actions
- Supports “danger” variant
- Must be keyboard accessible

### 4.8 Toasts / Notifications
- Use **sonner** only
- Use consistent verbs and outcomes (Created / Updated / Failed)
- Toasts only on user actions (avoid background refresh spam)

### 4.9 Command Menu
- Use **cmdk** for global actions:
  - Search contest
  - Create contest
  - Jump to messages
  - Open billing portal
Rules:
- Keyboard-first, fast, minimal results.

### 4.10 Drawers (Mobile)
- Use **vaul** for mobile detail views:
  - contest preview
  - submission review
  - filters panel
Rules:
- Must trap focus, close on escape, accessible.

### 4.11 Scroll (lenis)
- Use lenis only on long pages (analytics, feed).
- Disabled when `prefers-reduced-motion`.

---

## 5) “Do / Don’t”
**DO**
- One primary CTA per screen
- Whitespace is luxury (gap-6/8)
- Show trust: statuses, confirmations, clear errors
- Use motion only when it improves comprehension
- Keep “wow” controlled: 1 Magic effect max per screen, Rive only where it adds clarity

**DON’T**
- Decorative gradients
- Constant glow everywhere
- Glass on every card
- 10 different card styles
- **Grey-on-grey or low-contrast text** (use --text-1 #F4F4F5 on surfaces #121212+; borders ≥ 10% white)
- Particle effects as decoration on every page
