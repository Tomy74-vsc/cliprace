-- =====================================================
-- 15_orgs.sql
-- =====================================================
-- Organisations multi-membres (côté marque)
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Table orgs : organisations
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  billing_email citext,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table org_members : membres des organisations
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_org text NOT NULL CHECK (role_in_org IN ('owner', 'admin', 'editor', 'finance')),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

-- Ajouter org_id nullable aux tables existantes (compatibilité ascendante)
DO $$
BEGIN
  -- Ajouter org_id à contests si pas déjà présent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
  
  -- Ajouter org_id à payments_brand si pas déjà présent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments_brand' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.payments_brand ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index sur orgs
CREATE INDEX IF NOT EXISTS idx_orgs_billing_email ON public.orgs(billing_email) WHERE billing_email IS NOT NULL;

-- Index sur org_members
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.org_members(org_id, role_in_org);

-- Index sur org_id dans les tables mises à jour
CREATE INDEX IF NOT EXISTS idx_contests_org_id ON public.contests(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_brand_org_id ON public.payments_brand(org_id) WHERE org_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.orgs IS 'Organisations multi-membres (côté marque)';
COMMENT ON TABLE public.org_members IS 'Membres des organisations avec leurs rôles';
COMMENT ON COLUMN public.org_members.role_in_org IS 'Rôle dans l''organisation: owner, admin, editor, finance';
COMMENT ON COLUMN public.contests.org_id IS 'Organisation associée (nullable pour compatibilité ascendante)';
COMMENT ON COLUMN public.payments_brand.org_id IS 'Organisation associée (nullable pour compatibilité ascendante)';
