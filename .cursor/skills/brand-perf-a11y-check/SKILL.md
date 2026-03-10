---
name: brand-perf-a11y-check
description: Run a focused performance and accessibility checklist on brand-facing pages and components, covering waterfalls, Promise.all usage, CLS and skeletons, focus/aria/keyboard support, prefers-reduced-motion, and scoped usage of framer-motion, lenis, and number-flow. Use after implementing or refactoring brand UI flows.
---

# Brand Performance & Accessibility Check

## When to use this skill

Use this skill whenever:

- You implement or refactor **brand-facing pages or flows** (dashboard, moderation, billing, messaging, wizards).
- You introduce **new data fetching patterns, animations, charts, or scroll behavior**.
- You are preparing a change for **production and want to avoid regressions** in performance or accessibility.

The goal is to quickly validate that the implementation respects ClipRace’s **no-waterfalls, no-CLS, and WCAG-aware** baseline.

## Checklist overview

Run through these five areas:

1. **Data fetching & waterfalls**
2. **Layout stability & skeletons (CLS)**
3. **Focus, aria, and keyboard navigation**
4. **Reduced motion & transitions**
5. **Scoped usage of heavy client libraries**

Keep responses short and concrete, noting **specific files/components** and what to change.

## 1. Data fetching & waterfalls

Questions to answer:

- Are **independent** data fetches executed in **parallel** (e.g. `Promise.all`) instead of sequential waterfalls?
- Are **server components** doing as much work as possible, with client components accepting prepared data?
- Are **RPCs/views** used for heavy aggregation instead of large `.in([...])` calls and client-side loops?

What to recommend:

- Replace sequential awaits with **`Promise.all` or equivalent** where queries are independent.
- Move unnecessary client-side fetching into **server components or RPCs**.
- Split expensive endpoints or queries when they block above-the-fold content unnecessarily.

## 2. Layout stability & skeletons (CLS)

Questions to answer:

- Does the page render a **stable shell** quickly, avoiding large layout shifts when data arrives?
- Do skeletons **match the final layout** in size and structure (cards, rows, avatars, KPIs, charts)?
- Are images, embeds, and charts given **intrinsic or reserved space** to avoid shifting content?

What to recommend:

- Introduce/align **skeleton components** at the same level as final brand-ui primitives.
- Use **fixed heights or aspect ratios** for media and charts where possible.
- Ensure filters/search bars and primary CTAs **do not jump** when data loads.

## 3. Focus, aria, and keyboard navigation

Questions to answer:

- Can all interactive elements (buttons, links, tabs, drawers, dialogs, menus) be reached via **keyboard only**?
- Are visible **focus outlines** present and consistent, especially on primary actions and navigation?
- Do components expose **meaningful aria attributes** where needed:
  - `aria-label`/`aria-labelledby` for icon-only buttons.
  - `role="dialog"`/`aria-modal="true"` for dialogs.
  - `aria-expanded`, `aria-controls` for accordions/menus.
- Are error messages **programmatically associated** with inputs (e.g. via `aria-describedby`)?

What to recommend:

- Ensure all clickable surfaces are **real interactive elements** (`button`, `a`, etc.), not plain `div`s.
- Add or fix **focus styles** using existing brand tokens.
- Add minimal but meaningful **ARIA attributes** to custom components (tabs, accordions, drawers).

## 4. Reduced motion & transitions

Questions to answer:

- Do motion-heavy components (page transitions, carousels, smooth scrolling, micro-animations) respect **`prefers-reduced-motion`**?
- Are transitions **short and purposeful** (e.g. 150–250 ms) instead of slow or distracting?
- Is there a fallback path when motion is disabled (no reliance on animation-only affordances)?

What to recommend:

- Wrap framer-motion/Lenis/other animation logic with a **reduced-motion guard**:
  - Use `prefers-reduced-motion` to disable non-essential animations.
- Avoid chaining multiple long transitions; prefer **snappy, subtle animations**.

## 5. Scoped usage of framer-motion, lenis, number-flow

Questions to answer:

- Are `framer-motion`, `lenis`, and `@number-flow/react` imported **only where necessary**, not at app-wide entry points?
- Are these imports **tree-shaken and code-split** where appropriate (e.g. dynamic imports for heavy sections)?
- Are animated/scroll components encapsulated in **client-only leaf components** instead of wrapping entire routes?

What to recommend:

- Move these imports into **leaf client components** closer to where they’re used.
- Use dynamic imports or route-level code splitting if a heavy animated section is not always needed.
- Do not add them to global layout unless absolutely unavoidable.

## How to apply this skill in practice

When a user asks:

- “Check perf & a11y on this new brand dashboard.”
- “We added framer-motion and lenis; is this implementation safe and scoped?”
- “Does this new wizard respect no-CLS and keyboard navigation?”

You should:

1. Inspect the relevant **page and brand-ui components**.
2. Walk through the **five checklist areas** above.
3. Provide a short report with:
   - A **summary (1–2 sentences)**.
   - A **max-10 bullet list** of concrete changes, grouped by the checklist sections when useful.

