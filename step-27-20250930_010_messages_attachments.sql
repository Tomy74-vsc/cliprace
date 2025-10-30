-- =====================================================
-- Migration: 20250930_010_messages_attachments.sql
-- Description: Enhance messaging tables with moderation metadata
--              and apply storage policies for message attachments
-- =====================================================

-- Add moderation columns to messages_thread
ALTER TABLE messages_thread
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_thread_flagged ON messages_thread(flagged);

-- Ensure these policies are idempotent before creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Participants can read message attachments'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Participants can read message attachments" ON storage.objects;
CREATE POLICY "Participants can read message attachments" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'message_attachments'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages.id::text = (storage.foldername(name))[1]
            AND (messages.brand_id = auth.uid() OR messages.creator_id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Participants can upload message attachments'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Participants can upload message attachments" ON storage.objects;
CREATE POLICY "Participants can upload message attachments" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'message_attachments'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages.id::text = (storage.foldername(name))[1]
            AND (messages.brand_id = auth.uid() OR messages.creator_id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Participants can update message attachments'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Participants can update message attachments" ON storage.objects;
CREATE POLICY "Participants can update message attachments" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'message_attachments'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages.id::text = (storage.foldername(name))[1]
            AND (messages.brand_id = auth.uid() OR messages.creator_id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Participants can delete message attachments'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Participants can delete message attachments" ON storage.objects;
CREATE POLICY "Participants can delete message attachments" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'message_attachments'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM messages
          WHERE messages.id::text = (storage.foldername(name))[1]
            AND (messages.brand_id = auth.uid() OR messages.creator_id = auth.uid())
        )
      );
  END IF;
END;
$$;

-- Reminder: ensure the 'message_attachments' bucket exists in Supabase Storage
-- before applying these policies.
