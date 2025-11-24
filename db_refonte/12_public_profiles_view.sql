-- =====================================================
-- 12_public_profiles_view.sql
-- =====================================================
-- Vue publique sans email pour exposition contrôlée des profils actifs
-- Utilise une fonction SECURITY DEFINER pour contourner RLS tout en limitant
-- strictement le jeu de colonnes et de lignes exposées.
-- Idempotent.
-- =====================================================

-- Function returning only safe, non-sensitive columns for active profiles
CREATE OR REPLACE FUNCTION public.public_profiles_safe()
RETURNS TABLE (
  id uuid,
  role user_role,
  display_name text,
  avatar_url text,
  country text
) AS $$
  SELECT p.id, p.role, p.display_name, p.avatar_url, p.country
  FROM public.profiles AS p
  WHERE p.is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- View exposed to clients (anon/authenticated)
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT * FROM public.public_profiles_safe();

-- Allow function execution for exposed roles
GRANT EXECUTE ON FUNCTION public.public_profiles_safe() TO anon, authenticated;

-- Harden base table exposure for anon (defense-in-depth)
REVOKE ALL ON TABLE public.profiles FROM anon;

-- Grant safe read on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS 'Vue publique des profils actifs (sans email)';
