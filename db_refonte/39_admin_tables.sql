-- =====================================================
-- 39_admin_tables.sql
-- =====================================================
-- Admin-only tables used by the admin interface.
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE POLICY.
-- =====================================================

-- =====================================================
-- SALES_LEADS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  company text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  source text,
  value_cents integer NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON public.sales_leads(status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_to ON public.sales_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at ON public.sales_leads(created_at DESC);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_leads_admin_all" ON public.sales_leads;
CREATE POLICY "sales_leads_admin_all" ON public.sales_leads
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- SUPPORT_TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_all" ON public.support_tickets
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PLATFORM_SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_admin_all" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_all" ON public.platform_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- FEATURE_FLAGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_admin_all" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_all" ON public.feature_flags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- EMAIL_OUTBOX
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'canceled')),
  provider text,
  error_message text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox(status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_scheduled_at ON public.email_outbox(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_template_id ON public.email_outbox(template_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id ON public.email_outbox(user_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON public.email_outbox(created_at DESC);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_outbox_admin_all" ON public.email_outbox;
CREATE POLICY "email_outbox_admin_all" ON public.email_outbox
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- EMAIL_LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  outbox_id uuid REFERENCES public.email_outbox(id) ON DELETE SET NULL,
  status text NOT NULL,
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_outbox_id ON public.email_logs(outbox_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_admin_all" ON public.email_logs;
CREATE POLICY "email_logs_admin_all" ON public.email_logs
  FOR ALL USING (public.is_admin(auth.uid()));
