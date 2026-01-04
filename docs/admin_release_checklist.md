## Admin release checklist

### Database and seed (dev)
1. Apply `db_refonte/39_admin_tables.sql` after core schema.
2. Optional seed:
   - `db_refonte/13_seed_minimal.sql` (base data).
   - `db_refonte/40_seed_admin_minimal.sql` (admin modules).
3. Validate RLS:
   - Admin can read/write admin tables.
   - Non-admin cannot read admin tables.

### Workflows end-to-end
1. Contest lifecycle: publish, pause, end, archive.
2. Submissions: list, bulk moderate, status history + audit logs.
3. Finance: cashout approve/hold/reject, ledger summary loads.
4. Invoices: generate PDF, void invoice, verify storage link.
5. Emails: template CRUD, dispatch enqueue, outbox/logs.
6. CRM + support: create/update/assign, status history + notes.
7. Settings/feature flags: create/update/delete and app reads.
8. Audit & logs: filters, export CSV, webhooks list.

### Monitoring and ops
1. Error rate alerts for `/api/admin/*` routes.
2. Slow query alerts for heavy endpoints (`/kpis`, `/audit/export`).
3. Storage monitoring for invoices bucket (quota + errors).
4. Outbox monitoring: count of `email_outbox` in `queued` and `failed`.
5. Moderation queue: monitor `pending` count and oldest item age.
6. Stripe/webhook failures: monitor `webhooks_stripe` with `status != 'success'`.
