-- =====================================================
-- Migration: 20251001_001_messaging_rls_fix.sql
-- Description: Allow brands and admins to flag messages_thread rows
--              while keeping participant isolation intact
-- =====================================================

DROP POLICY IF EXISTS "Brands and admins can flag thread messages" ON messages_thread;

DROP POLICY IF EXISTS "Brands and admins can flag thread messages" ON messages_thread;
CREATE POLICY "Brands and admins can flag thread messages" ON messages_thread
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = messages_thread.thread_id
              AND m.brand_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = messages_thread.thread_id
              AND m.brand_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
