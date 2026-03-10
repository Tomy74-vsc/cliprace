---
name: brand-security-integrity
description: Enforce security and data-integrity guardrails for ClipRace brand features, focusing on CSRF token strength, RLS expectations, message authorization across brand/contest/creator, rate limiting keyed by user+ip+ua, and Stripe webhook idempotence. Use whenever backend or API changes touch brand flows, messaging, auth, or payments.
---

# Brand Security & Integrity Guardrails

## When to use this skill

Use this skill whenever:

- You modify **API routes, server actions, or middleware** that affect brand, contest, or creator flows.
- You touch **messaging, moderation, or ownership checks** between brands, contests, and creators.
- You integrate or refactor **Stripe payments, webhooks, or billing flows**.
- You alter or introduce **rate limiting** or **CSRF** protections.

The objective is to ensure **no regressions** in security, authorization, or data integrity for brand space features.

## Checklist overview

Verify these five areas:

1. **CSRF token strength and usage**
2. **RLS and ownership expectations**
3. **Messages & interactions authorization**
4. **Rate limiting semantics**
5. **Stripe webhooks & idempotence**

For each, describe **what you checked** and **what must change**, if anything.

## 1. CSRF token strength and usage

Questions to answer:

- Are CSRF tokens generated using **cryptographically strong randomness** (e.g. crypto APIs), never `Math.random` or similar?
- Are tokens:
  - **Bound to a user/session** where appropriate?
  - **Validated server-side** on all state-changing requests that rely on CSRF?
  - **Rotated** or invalidated correctly when sessions change?
- Is CSRF protection applied consistently across **all relevant brand-side mutating routes**?

What to recommend:

- Replace weak randomness with **crypto-strong token generation**.
- Ensure any CSRF token:
  - Is stored/validated securely (e.g. HttpOnly cookies + server-side validation).
  - Cannot be trivially guessed or reused across unrelated contexts.
- If a route is intentionally exempt from CSRF (e.g. certain idempotent APIs), document why and how it remains safe.

## 2. RLS expectations & data ownership

Questions to answer:

- Do queries, RPC calls, and writes correctly express **brand ownership and relationships**?
  - A brand may only access contests, submissions, and messages it owns.
  - Creators may only interact with contests they participate in or are invited to.
- Are the **database RLS policies** (Supabase/Postgres) aligned with assumptions in application code?
  - No application code should rely on columns or filters that **RLS does not enforce**.

What to recommend:

- Make sure all sensitive reads/writes include **brand/creator/user identifiers** consistent with RLS.
- If code-side filters assume a relationship, ensure RLS policies enforce the same expectation.
- Avoid relying on soft checks in code alone; critical constraints must be reflected in RLS.

## 3. Messages & interactions authorization

Focus on brand–contest–creator messaging and moderation flows.

Questions to answer:

- When creating or reading a **message thread or moderation action**:
  - Does the code verify that **the brand owns the contest** involved?
  - Does it verify that **the creator is legitimately associated** with that contest (participant, invitee, or otherwise linked)?
- Are IDs (brand, contest, creator, submission) derived from **trusted sources** (session/auth context, validated DB lookups) rather than raw client input?
- Are there any paths where a user could **escalate privileges** by guessing or iterating IDs?

What to recommend:

- Add **explicit ownership checks** before creating threads or messages.
- Ensure lookups always go through **brand-scoped queries** (e.g. `where contest.brand_id = current_brand_id`).
- For moderation endpoints, verify that the acting user has **proper role/ownership** and that submission/contest IDs are scoped to that brand.

## 4. Rate limiting semantics

Questions to answer:

- Are rate limiting keys constructed from **user identifier + IP + user agent** (or equivalent) rather than IP alone?
- Are limits **proportional** to the risk and cost of the endpoint?
  - Sensitive: login, password reset, payment, messaging.
  - Heavy: expensive aggregations, export, or webhook-like endpoints.
- Are spoofable headers avoided or clearly controlled (no naive trust in `X-Forwarded-For` unless behind a trusted proxy)?

What to recommend:

- Ensure rate limit keys combine:
  - **User ID** (or session identifier) when available.
  - **Network signal** (IP or trusted client IP header from the platform).
  - **User agent** to reduce key collisions.
- For particularly sensitive routes, recommend **stricter per-user limits** and possibly separate global safety caps.

## 5. Stripe webhooks & idempotence

Questions to answer:

- Are Stripe webhooks:
  - **Verified using Stripe’s signing secret**?
  - **Idempotent** at the application level (safe on retries, out-of-order events)?
- Are side effects (credits, status updates, emails) guarded by:
  - Checking **current state** before mutating.
  - Using **idempotency keys** or storing processed event IDs.
- Are **test vs live** modes clearly separated and not cross-contaminating secrets or data?

What to recommend:

- Ensure webhook handlers:
  - Validate the **Stripe signature** before any processing.
  - Track processed events or use **idempotent keys** to avoid duplicate effects.
- For payment and credit updates, always **re-check persistent state** (e.g. payment status) just before mutation.

## How to apply this skill in practice

When the user asks things like:

- “Refactor CSRF handling on brand APIs.”
- “Change the messaging or moderation endpoints for brand contests.”
- “Adjust Stripe webhook handlers or rate limiting around payments.”

You should:

1. Inspect the **relevant routes, middleware, and handlers**.
2. Walk through the five checklist sections above.
3. Produce a concise report with:
   - A **summary (1–2 sentences)** of risk and posture.
   - A **prioritized list of concrete fixes**, each referencing concepts like CSRF, RLS, ownership checks, rate limits, or idempotence as appropriate.

