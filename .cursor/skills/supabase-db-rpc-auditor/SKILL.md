---
name: supabase-db-rpc-auditor
description: Audit Supabase schema, RPCs, views, and RLS policies for consistency with ClipRace application code. Use when the user provides SQL migrations, RPC definitions, or TypeScript files that call Supabase and asks to review DB/RPC correctness, security, or performance.
---

# Supabase DB/RPC Auditor for ClipRace

This skill turns the agent into a **DB/RPC auditor** focused on **Supabase schema, RPCs, views, and RLS policies** for the ClipRace project.

The auditor’s primary goal is to:
- **Ensure Supabase schema, RPCs, and RLS policies are coherent with the application code**
- **Detect phantom columns/params, mismatches, and insecure or incomplete policies**

Authoritative sources (in order of precedence):
- Supabase **database schema** (tables, columns, types, constraints, indexes)
- Supabase **RLS policies**
- Supabase **RPC functions / views**
- Application code that calls Supabase (`supabase-js`, `@supabase/ssr`, SQL strings, etc.)

---

## When to Use This Skill

Use this skill whenever:
- The user provides **one or more SQL/migration files** and/or **TS/JS files** that call Supabase.
- The user asks about:
  - Schema vs code **mismatches** or **runtime errors** (missing columns, wrong types).
  - **RPC signature** issues (wrong params, order, nullability).
  - **RLS correctness**, leaks, or over-restrictive behavior.
  - Performance or consistency concerns around **queries, joins, or aggregations**.

If the question involves Supabase schema or RPC correctness for ClipRace and includes concrete code or SQL snippets, **apply this skill**.

---

## Inputs You Can Expect

The user will typically provide:
- One or more of:
  - **SQL / migration files** (DDL, RLS policies, RPC definitions, views).
  - **Application code files** (usually TypeScript) that:
    - Call Supabase via `supabase.from(...).select(...)`, `rpc(...)`, etc.
    - Consume RPCs or views via `supabase-js`.
- Optional context about intended behavior (e.g. “brands should only see their contests”).

You may also have access to Supabase MCP tools (e.g. to list tables, RLS, RPC definitions) and should treat those as **canonical** for the live schema.

---

## High-Level Workflow

When using this skill, follow this workflow:

1. **Collect & map context**
   - List the files/snippets provided and categorize them as:
     - **Schema/SQL**: tables, columns, indexes, RLS, RPCs, views.
     - **Application code**: Supabase queries and RPC calls.
   - Identify all referenced:
     - Tables/views (e.g. `contests`, `brand_contest_metrics_view`).
     - Columns (e.g. `brand_id`, `status`, `created_at`).
     - RPCs/functions (e.g. `get_brand_dashboard`, `increment_submission_count`).

2. **Check schema vs usage**
   - For each query / RPC call in the application code:
     - Verify the **table or view exists**.
     - Verify each **referenced column exists** and is spelled correctly.
     - Where type information is visible, check **type compatibility** between:
       - Column types and filter values (`eq`, `in`, `range`, etc.).
       - RPC parameter types and argument values.
     - Flag any use of:
       - Columns that are not defined in schema/RPC output (possible **phantom columns**).
       - Old column names that appear to have been renamed or removed.

3. **Check RPCs & views**
   - For each RPC call in code (`supabase.rpc("fn_name", { ... })`):
     - Confirm the RPC **exists** in the Supabase schema.
     - Cross-check its **signature**:
       - Parameter names and order.
       - Parameter types and nullability.
       - Default values and optional vs required params.
     - Ensure the **return shape** (columns, types, nullability) is consistent with:
       - How the app reads fields from the RPC result.
       - How the app handles `null` or missing fields.
   - For **complex aggregations or joins** in app code:
     - Identify any heavy logic done with:
       - Large `.in([...])` filters.
       - Multiple sequential queries that could be expressed as a view/RPC.
     - Recommend introducing **views or RPCs** where they would:
       - Reduce network round-trips.
       - Simplify join logic.
       - Centralize authorization or filtering.

4. **Review RLS policies (conceptual and concrete)**
   - For each table that obviously contains sensitive data (e.g. **user, brand, contest, message, payment, submission** data):
     - Check whether **RLS is enabled** (if visible in SQL or via MCP).
     - Review existing policies for:
       - Correct ownership checks (e.g. `brand_id = auth.uid()` or correct foreign key path).
       - Alignment with how the application queries the table (e.g. app filters by `brand_id`, but RLS uses a different field).
       - Overly broad access (e.g. `using ( true )` on sensitive tables).
   - When only app code is visible:
     - Infer what RLS must allow for the query to succeed.
     - Call out where the query **assumes access** that a strict RLS design might deny (e.g. querying all brands without scoping to `auth.uid()`).

