---
name: brand-page-ux-review
description: Review brand-facing pages for Apple/Uber/Revolut-level UX quality, focusing on hierarchy, a single primary CTA, density, states, and micro-interactions. Use after refactoring or creating brand pages to produce a concise, actionable UX review.
---

# Brand Page UX Review

## When to use this skill

Use this skill whenever:

- A **brand-facing page** (dashboard, detail, table, wizard, moderation, billing, messaging, etc.) has been created or refactored.
- There are changes to **layout, navigation, or key surfaces** that affect how a brand user understands and acts on information.
- You need a **short, sharp UX review** to align with an Apple/Uber/Revolut quality bar.

Scope: brand app pages (e.g. under `src/app/brand` or their current equivalents), not the entire marketing site.

## Review output format

Always respond with:

1. **Summary (1–2 sentences)**
   - Overall impression and the main UX theme (clarity, focus, friction).
2. **Top issues (max 10 bullets, ordered by impact)**
   - Each bullet must be **one precise, actionable change**.
3. **Micro-fixes**
   - Brief list of concrete adjustments (typo, spacing, alignments, icons, states) if not already covered.

### Bullet format

For each issue, use:

- **[Priority] Area – Problem → Recommendation**
  - Example: **[High] Header – Too many competing CTAs → Collapse secondary actions into a menu and keep one primary CTA.**

Priorities: **High**, **Medium**, **Low**.

## Review checklist

Use this checklist to structure your analysis:

### 1. Hierarchy & focus

- Is it immediately clear **what this page is for** and what success looks like?
- Is the **primary KPI or outcome** visually prominent and located above the fold when possible?
- Are headings, subheadings, and groups logically ordered and visually differentiated?

### 2. Single primary CTA

- Is there **exactly one primary CTA** for the main job of the page?
  - Dashboard: e.g. “Create contest”.
  - Moderation: e.g. “Approve / Reject submission”.
  - Billing: e.g. “Add funds” or “Upgrade”.
- Are secondary actions demoted visually (outline/ghost buttons, subtle links, menus)?

### 3. Density & breathing room

- Is content **legible and scannable**, with adequate spacing between sections and items?
- Are tables/cards optimized for **information density without feeling cramped**?
- Are long forms or dense screens broken into **steps, tabs, or sections** using progressive disclosure?

### 4. States (loading, empty, error, success)

- Does each critical surface on the page have:
  - A **non-janky loading state** (skeletons that match final layout, no CLS).
  - A **premium empty state** (clear title, main CTA, brief explanation).
  - A clear **error state** with recovery (retry, adjust filters, contact support).
  - Appropriate **success feedback** for key flows (toasts, inline confirmations).

### 5. Micro-interactions

- Are interactive elements clearly **hoverable/focusable** with consistent feedback?
- Are transitions (tabs, accordions, drawers, dialog open/close) **quick and smooth**, respecting `prefers-reduced-motion`?
- Are destructive actions protected by **confirmations** with clear consequences?

### 6. Visual alignment with brand system

- Does the page primarily use **brand-ui primitives** instead of ad-hoc markup?
- Is **Race Light** reserved for live/highlight/focus states (not flooding the page)?
- Are **Track Pattern**, **Clip Notch**, and glass treatments used sparingly and consistently with `BRAND_UI_PATTERNS.md`?

### 7. Readability & trust

- Are labels, helper texts, and error messages:
  - Concrete, **free from jargon**, and helpful?
  - Grammatically correct and consistent in tone?
- Are numbers, dates, and currencies formatted for **clarity and locale awareness**?

## How to perform a review

When asked to review a page:

1. **Understand the intent**
   - Identify: page type (dashboard, detail, wizard, table, moderation, billing, messaging).
   - Clarify the **primary job-to-be-done** for this screen.
2. **Scan top-down**
   - Start with header and hero/KPI sections, then secondary panels, then details/tables.
3. **Apply the checklist**
   - For each section, mentally go through hierarchy, CTA, density, states, micro-interactions, and brand alignment.
4. **Draft concise feedback**
   - Limit to **10 high-impact issues**.
   - Prefer concrete instructions (“move X below Y”, “replace button style with secondary variant”, “merge cards A and B into single panel”).
5. **Highlight quick wins**
   - Call out 2–3 changes that deliver immediate UX improvement with low implementation cost.

## Example prompt usages

You should apply this skill when the user writes things like:

- “Review the UX of the new brand dashboard.”
- “After this refactor of the billing page, tell me what to fix to reach Apple-level polish.”
- “We changed the moderation queue layout; give me up to 10 concrete UX fixes.”

In all these cases, run the checklist above and respond in the **Summary / Top issues / Micro-fixes** format.

