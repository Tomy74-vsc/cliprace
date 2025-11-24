-- =====================================================
-- 31_notification_templates.sql
-- =====================================================
-- Templates de notifications centralisés (emails, push, in-app)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table notification_templates : templates de notifications
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL UNIQUE, -- 'submission_approved', 'contest_ended', etc.
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'inapp', 'sms')),
  subject text, -- Pour email
  body_html text, -- Template HTML (avec variables {{variable}})
  body_text text, -- Template texte brut
  variables jsonb DEFAULT '{}'::jsonb, -- Variables disponibles et leur description
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur notification_templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON public.notification_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON public.notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON public.notification_templates(is_active) WHERE is_active = true;
-- GIN jsonb sur variables
CREATE INDEX IF NOT EXISTS idx_notification_templates_variables_gin ON public.notification_templates USING gin (variables jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.notification_templates IS 'Templates de notifications centralisés pour emails, push, in-app';
COMMENT ON COLUMN public.notification_templates.event_type IS 'Type d''événement (ex: "submission_approved", "contest_ended")';
COMMENT ON COLUMN public.notification_templates.channel IS 'Canal de notification: email, push, inapp, sms';
COMMENT ON COLUMN public.notification_templates.subject IS 'Sujet pour les emails';
COMMENT ON COLUMN public.notification_templates.body_html IS 'Template HTML avec variables {{variable}}';
COMMENT ON COLUMN public.notification_templates.body_text IS 'Template texte brut avec variables {{variable}}';
COMMENT ON COLUMN public.notification_templates.variables IS 'Variables disponibles et leur description (JSONB)';
