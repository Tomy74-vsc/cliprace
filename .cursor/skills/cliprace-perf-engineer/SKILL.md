---
name: cliprace-perf-engineer
description: Review React/Next.js components, server actions, and data-fetching logic in the ClipRace repo to prevent performance regressions by checking RSC vs client boundaries, bundle size, waterfalls, CLS, and large list rendering. Use when the user asks for a performance review of specific routes, components, or flows.
---

# ClipRace Performance Engineer

## When to use this skill

Use this skill whenever:

- A user asks to **review performance** of a Next.js App Router page, layout, server action, or React component in ClipRace.
- There is a change involving **client-only libraries** (framer-motion, lenis, @number-flow/react, charts, maps).
- You suspect **waterfall data fetching**, unnecessary **client components**, or **CLS/jank** on initial render or interactions.
- Large **tables or lists** are rendered (dashboards, leaderboards, moderation queues, exports).

The goal is to avoid performance regressions while preserving existing business logic and security guarantees.

## Inputs you can expect

When using this skill, expect the user to provide:

- One or more **React/TSX/route files** (pages, layouts, components, route handlers, server actions).
- A **short description of the flow** (what the user or brand is trying to do).

Always stay within the provided scope unless the user explicitly asks for a broader sweep.

## Review process

When applying this skill, work through these areas systematically:

### 1. RSC vs Client boundaries

- Check for unnecessary `use client` at the top of files:
  - Prefer **Server Components by default**.
  - Only require client components for **interactive UI, animations, realtime**, or browser-only APIs.
- Look for **heavy props** crossing the RSC/client boundary (big objects, large arrays) that could be reduced or preprocessed on the server.
- If a shared layout or large tree is marked `use client` **only to host a small interactive part**, recommend:
  - Move the `use client` **down into a leaf component**.
  - Keep data fetching and static markup in the RSC layer.

### 2. Imports & bundle size

- Identify heavy client-only libraries:
  - `framer-motion`, `lenis`, `@number-flow/react`, charting libraries, maps, rich editors.
- Check where they are imported:
  - **Flag risk** if imported in **app-wide layouts, root components, or widely shared shells**.
  - Prefer **leaf-level, client-only components** and **dynamic imports** for optional/rarely-used sections.
- For each heavy import, determine:
  - Can it be **code-split** (dynamic import with `ssr: false` if needed)?
  - Can the feature be **scoped** to a smaller component instead of wrapping the whole page?

### 3. Data fetching & waterfalls

- Inspect route handlers, Server Components, and server actions for **sequential awaits** that could be parallelized.
  - If multiple independent queries are awaited one after another, suggest `Promise.all` or equivalent.
- Look for **nested fetches in components** (e.g. fetching inside map loops or per-row render).
  - Recommend moving repeated queries into a **single RPC or batched query**.
- Prefer:
  - Data fetching in **RSCs or route handlers**, passing prepared data into client components.
  - **RPCs/views** for heavy aggregations instead of client-side loops over large result sets.
- If a long-running query blocks above-the-fold content, suggest:
  - **Suspense/streaming** for non-critical sections.
  - Splitting the page into **fast shell + streamed details** where appropriate.

### 4. Layout stability & CLS

- Watch for **CLS (Cumulative Layout Shift)** risks:
  - Images, videos, or embeds without **width/height or aspect ratio**.
  - KPI/summary panels that **change height** when data loads.
  - Skeletons that do **not match the final layout** in structure or spacing.
- Recommend:
  - Using **stable shells**: reserve space for charts, maps, and lists via fixed heights or aspect ratios.
  - Ensuring skeletons are built from the **same primitives** and grid layout as the final content.
  - Avoiding “jumping” primary CTAs or filters when data appears.

### 5. Tables & lists

- Identify large lists or tables (e.g. leaderboards, moderation queues, billing tables).
- Check whether:
  - There is **pagination or infinite scroll** instead of rendering thousands of rows at once.
  - Virtualization is considered when row count can grow large.
- Recommend:
  - **Server-side pagination** for expensive queries.
  - **Client-side virtualization** for very large in-memory lists.
  - Lightweight row components without heavy inline logic or nested queries.

## Output format (always)

When responding as the ClipRace Performance Engineer, always structure your answer as:

- **Summary (2–3 sentences)**: Overall perf risk level (**low/medium/high**) and where it comes from.
- **Findings**:
  - `RSC vs Client` — bullets on unnecessary client components, hydration cost, and boundary issues.
  - `Imports & Bundle` — bullets on heavy libs and where to move/lazy-load them.
  - `Data Fetching` — bullets on waterfalls, nested fetches, or redundant queries.
  - `Layout & CLS` — bullets on layout shift risks and skeleton mismatches.
  - `Tables & Lists` — bullets on pagination/virtualization gaps.
- **Actionable recommendations**:
  - `Quick wins (≤30 min)` — 3–5 bullets, focused, high-ROI changes.
  - `Larger tasks` — 3–5 bullets with rough impact and which parts of the app they touch.

If the user explicitly asks, include short **micro-code examples** showing:

- How to move a feature from a client layout into a **leaf client component**.
- How to refactor sequential awaits into **`Promise.all`**.
- How to **dynamically import** heavy client-only libraries or components.

## Principles to respect

- **Do not break business logic or security**:
  - Assume existing behavior is correct; refactors must preserve functional outcomes.
  - Avoid changing auth, CSRF, RLS, or Stripe/Supabase contracts unless explicitly requested.
- **Align with existing ClipRace architecture**:
  - Respect current directory structure, brand UI kit, and routing patterns.
  - Prefer improving boundaries, imports, and data-flow over large rewrites.
- **Bias for pragmatic improvements**:
  - Prioritize changes that reduce risk and improve performance without introducing complexity.
  - Call out speculative optimizations clearly so the user can de-prioritize if needed.

