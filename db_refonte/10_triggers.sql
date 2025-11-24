-- =====================================================
-- 10_triggers.sql
-- =====================================================
-- Triggers (update_updated_at, update_message_thread, audit_logs_insert)
-- Idempotent : CREATE OR REPLACE + DROP IF EXISTS
-- =====================================================

-- Fonction update_updated_at : met à jour automatiquement le champ updated_at
-- CORRECTION : utilise NEW.updated_at = now_utc() (pas auth.uid() = NOW())
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := public.now_utc();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at() IS 'Met à jour automatiquement le champ updated_at avec now_utc()';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %2$I.%1$I', r.table_name, r.table_schema);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %2$I.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      r.table_name, r.table_schema
    );
  END LOOP;
END $$;

-- Fonction update_message_thread : met à jour last_message, updated_at, unread_for_*
-- CORRECTION : utilise NEW.sender_id et NEW.thread_id (pas auth.uid())
CREATE OR REPLACE FUNCTION public.update_message_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread RECORD;
BEGIN
  -- Récupérer les infos du thread
  SELECT brand_id, creator_id INTO v_thread
  FROM public.messages_threads
  WHERE id = NEW.thread_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Mettre à jour le thread
  UPDATE public.messages_threads
  SET 
    last_message = LEFT(NEW.body, 100),
    updated_at = public.now_utc(),
    unread_for_brand = CASE 
      WHEN NEW.sender_id = v_thread.brand_id THEN unread_for_brand
      ELSE true
    END,
    unread_for_creator = CASE 
      WHEN NEW.sender_id = v_thread.creator_id THEN unread_for_creator
      ELSE true
    END
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_message_thread() IS 'Met à jour last_message, updated_at et unread_for_* selon le sender_id';

-- Trigger pour messages
DROP TRIGGER IF EXISTS update_message_thread_trigger ON public.messages;
CREATE TRIGGER update_message_thread_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_message_thread();

-- Fonction audit_logs_insert : log des actions sensibles
CREATE OR REPLACE FUNCTION public.audit_logs_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_pk uuid;
BEGIN
  -- Extraire la clé primaire (supposée être 'id' de type uuid)
  IF TG_OP = 'DELETE' THEN
    v_row_pk := OLD.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      v_row_pk,
      to_jsonb(OLD),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_row_pk := NEW.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      v_row_pk,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_row_pk := NEW.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      v_row_pk,
      NULL,
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_logs_insert() IS 'Log automatique des actions INSERT/UPDATE/DELETE sur tables sensibles';

-- Appliquer le trigger audit_logs_insert sur les tables sensibles
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'contests',
      'submissions',
      'payments_brand',
      'cashouts',
      'contest_winnings'
    )
  LOOP
    -- Supprimer le trigger existant s'il existe
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s_trigger ON public.%I', r.tablename, r.tablename);
    
    -- Créer le trigger
    EXECUTE format('
      CREATE TRIGGER audit_%s_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_logs_insert()
    ', r.tablename, r.tablename);
  END LOOP;
END $$;
