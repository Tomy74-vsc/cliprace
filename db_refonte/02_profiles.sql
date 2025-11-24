-- =====================================================
-- 02_profiles.sql
-- =====================================================
-- Tables de profils utilisateurs (profiles, profile_brands, profile_creators)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table principale profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email citext NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  country text DEFAULT 'FR',
  is_active boolean DEFAULT true NOT NULL,
  onboarding_complete boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table profile_brands : détails spécifiques marques
CREATE TABLE IF NOT EXISTS public.profile_brands (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  vat_number text,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_postal_code text,
  address_country text DEFAULT 'FR',
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table profile_creators : détails spécifiques créateurs
CREATE TABLE IF NOT EXISTS public.profile_creators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  handle text,
  primary_platform platform DEFAULT 'tiktok',
  followers integer DEFAULT 0,
  avg_views integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);

-- Index sur profile_creators
CREATE INDEX IF NOT EXISTS idx_profile_creators_handle ON public.profile_creators(handle) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_creators_primary_platform ON public.profile_creators(primary_platform);

-- Index sur profile_brands
CREATE INDEX IF NOT EXISTS idx_profile_brands_company_name ON public.profile_brands(company_name);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_creators ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.profiles IS 'Table principale des profils utilisateurs (admin, brand, creator)';
COMMENT ON TABLE public.profile_brands IS 'Détails spécifiques des marques';
COMMENT ON TABLE public.profile_creators IS 'Détails spécifiques des créateurs';
COMMENT ON COLUMN public.profiles.id IS 'UUID de l''utilisateur (référence auth.users)';
COMMENT ON COLUMN public.profiles.role IS 'Rôle de l''utilisateur (admin, brand, creator)';
COMMENT ON COLUMN public.profiles.email IS 'Email de l''utilisateur (citext pour comparaison insensible à la casse)';
