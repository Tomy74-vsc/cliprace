-- =====================================================
-- 36_messages_attachments.sql
-- =====================================================
-- Pièces jointes des messages (liées aux assets Storage)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table messages_attachments : pièces jointes d'un message
CREATE TABLE IF NOT EXISTS public.messages_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  url text, -- fallback si pas d'asset_id
  mime_type text,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_messages_attachments_message_id ON public.messages_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_attachments_asset_id ON public.messages_attachments(asset_id);

-- Enable RLS
ALTER TABLE public.messages_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: participants du thread du message + admin
DROP POLICY IF EXISTS "messages_attachments_participants_manage" ON public.messages_attachments;
CREATE POLICY "messages_attachments_participants_manage" ON public.messages_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.messages_threads mt ON mt.id = m.thread_id
      WHERE m.id = messages_attachments.message_id
        AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.messages_threads mt ON mt.id = m.thread_id
      WHERE m.id = messages_attachments.message_id
        AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  );

COMMENT ON TABLE public.messages_attachments IS 'Pièces jointes des messages (référence à assets ou URL)';

