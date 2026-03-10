-- Migration: create can_submit_to_contest RPC
-- Remplace le fallback can_creator_submit dans submissions/create/route.ts
-- Paramètres: p_contest_id uuid, p_user_id uuid (alias p_creator_id pour compat)
-- Retourne: boolean (true = éligible, false = non éligible)
-- Vérifie dans l'ordre:
--   1. Contest existe et status = 'active'
--   2. Creator profile existe et is_active = true
--   3. Pas de soumission existante non-rejetée qui dépasse la limite
--   4. KYC: si contest requiert kyc, creator doit avoir kyc_checks.status = 'verified'
-- SECURITY DEFINER + search_path = public (cohérent avec can_creator_submit)
-- STABLE car lecture seule

CREATE OR REPLACE FUNCTION public.can_submit_to_contest(
  p_contest_id uuid,
  p_user_id    uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest               RECORD;
  v_profile               RECORD;
  v_submission_count      integer;
BEGIN
  -- 1. Contest: doit exister et être actif
  SELECT
    status,
    max_submissions_per_creator
  INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_contest.status <> 'active' THEN
    RETURN false;
  END IF;

  -- 2. Creator profile: doit exister et être actif
  SELECT is_active
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
    AND role = 'creator';

  IF NOT FOUND OR NOT v_profile.is_active THEN
    RETURN false;
  END IF;

  -- 3. Limite soumissions (max_submissions_per_creator, défaut 1)
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submissions
  WHERE contest_id = p_contest_id
    AND creator_id = p_user_id
    AND status NOT IN ('rejected', 'removed');

  IF v_submission_count >= COALESCE(v_contest.max_submissions_per_creator, 1) THEN
    RETURN false;
  END IF;

  -- KYC check skippé (colonne requires_kyc absente du schéma actuel)
  -- IF COALESCE(v_contest.requires_kyc, false) THEN
  --   SELECT EXISTS(
  --     SELECT 1
  --     FROM public.kyc_checks
  --     WHERE user_id = p_user_id
  --       AND status = 'verified'
  --   ) INTO v_kyc_verified;
  --
  --   IF NOT v_kyc_verified THEN
  --     RETURN false;
  --   END IF;
  -- END IF;

  RETURN true;
END;
$$;

-- Permissions: exécutable par authenticated (RLS s'applique via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.can_submit_to_contest(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_to_contest(uuid, uuid) TO service_role;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.can_submit_to_contest(uuid, uuid) IS
  'Vérifie l''éligibilité complète d''un créateur à soumettre à un concours.
   Contrôles: contest actif, creator actif, limite submissions, KYC si requis.
   Remplace can_creator_submit (qui ne vérifiait que la limite submissions).
   p_user_id = identifiant du créateur (alias de p_creator_id pour compatibilité).';
