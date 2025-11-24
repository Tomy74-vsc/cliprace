-- =====================================================
-- 22_messaging.sql
-- =====================================================
-- Threads & Messages (complément/complétion)
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Note : messages_threads et messages existent déjà dans 07_messaging_notifications.sql
-- Ce fichier ajoute org_id à messages_threads et complète les fonctionnalités

-- Ajouter org_id à messages_threads si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages_threads' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.messages_threads ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index sur org_id dans messages_threads
CREATE INDEX IF NOT EXISTS idx_messages_threads_org_id ON public.messages_threads(org_id) WHERE org_id IS NOT NULL;

-- Fonction helper pour vérifier si un utilisateur est membre d'une org
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
    AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS 'Vérifie si un utilisateur est membre d''une organisation';

-- Commentaires additionnels
COMMENT ON COLUMN public.messages_threads.org_id IS 'Organisation associée au thread (nullable pour compatibilité)';
