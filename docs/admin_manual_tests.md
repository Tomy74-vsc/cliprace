## Admin interface - manual QA checklist

### API smoke (run from browser console after login)
1. Fetch CSRF token:
   - `const csrf = await (await fetch('/api/auth/csrf')).json();`
   - `const headers = { 'content-type': 'application/json', 'x-csrf': csrf.token };`
2. Basic GETs (expect 200 + JSON):
   - `await fetch('/api/admin/kpis').then(r => r.json());`
   - `await fetch('/api/admin/contests?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/submissions?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/moderation/queue?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/users?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/finance/summary').then(r => r.json());`
   - `await fetch('/api/admin/cashouts?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/invoices?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/notification-templates?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/email-outbox?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/email-logs?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/crm/leads?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/support/tickets?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/settings?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/feature-flags?limit=1').then(r => r.json());`
   - `await fetch('/api/admin/audit/logs?limit=1').then(r => r.json());`
3. Basic POST sample (create a lead, then delete it):
   - `const lead = await fetch('/api/admin/crm/leads', { method: 'POST', headers, body: JSON.stringify({ name: 'Smoke Lead', status: 'new' }) }).then(r => r.json());`
   - `await fetch('/api/admin/crm/leads/' + lead.id, { method: 'DELETE', headers }).then(r => r.json());`

### Critical flows (UI)
1. Contest publish
   - Open `/app/admin/contests`, pick a draft contest, click Publish.
   - Verify status change and a row in `status_history` + `audit_logs`.
2. Submissions moderation (bulk)
   - Open `/app/admin/submissions`, select pending rows.
   - Approve and reject with a reason; check `moderation_actions` + notifications.
3. Cashout queue
   - Open `/app/admin/finance`, approve one cashout, hold another, reject a third.
   - Verify status transitions + `audit_logs` entries.
4. Invoice lifecycle
   - Open `/app/admin/invoices`, generate PDF then void.
   - Check `pdf_url` updated and status history.
5. Email dispatch
   - Open `/app/admin/emails`, send a test email to a known user.
   - Verify `email_outbox` entry and dispatch audit log.
6. CRM + Support
   - Create a lead, update status, assign to self.
   - Create a support ticket, add a note, close it.
