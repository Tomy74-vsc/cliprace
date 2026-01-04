-- =====================================================
-- 47_admin_ops_data.sql
-- =====================================================
-- Admin "Ops Center" data to make the admin interface actionable:
-- - admin_tasks + admin_task_events (inbox/pilotage)
-- - admin_notes (internal notes on user/org/contest/...)
-- - admin_playbooks (procedures / runbooks)
-- - admin_ui_preferences (density, pinned views, table prefs)
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY + CREATE OR REPLACE FUNCTION.
-- =====================================================

-- -----------------------------------------------------
-- admin_tasks
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table text NOT NULL,
  source_id text NOT NULL,
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'canceled')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_tasks_source_unique UNIQUE (source_table, source_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON public.admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON public.admin_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned_to ON public.admin_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_at ON public.admin_tasks(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON public.admin_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_source ON public.admin_tasks(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_metadata_gin ON public.admin_tasks USING gin (metadata jsonb_path_ops);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- admin_task_events
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_task_events (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'status_change', 'assignment', 'system')),
  message text,
  from_status text,
  to_status text,
  from_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_task_events_task_id ON public.admin_task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_task_events_type ON public.admin_task_events(event_type);

ALTER TABLE public.admin_task_events ENABLE ROW LEVEL SECURITY;

-- Auto log status/assignment changes
CREATE OR REPLACE FUNCTION public.admin_tasks_emit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_task_events (task_id, event_type, from_status, to_status, created_by)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid());
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.admin_task_events (task_id, event_type, from_assigned_to, to_assigned_to, created_by)
    VALUES (NEW.id, 'assignment', OLD.assigned_to, NEW.assigned_to, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_tasks_emit_events_trigger ON public.admin_tasks;
CREATE TRIGGER admin_tasks_emit_events_trigger
  BEFORE UPDATE ON public.admin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_tasks_emit_events();

-- -----------------------------------------------------
-- admin_notes
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_table text NOT NULL,
  target_id text NOT NULL,
  note text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_target ON public.admin_notes(target_table, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_pinned ON public.admin_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_admin_notes_tags_gin ON public.admin_notes USING gin (tags);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- admin_playbooks (runbooks)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_playbooks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  body_md text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  related_table text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_playbooks_active ON public.admin_playbooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_playbooks_tags_gin ON public.admin_playbooks USING gin (tags);

ALTER TABLE public.admin_playbooks ENABLE ROW LEVEL SECURITY;

-- Minimal default playbooks
INSERT INTO public.admin_playbooks (key, title, summary, body_md, tags, related_table)
VALUES
  (
    'webhooks.failed',
    'Webhooks en échec — quoi faire',
    'Diagnostic rapide + actions de relance côté endpoint.',
    E'1) Filtre les deliveries failed (24h) et regroupe par endpoint.\n2) Lis last_error (timeout / 4xx / 5xx / signature).\n3) Vérifie URL + secret + réseau côté marque.\n4) Corrige, puis relance (Retry) et surveille la timeline.',
    ARRAY['integrations','webhooks','ops'],
    'webhook_deliveries'
  ),
  (
    'cashouts.review',
    'Cashouts — revue & validation',
    'Checklist avant approbation (KYC, risk flags, ancienneté).',
    E'1) Priorise les demandes les plus anciennes.\n2) Vérifie KYC + flags risque.\n3) Si pause/rejet: raison obligatoire (audit).\n4) Après action: contrôle ledger.',
    ARRAY['finance','ops'],
    'payments_cashouts'
  )
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------
-- admin_ui_preferences
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_ui_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  density text NOT NULL DEFAULT 'comfort' CHECK (density IN ('compact', 'comfort', 'dense')),
  pinned_views jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_ui_preferences ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS policies (admin-only; fine-grained enforcement is done in API with RBAC)
-- -----------------------------------------------------

-- admin_tasks
DROP POLICY IF EXISTS "admin_tasks_admin_all" ON public.admin_tasks;
CREATE POLICY "admin_tasks_admin_all" ON public.admin_tasks
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_task_events
DROP POLICY IF EXISTS "admin_task_events_admin_all" ON public.admin_task_events;
CREATE POLICY "admin_task_events_admin_all" ON public.admin_task_events
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_notes
DROP POLICY IF EXISTS "admin_notes_admin_all" ON public.admin_notes;
CREATE POLICY "admin_notes_admin_all" ON public.admin_notes
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_playbooks
DROP POLICY IF EXISTS "admin_playbooks_admin_all" ON public.admin_playbooks;
CREATE POLICY "admin_playbooks_admin_all" ON public.admin_playbooks
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_ui_preferences
DROP POLICY IF EXISTS "admin_ui_preferences_admin_read" ON public.admin_ui_preferences;
CREATE POLICY "admin_ui_preferences_admin_read" ON public.admin_ui_preferences
  FOR SELECT USING (public.is_admin(auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "admin_ui_preferences_admin_write" ON public.admin_ui_preferences;
CREATE POLICY "admin_ui_preferences_admin_write" ON public.admin_ui_preferences
  FOR INSERT, UPDATE, DELETE USING (public.is_admin(auth.uid()) AND user_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND user_id = auth.uid());