5. **Look for performance & consistency traps**
   - Identify:
     - **N+1 query patterns** (e.g. loops that fetch per-row data from Supabase).
     - Repeated filters that should be **centralized in a view/RPC**.
     - Filters on likely **high-cardinality columns** (e.g. `brand_id`, `creator_id`, `contest_id`, `payment_intent_id`) that:
       - Should be indexed for performance.
       - Might need composite indexes (e.g. `(brand_id, status)`).
   - You do not have to prove index existence, but **call out where an index is likely needed**.

6. **Respect non-invention**
   - Do **not invent** new table names, column names, or RPC names that are not present in:
     - The provided SQL / migrations / schema.
     - The provided app code.
   - When suggesting changes, phrase them in terms of:
     - **Existing entities**.
     - High-level patterns (e.g. “consider a view that joins `contests` and `submissions` to precompute counts”).

7. **Produce structured output**
   - Always format the answer using the **Output Format** section below.

---

## Output Format (Always Use This)

Respond using this exact structure:

```markdown
- **Summary (2–3 sentences)**: Overall schema/RPC health and risk level.

- **Findings**
  - `Schema vs Code`
    - [Bullet about column/type mismatches or missing tables/views/RPCs]
    - [...]
  - `RPCs & Views`
    - [Bullet about signature mismatches, phantom params, or missing RPCs/views]
    - [...]
  - `RLS Policies`
    - [Bullet about gaps, over-permissive policies, or mismatches with app logic]
    - [...]
  - `Performance & Consistency`
    - [Bullet about N+1 queries, missing views, or potential indexing issues]
    - [...]

- **Recommended changes**
  - `Must fix`
    - [Bullets for correctness/security-critical changes]
  - `Should consider`
    - [Bullets for structural or performance improvements, such as new RPCs/views]
```

Guidelines:
- If a section has **no findings**, still include it with a single bullet like:
  - `Schema vs Code` — `No issues found in the provided snippets.`
- Keep the **Summary** to 2–3 concise sentences focused on:
  - Risk level (low/medium/high).
  - Overall coherence between schema, RPCs, RLS, and app code.

---

## Review Checklists

Use these lightweight checklists to structure your analysis.

### Schema vs Code Checklist

- [ ] Every referenced **table/view** exists.
- [ ] Every referenced **column** exists and is spelled correctly.
- [ ] Column **types** are compatible with filter/order/group operations.
- [ ] No use of removed or deprecated columns in the provided schema.
- [ ] Nullable vs non-nullable expectations in code are realistic (e.g. avoid assuming non-null if column is nullable).

### RPCs & Views Checklist

- [ ] Each called **RPC exists**.
- [ ] RPC parameter **names, order, and types** match the call.
- [ ] Nullability and default values are handled correctly by the app.
- [ ] RPC/view **result columns** match what the app reads.
- [ ] Heavy aggregations/joins are implemented by **RPCs or views** where appropriate.

### RLS Policies Checklist

- [ ] Sensitive tables (brands, contests, creators, submissions, messages, payments) are protected by **RLS**.
- [ ] Policies enforce the correct **ownership/tenancy model** (e.g. brand-only data vs creator data).
- [ ] Application queries are **compatible with RLS filters** (no hidden contradictions).
- [ ] No obviously **over-broad** policies on sensitive data.
- [ ] Any cross-entity access (e.g. brand reading creator submissions) is backed by clear join/path logic in policies.

### Performance & Consistency Checklist

- [ ] No obvious **N+1** patterns in Supabase calls.
- [ ] High-cardinality filters appear to have **index support** or should be indexed.
- [ ] Repeated query patterns could be **centralized** into RPCs/views where beneficial.
- [ ] Aggregations and rankings use **server-side** computation instead of heavy client-side processing.

---

## Notes for ClipRace

- ClipRace relies heavily on Supabase for:
  - **Brand/contest/creator/submission** data.
  - **Payments** (Stripe identifiers, ledger-ish tables).
  - **Realtime and metrics** via views/RPCs.
- When in doubt, err on the side of:
  - **Stricter RLS** (no unintended cross-tenant data leakage).
  - **Centralized logic** in RPCs/views for complex metrics and dashboard summaries.

If other project-specific Supabase skills (e.g. `supabase-rpc-consistency`) are present, you may use them in combination with this skill—this skill defines the **review structure and output format** for DB/RPC audits.

