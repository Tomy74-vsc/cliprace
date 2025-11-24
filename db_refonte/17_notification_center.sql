-- =====================================================
-- 17_notification_center.sql
-- =====================================================
-- Préférences de notification & Push tokens
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table notification_preferences : préférences de notification par utilisateur
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'inapp')),
  enabled boolean DEFAULT true NOT NULL,
  PRIMARY KEY (user_id, event, channel),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table push_tokens : tokens push pour notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_event ON public.notification_preferences(event);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_channel ON public.notification_preferences(channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_event ON public.notification_preferences(user_id, event);

-- Index sur push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token) WHERE token IS NOT NULL;
-- Unicité user_id, token pour éviter doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token_unique ON public.push_tokens(user_id, token);
-- GIN jsonb sur device_info
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_info_gin ON public.push_tokens USING gin (device_info jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.notification_preferences IS 'Préférences de notification par utilisateur, événement et canal';
COMMENT ON TABLE public.push_tokens IS 'Tokens push pour notifications mobile/web';
COMMENT ON COLUMN public.notification_preferences.event IS 'Type d''événement (ex: submission_approved, contest_ended)';
COMMENT ON COLUMN public.notification_preferences.channel IS 'Canal de notification: email, push, inapp';
COMMENT ON COLUMN public.push_tokens.device_info IS 'Informations sur le device (platform, app_version, etc.)';
