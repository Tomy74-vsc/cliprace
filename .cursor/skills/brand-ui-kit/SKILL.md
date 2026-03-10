---
name: brand-ui-kit
description: Design, evolve, and enforce the ClipRace brand UI kit (tokens, CVA variants, and shared components under src/components/brand-ui) for brand-facing layouts, panels, cards, tables, KPIs, and view states. Use when a change touches structural layout, surfaces, or visual states for brand pages.
---

# Brand UI Kit

## When to use this skill

Use this skill whenever:

- You add or refactor **layouts, panels, cards, tables, KPI blocks, charts, or navigation** in brand-facing areas.
- You introduce or refine **loading, empty, error, or skeleton states** for brand pages.
- You need new **tokens, variants (CVA), or reusable surfaces** rather than ad-hoc Tailwind classes.

Scope is the **brand space UI system**, not one-off marketing pages.

## Core principles

- **Single source of truth**:
  - Brand-specific primitives and patterns live in `src/components/brand-ui`.
  - Visual tokens and rules are defined in `BRAND_UI_SPEC.md`.
  - Layout and interaction patterns are defined in `BRAND_UI_PATTERNS.md`.
- **Recognizable ClipRace identity**:
  - **Race Light**: emerald edge/light only for live/focus/highlight; keep emerald visible area under ~10% per screen.
  - **Track Pattern**: subtle track texture only on select panels/headers (2–4% opacity).
  - **Clip Notch**: minimal cut-corner treatment for premium surfaces (KPI hero, key panels).
  - **Glass**: reserved for shell/overlays (topbar, command palette, drawers), not for every card.
- **Composition over duplication**:
  - Prefer extending or composing existing brand-ui primitives over creating bespoke markup in pages.
- **Server-first**:
  - Components are server components by default; only mark as client when required (realtime, animations, charts, cmdk, lenis, number-flow, vaul).

## Preferred workflow

Follow this sequence when working on brand UI:

1. **Clarify the need**
   - Is this a **new surface** (e.g. summary panel, KPI strip, table row) or an adjustment to an existing one?
   - Which **screen archetype** in `BRAND_UI_PATTERNS.md` does it belong to (dashboard, detail, table, wizard, moderation, etc.)?
2. **Search for an existing primitive**
   - Look under `src/components/brand-ui` for an existing component or primitive that matches at least 70% of the need.
   - If it exists, extend via **CVA variants, slots, or composition** instead of duplicating structural markup.
3. **Decide on the level of abstraction**
   - If the surface will be reused across multiple pages, create/extend a **brand-ui primitive**.
   - If it is page-specific but structurally meaningful (e.g. “Contest KPI strip”), still place it under `src/components/brand-ui` but in a more scoped subfolder.
4. **Define/align tokens**
   - Map new colors, radii, spacing, typography, and elevation to tokens in `BRAND_UI_SPEC.md`.
   - Only introduce new tokens when absolutely necessary; prefer recombining existing ones.
5. **Implement with CVA + Tailwind v4**
   - Define core shape using **CVA variants** (size, tone, emphasis, state).
   - Use Tailwind utility classes aligned with tokens, avoiding inline styles unless dynamic values require them.
6. **Wire loading/empty/error states**
   - Provide matching **skeletons** that prevent CLS and visually mirror final layout.
   - Provide **premium empty states** (icon/illustration, title, one clear CTA, lightweight helper text).
7. **Update/consult patterns docs**
   - When you introduce a new reusable pattern, add or adjust the relevant section in `BRAND_UI_PATTERNS.md` so future work can reuse it.

## Implementation rules

### File and component organization

- Place brand primitives under:
  - `src/components/brand-ui/primitives/*` for low-level building blocks.
  - `src/components/brand-ui/patterns/*` for composed surfaces (panels, cards, tables, KPI strips).
  - `src/components/brand-ui/overlays/*` for drawers, modals, and command surfaces.
- Name components and files **by role**, not by visuals:
  - ✅ `contest-kpi-strip`, `moderation-queue-panel`, `brand-stat-card`.
  - ❌ `green-panel`, `big-card`, `pretty-table`.
- Keep **CVA definitions** close to their components or in a small shared file if reused across multiple primitives.

### Tokens and states

- Always align background, borders, and text with tokens from `BRAND_UI_SPEC.md`:
  - Use **neutral surfaces** for most panels; reserve strong color fills for exceptional/critical blocks.
  - Ensure **WCAG AA contrast** for text against background.
- State handling (default / hover / active / focus / disabled / error):
  - Use **focus-visible rings** aligned with Race Light for keyboard focus, not on every hover.
  - For error/warning/info banners, reuse standardized color scales, icons, and layouts.

### Layout and hierarchy

- Give each screen **one primary CTA**; secondary actions should be visually subordinate.
- Use a **clear vertical rhythm** for headings, subheadings, and content blocks.
- Prefer **progressive disclosure** (tabs, accordions, drawers) instead of over-dense screens.

## Loading, empty, and error states

When adding a new surface:

- **Skeletons**
  - The skeleton layout must **mirror the final layout** to avoid CLS.
  - Use subtle shimmering (if motion is enabled) and fallback to static blocks respecting `prefers-reduced-motion`.
- **Empty states**
  - Include: concise title, single main CTA, short explanatory copy, and optional secondary “learn more” link.
  - Keep visual weight light so it does not compete with primary KPIs.
- **Error states**
  - Provide a clear message, optional details, and an actionable recovery (retry/reload, go back, contact support).

## How to apply this skill in a task

When a user asks for something like:

- “Create a new track/notched panel surface for brand dashboard.”
- “Add a premium empty state with non-janky skeletons.”
- “Refactor this brand table/card layout to use the design system.”

You should:

1. Inspect existing brand-ui components under `src/components/brand-ui`.
2. Map the request to an existing or new **primitive/pattern**.
3. Implement or extend the component with **CVA variants**, aligned tokens, and full state coverage.
4. Add or refine **skeleton, empty, and error states** that match the final layout.
5. Verify that composition in brand pages uses these primitives rather than duplicating markup.

