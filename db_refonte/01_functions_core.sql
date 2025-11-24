-- =====================================================
-- 01_functions_core.sql
-- =====================================================
-- Fonctions core utilitaires
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction now_utc() : uniformise le temps en UTC
CREATE OR REPLACE FUNCTION public.now_utc()
RETURNS timestamptz 
LANGUAGE sql 
STABLE 
AS $$
  SELECT timezone('utc', now());
$$;

COMMENT ON FUNCTION public.now_utc() IS 'Retourne la date/heure actuelle en UTC';

-- Fonction is_admin() : vérifie si un utilisateur est admin
-- IMPORTANT : stable et non récursive (lit profiles par id direct)
-- Utilise SECURITY DEFINER pour éviter les problèmes RLS
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_admin.uid 
    AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Vérifie si un utilisateur est admin (stable, non récursive)';

-- Fonction get_user_role() : obtient le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid DEFAULT auth.uid())
RETURNS user_role 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.profiles 
  WHERE id = get_user_role.uid;
$$;

COMMENT ON FUNCTION public.get_user_role(uuid) IS 'Retourne le rôle d''un utilisateur (admin, brand, creator)';

-- Fonction is_creator() : vérifie si un utilisateur est créateur
CREATE OR REPLACE FUNCTION public.is_creator(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_creator.uid 
    AND role = 'creator'
  );
$$;

COMMENT ON FUNCTION public.is_creator(uuid) IS 'Vérifie si un utilisateur est créateur';

-- Fonction is_brand() : vérifie si un utilisateur est marque
CREATE OR REPLACE FUNCTION public.is_brand(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_brand.uid 
    AND role = 'brand'
  );
$$;

COMMENT ON FUNCTION public.is_brand(uuid) IS 'Vérifie si un utilisateur est marque';
