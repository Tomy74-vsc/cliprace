-- =====================================================
-- 34_submission_limits.sql
-- =====================================================
-- Limitations de soumission et améliorations modération
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Ajouter max_submissions_per_creator à contests si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'max_submissions_per_creator'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN max_submissions_per_creator integer DEFAULT 1;
    ALTER TABLE public.contests ADD CONSTRAINT contests_max_submissions_positive 
      CHECK (max_submissions_per_creator > 0);
  END IF;
END $$;

-- Ajouter moderated_by et moderation_notes à submissions si pas déjà présents
DO $$
BEGIN
  -- moderated_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'submissions' 
    AND column_name = 'moderated_by'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN moderated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  -- moderation_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'submissions' 
    AND column_name = 'moderation_notes'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN moderation_notes text;
  END IF;
END $$;

-- Ajouter calculated_at à metrics_daily si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'metrics_daily' 
    AND column_name = 'calculated_at'
  ) THEN
    ALTER TABLE public.metrics_daily ADD COLUMN calculated_at timestamptz;
  END IF;
END $$;

-- Index sur max_submissions_per_creator
CREATE INDEX IF NOT EXISTS idx_contests_max_submissions ON public.contests(max_submissions_per_creator);

-- Index sur moderated_by
CREATE INDEX IF NOT EXISTS idx_submissions_moderated_by ON public.submissions(moderated_by) WHERE moderated_by IS NOT NULL;

-- Index sur calculated_at
CREATE INDEX IF NOT EXISTS idx_metrics_daily_calculated_at ON public.metrics_daily(calculated_at DESC) WHERE calculated_at IS NOT NULL;

-- Fonction pour vérifier si un créateur peut soumettre à un concours
CREATE OR REPLACE FUNCTION public.can_creator_submit(p_contest_id uuid, p_creator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest RECORD;
  v_submission_count integer;
BEGIN
  -- Récupérer les infos du concours
  SELECT max_submissions_per_creator INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Vérifier le nombre de soumissions existantes
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submissions
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND status NOT IN ('rejected', 'removed');
  
  -- Vérifier si le créateur peut encore soumettre
  RETURN v_submission_count < COALESCE(v_contest.max_submissions_per_creator, 1);
END;
$$;

COMMENT ON FUNCTION public.can_creator_submit(uuid, uuid) IS 'Vérifie si un créateur peut soumettre à un concours (limite max_submissions_per_creator)';

-- Commentaires
COMMENT ON COLUMN public.contests.max_submissions_per_creator IS 'Nombre maximum de soumissions par créateur pour ce concours';
COMMENT ON COLUMN public.submissions.moderated_by IS 'Utilisateur ayant effectué la modération (admin ou marque)';
COMMENT ON COLUMN public.submissions.moderation_notes IS 'Notes de modération (raison détaillée)';
COMMENT ON COLUMN public.metrics_daily.calculated_at IS 'Date/heure de calcul de la métrique (pour vérifier si à jour)';
