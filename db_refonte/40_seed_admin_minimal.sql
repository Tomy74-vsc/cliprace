-- =====================================================
-- 40_seed_admin_minimal.sql
-- =====================================================
-- Seed minimal for admin interface (dev only).
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING
-- =====================================================

/*
-- IMPORTANT
-- 1) Replace UUID placeholders with real auth.users UUIDs.
-- 2) Run only in development.
-- 3) Keep this file optional (not part of prod migrations).

-- Platform settings
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('commission_rate', to_jsonb(0.1), 'Default commission rate'),
  ('maintenance_mode', to_jsonb(false), 'Global maintenance toggle')
ON CONFLICT (key) DO NOTHING;

-- Feature flags
INSERT INTO public.feature_flags (key, description, is_enabled)
VALUES
  ('admin_emails', 'Enable admin email dispatch', true),
  ('admin_crm', 'Enable CRM module', true),
  ('admin_support', 'Enable support module', true)
ON CONFLICT (key) DO NOTHING;

-- Sales leads (replace lead ids + assigned_to)
INSERT INTO public.sales_leads (
  id, name, email, company, status, source, value_cents, assigned_to, notes
)
VALUES
  (
    'lead-1-uuid'::uuid,
    'Acme Corp',
    'sales@acme.example',
    'Acme Corp',
    'qualified',
    'inbound',
    250000,
    'admin-user-uuid'::uuid,
    'Asked for a demo and pricing.'
  ),
  (
    'lead-2-uuid'::uuid,
    'Blue Labs',
    'hello@bluelabs.example',
    'Blue Labs',
    'new',
    'outbound',
    100000,
    'admin-user-uuid'::uuid,
    'Follow up next week.'
  )
ON CONFLICT (id) DO NOTHING;

-- Support tickets (replace ticket ids + user_id/assigned_to)
INSERT INTO public.support_tickets (
  id, user_id, email, subject, status, priority, assigned_to, internal_notes
)
VALUES
  (
    'ticket-1-uuid'::uuid,
    'creator-1-uuid'::uuid,
    'creator1@example.com',
    'Issue with submission status',
    'open',
    'high',
    'admin-user-uuid'::uuid,
    'Investigate moderation queue.'
  ),
  (
    'ticket-2-uuid'::uuid,
    NULL,
    'brand1@example.com',
    'Invoice PDF missing',
    'pending',
    'medium',
    'admin-user-uuid'::uuid,
    'Check invoices bucket permissions.'
  )
ON CONFLICT (id) DO NOTHING;
*/

DO $$
BEGIN
  RAISE NOTICE 'Admin seed file loaded. Uncomment and replace UUIDs before running.';
END $$;
