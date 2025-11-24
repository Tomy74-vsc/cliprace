-- =====================================================
-- 26_contest_terms_acceptances.sql
-- =====================================================
-- Traçabilité des acceptations de CGU et lien contest → contest_terms
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Ajouter contest_terms_id à contests si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'contest_terms_id'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN contest_terms_id uuid REFERENCES public.contest_terms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Table contest_terms_acceptances : traçabilité des acceptations de CGU
CREATE TABLE IF NOT EXISTS public.contest_terms_acceptances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contest_terms_id uuid NOT NULL REFERENCES public.contest_terms(id) ON DELETE RESTRICT,
  accepted_at timestamptz DEFAULT NOW() NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul acceptation par utilisateur/concours (mais peut changer si nouvelles CGU)
  UNIQUE(contest_id, user_id, contest_terms_id)
);

-- Index sur contest_terms_acceptances
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_contest_id ON public.contest_terms_acceptances(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_user_id ON public.contest_terms_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_terms_id ON public.contest_terms_acceptances(contest_terms_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_accepted_at ON public.contest_terms_acceptances(accepted_at DESC);

-- Index sur contest_terms_id dans contests
CREATE INDEX IF NOT EXISTS idx_contests_contest_terms_id ON public.contests(contest_terms_id) WHERE contest_terms_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.contest_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_terms_acceptances IS 'Traçabilité des acceptations de CGU par utilisateur/concours (conformité légale)';
COMMENT ON COLUMN public.contests.contest_terms_id IS 'Version des CGU acceptée pour ce concours';
COMMENT ON COLUMN public.contest_terms_acceptances.contest_terms_id IS 'Version des CGU acceptée';
COMMENT ON COLUMN public.contest_terms_acceptances.accepted_at IS 'Date/heure d''acceptation';
COMMENT ON COLUMN public.contest_terms_acceptances.ip_address IS 'Adresse IP de l''utilisateur lors de l''acceptation';
COMMENT ON COLUMN public.contest_terms_acceptances.user_agent IS 'User agent du navigateur lors de l''acceptation';
