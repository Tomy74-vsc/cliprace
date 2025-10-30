-- =====================================================
-- Migration: 20250925_005_admin_messaging_rpc.sql
-- Description: RPC sécurisées pour la gestion des messages signalés par les admins
-- =====================================================

-- Fonction pour récupérer les messages signalés (admin seulement)
CREATE OR REPLACE FUNCTION get_flagged_messages(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    thread_id UUID,
    sender_id UUID,
    body TEXT,
    flagged BOOLEAN,
    flagged_at TIMESTAMPTZ,
    flagged_by UUID,
    flagged_reason TEXT,
    created_at TIMESTAMPTZ,
    sender_name TEXT,
    sender_handle TEXT,
    brand_name TEXT,
    creator_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    SELECT 
        mt.id,
        mt.thread_id,
        mt.sender_id,
        mt.body,
        mt.flagged,
        mt.flagged_at,
        mt.flagged_by,
        mt.flagged_reason,
        mt.created_at,
        ps.name as sender_name,
        ps.handle as sender_handle,
        pb.name as brand_name,
        pc.name as creator_name
    FROM messages_thread mt
    JOIN messages m ON m.id = mt.thread_id
    LEFT JOIN profiles ps ON ps.id = mt.sender_id
    LEFT JOIN profiles pb ON pb.id = m.brand_id
    LEFT JOIN profiles pc ON pc.id = m.creator_id
    WHERE mt.flagged = true
    ORDER BY mt.flagged_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Fonction pour déflaguer un message (admin seulement)
CREATE OR REPLACE FUNCTION unflag_message(
    p_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    -- Déflaguer le message
    UPDATE messages_thread 
    SET 
        flagged = false,
        flagged_at = NULL,
        flagged_by = NULL,
        flagged_reason = NULL
    WHERE id = p_message_id;

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- Log l'action
    PERFORM log_audit_event(
        'update',
        'messages_thread',
        p_message_id,
        jsonb_build_object(
            'action', 'unflagged',
            'admin_id', auth.uid()
        )
    );

    RETURN updated_rows > 0;
END;
$$;

-- Fonction pour supprimer un message signalé (admin seulement)
CREATE OR REPLACE FUNCTION delete_flagged_message(
    p_message_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    message_data JSONB;
    updated_rows INTEGER;
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    -- Récupérer les données du message avant suppression
    SELECT to_jsonb(mt.*) INTO message_data
    FROM messages_thread mt
    WHERE mt.id = p_message_id;

    -- Supprimer le message
    DELETE FROM messages_thread WHERE id = p_message_id;
    
    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    
    -- Log l'action avec les données du message
    PERFORM log_audit_event(
        'delete',
        'messages_thread',
        p_message_id,
        jsonb_build_object(
            'action', 'admin_deleted',
            'admin_id', auth.uid(),
            'reason', p_reason,
            'message_data', message_data
        )
    );

    RETURN updated_rows > 0;
END;
$$;

-- Fonction pour obtenir les statistiques des messages signalés
CREATE OR REPLACE FUNCTION get_flagged_messages_stats()
RETURNS TABLE (
    total_flagged INTEGER,
    flagged_today INTEGER,
    flagged_this_week INTEGER,
    flagged_this_month INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_flagged,
        COUNT(*) FILTER (WHERE flagged_at >= CURRENT_DATE)::INTEGER as flagged_today,
        COUNT(*) FILTER (WHERE flagged_at >= CURRENT_DATE - INTERVAL '7 days')::INTEGER as flagged_this_week,
        COUNT(*) FILTER (WHERE flagged_at >= CURRENT_DATE - INTERVAL '30 days')::INTEGER as flagged_this_month
    FROM messages_thread
    WHERE flagged = true;
END;
$$;

-- Commentaires pour documentation
COMMENT ON FUNCTION get_flagged_messages IS 'Récupère les messages signalés pour les admins';
COMMENT ON FUNCTION unflag_message IS 'Déflaguer un message signalé (admin seulement)';
COMMENT ON FUNCTION delete_flagged_message IS 'Supprimer un message signalé (admin seulement)';
COMMENT ON FUNCTION get_flagged_messages_stats IS 'Statistiques des messages signalés pour les admins';
