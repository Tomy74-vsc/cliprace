-- =====================================================
-- 42_admin_rbac.sql
-- =====================================================
-- RBAC (roles/permissions) for admin staff.
-- Goal: restrict which admin can access which module and whether they can write.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION + DROP/CREATE POLICY.
-- =====================================================

-- -----------------------------------------------------
-- Tables
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_staff (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_active ON public.admin_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_staff_super ON public.admin_staff(is_super_admin) WHERE is_super_admin = true;

-- -----------------------------------------------------
-- Bootstrap + helpers
-- -----------------------------------------------------

-- True when the RBAC system has not been initialized yet (no admin_staff rows).
-- SECURITY DEFINER avoids RLS recursion and lets policies check bootstrap state safely.
CREATE OR REPLACE FUNCTION public.admin_staff_is_bootstrap()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_staff);
$$;

COMMENT ON FUNCTION public.admin_staff_is_bootstrap() IS 'Retourne true si admin_staff est vide (bootstrap RBAC).';

-- True when user is an active super admin.
CREATE OR REPLACE FUNCTION public.is_admin_super(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_staff s
    WHERE s.user_id = is_admin_super.uid
      AND s.is_active = true
      AND s.is_super_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_super(uuid) IS 'Retourne true si l''utilisateur est super admin (admin_staff).';

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_key ON public.admin_roles(key);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON public.admin_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission ON public.admin_role_permissions(permission_key);

CREATE TABLE IF NOT EXISTS public.admin_staff_roles (
  user_id uuid NOT NULL REFERENCES public.admin_staff(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_roles_user ON public.admin_staff_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_staff_roles_role ON public.admin_staff_roles(role_id);

CREATE TABLE IF NOT EXISTS public.admin_staff_permission_overrides (
  user_id uuid NOT NULL REFERENCES public.admin_staff(user_id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_overrides_user ON public.admin_staff_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_overrides_permission ON public.admin_staff_permission_overrides(permission_key);

-- -----------------------------------------------------
-- RLS
-- -----------------------------------------------------

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_staff_permission_overrides ENABLE ROW LEVEL SECURITY;

-- admin_staff
DROP POLICY IF EXISTS "admin_staff_read" ON public.admin_staff;
CREATE POLICY "admin_staff_read" ON public.admin_staff
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_staff_write" ON public.admin_staff;
CREATE POLICY "admin_staff_write" ON public.admin_staff
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_staff_bootstrap" ON public.admin_staff;
CREATE POLICY "admin_staff_bootstrap" ON public.admin_staff
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    AND public.admin_staff_is_bootstrap()
    AND user_id = auth.uid()
    AND is_active = true
    AND is_super_admin = true
  );

-- roles / permissions (read for admins, write for super admins)
DROP POLICY IF EXISTS "admin_roles_read" ON public.admin_roles;
CREATE POLICY "admin_roles_read" ON public.admin_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_roles_write" ON public.admin_roles;
CREATE POLICY "admin_roles_write" ON public.admin_roles
  FOR INSERT, UPDATE, DELETE USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_permissions_read" ON public.admin_permissions;
CREATE POLICY "admin_permissions_read" ON public.admin_permissions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_permissions_write" ON public.admin_permissions;
CREATE POLICY "admin_permissions_write" ON public.admin_permissions
  FOR INSERT, UPDATE, DELETE USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_role_permissions_read" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_read" ON public.admin_role_permissions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_role_permissions_write" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_write" ON public.admin_role_permissions
  FOR INSERT, UPDATE, DELETE USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- staff role assignments
DROP POLICY IF EXISTS "admin_staff_roles_read" ON public.admin_staff_roles;
CREATE POLICY "admin_staff_roles_read" ON public.admin_staff_roles
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_staff_roles_write" ON public.admin_staff_roles;
CREATE POLICY "admin_staff_roles_write" ON public.admin_staff_roles
  FOR INSERT, UPDATE, DELETE USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- per-user overrides
DROP POLICY IF EXISTS "admin_overrides_read" ON public.admin_staff_permission_overrides;
CREATE POLICY "admin_overrides_read" ON public.admin_staff_permission_overrides
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_overrides_write" ON public.admin_staff_permission_overrides;
CREATE POLICY "admin_overrides_write" ON public.admin_staff_permission_overrides
  FOR INSERT, UPDATE, DELETE USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- -----------------------------------------------------
-- Seeds (permissions + default roles)
-- -----------------------------------------------------

INSERT INTO public.admin_permissions (key, description)
VALUES
  ('admin.team.read', 'Voir l’équipe admin et leurs rôles/droits'),
  ('admin.team.write', 'Gérer l’équipe admin (ajouter/supprimer/assigner rôles)'),
  ('dashboard.read', 'Accéder au dashboard'),
  ('brands.read', 'Voir marques/orgs'),
  ('brands.write', 'Créer/éditer marques/orgs'),
  ('contests.read', 'Voir concours'),
  ('contests.write', 'Créer/éditer/publier concours'),
  ('submissions.read', 'Voir soumissions'),
  ('submissions.write', 'Modérer/mettre à jour soumissions'),
  ('moderation.read', 'Voir modération'),
  ('moderation.write', 'Gérer queue + règles de modération'),
  ('integrations.read', 'Voir integrations/webhooks'),
  ('integrations.write', 'Modifier endpoints + relancer webhooks'),
  ('ingestion.read', 'Voir ingestion jobs/errors'),
  ('ingestion.write', 'Relancer jobs / marquer résolu'),
  ('risk.read', 'Voir KYC/risque'),
  ('risk.write', 'Résoudre flags / mettre à jour KYC'),
  ('taxonomy.read', 'Voir tags/terms/assets'),
  ('taxonomy.write', 'Gérer tags/terms/assets'),
  ('exports.read', 'Voir exports'),
  ('exports.write', 'Générer exports étendus'),
  ('users.read', 'Voir utilisateurs'),
  ('users.write', 'Modifier utilisateurs (reset onboarding, suspendre, etc.)'),
  ('finance.read', 'Voir finance'),
  ('finance.write', 'Actions finance (cashouts, void, generate, etc.)'),
  ('invoices.read', 'Voir factures'),
  ('invoices.write', 'Gérer factures'),
  ('emails.read', 'Voir emails/templates/logs'),
  ('emails.write', 'Gérer templates + dispatch emails'),
  ('crm.read', 'Voir CRM'),
  ('crm.write', 'Gérer leads CRM'),
  ('support.read', 'Voir support'),
  ('support.write', 'Gérer tickets support'),
  ('audit.read', 'Voir audit & logs'),
  ('settings.read', 'Voir settings'),
  ('settings.write', 'Modifier settings/feature flags')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_roles (key, name, description)
VALUES
  ('super_admin', 'Super admin', 'Accès complet + gestion des droits'),
  ('ops', 'Ops', 'Opérations quotidiennes (modération/ingestion/intégrations)'),
  ('finance', 'Finance', 'Accès aux pages et actions finance'),
  ('marketing', 'Marketing', 'Marques/concours/CRM + lecture sur le reste'),
  ('support', 'Support', 'Support + lecture des profils'),
  ('read_only', 'Lecture seule', 'Accès lecture seule à l’admin')
ON CONFLICT (key) DO NOTHING;

-- Helper: bind permissions to roles
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'brands.read','brands.write',
  'contests.read','contests.write',
  'submissions.read','submissions.write',
  'moderation.read','moderation.write',
  'integrations.read','integrations.write',
  'ingestion.read','ingestion.write',
  'risk.read','risk.write',
  'taxonomy.read','taxonomy.write',
  'exports.read','exports.write',
  'users.read','users.write',
  'finance.read','finance.write',
  'invoices.read','invoices.write',
  'emails.read','emails.write',
  'crm.read','crm.write',
  'support.read','support.write',
  'audit.read',
  'settings.read','settings.write',
  'admin.team.read','admin.team.write'
)
WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'submissions.read','submissions.write',
  'moderation.read','moderation.write',
  'integrations.read','integrations.write',
  'ingestion.read','ingestion.write',
  'risk.read',
  'users.read',
  'audit.read',
  'exports.read'
)
WHERE r.key = 'ops'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'finance.read','finance.write',
  'invoices.read','invoices.write',
  'audit.read',
  'exports.read','exports.write',
  'users.read'
)
WHERE r.key = 'finance'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'brands.read','brands.write',
  'contests.read','contests.write',
  'taxonomy.read','taxonomy.write',
  'crm.read','crm.write',
  'exports.read',
  'users.read'
)
WHERE r.key = 'marketing'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'support.read','support.write',
  'users.read',
  'audit.read'
)
WHERE r.key = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key LIKE '%.read'
WHERE r.key = 'read_only'
ON CONFLICT DO NOTHING;
