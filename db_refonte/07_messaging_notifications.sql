-- =====================================================
-- 07_messaging_notifications.sql
-- =====================================================
-- Tables de messagerie et notifications (messages_threads, messages, notifications)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table messages_threads : threads de conversation brand-creator
CREATE TABLE IF NOT EXISTS public.messages_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  last_message text,
  unread_for_brand boolean DEFAULT false NOT NULL,
  unread_for_creator boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul thread par brand-creator-contest
  UNIQUE(contest_id, brand_id, creator_id)
);

-- Table messages : messages individuels dans les threads
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.messages_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table notifications : notifications utilisateur
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur messages_threads
CREATE INDEX IF NOT EXISTS idx_messages_threads_brand_id ON public.messages_threads(brand_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_creator_id ON public.messages_threads(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_contest_id ON public.messages_threads(contest_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_updated_at ON public.messages_threads(updated_at DESC);
-- Index partiels pour unread
CREATE INDEX IF NOT EXISTS idx_threads_brand_unread ON public.messages_threads(brand_id) WHERE unread_for_brand;
CREATE INDEX IF NOT EXISTS idx_threads_creator_unread ON public.messages_threads(creator_id) WHERE unread_for_creator;

-- Index sur messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.messages(thread_id, created_at DESC);

-- Index sur notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Enable RLS
ALTER TABLE public.messages_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.messages_threads IS 'Threads de conversation entre marques et créateurs';
COMMENT ON TABLE public.messages IS 'Messages individuels dans les threads';
COMMENT ON TABLE public.notifications IS 'Notifications utilisateur (in-app)';
COMMENT ON COLUMN public.messages_threads.last_message IS 'Extrait du dernier message (pour preview)';
COMMENT ON COLUMN public.messages_threads.unread_for_brand IS 'Marqueur de non-lu pour la marque';
COMMENT ON COLUMN public.messages_threads.unread_for_creator IS 'Marqueur de non-lu pour le créateur';
COMMENT ON COLUMN public.notifications.content IS 'Contenu de la notification (JSONB avec title, message, action, etc.)';
