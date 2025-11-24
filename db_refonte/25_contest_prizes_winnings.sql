-- =====================================================
-- 25_contest_prizes_winnings.sql
-- =====================================================
-- Système de prix fixes par position et gains persistés
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Table contest_prizes : prix fixes par position
CREATE TABLE IF NOT EXISTS public.contest_prizes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  position integer NOT NULL,
  percentage numeric(5, 2) CHECK (percentage >= 0 AND percentage <= 100),
  amount_cents integer CHECK (amount_cents >= 0),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Une seule position par concours
  UNIQUE(contest_id, position),
  -- Au moins percentage ou amount_cents doit être défini
  CONSTRAINT contest_prizes_has_value CHECK (
    (percentage IS NOT NULL AND percentage > 0) OR 
    (amount_cents IS NOT NULL AND amount_cents > 0)
  )
);

-- Table contest_winnings : gains réels persistés par créateur/concours
CREATE TABLE IF NOT EXISTS public.contest_winnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  rank integer NOT NULL,
  payout_cents integer NOT NULL,
  payout_percentage numeric(5, 2),
  calculated_at timestamptz DEFAULT NOW() NOT NULL,
  paid_at timestamptz,
  cashout_id uuid REFERENCES public.cashouts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul gain par créateur/concours
  UNIQUE(contest_id, creator_id),
  CONSTRAINT contest_winnings_positive_payout CHECK (payout_cents >= 0)
);

-- Index sur contest_prizes
CREATE INDEX IF NOT EXISTS idx_contest_prizes_contest_id ON public.contest_prizes(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_prizes_position ON public.contest_prizes(contest_id, position);

-- Index sur contest_winnings
CREATE INDEX IF NOT EXISTS idx_contest_winnings_contest_id ON public.contest_winnings(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_creator_id ON public.contest_winnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_rank ON public.contest_winnings(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_paid_at ON public.contest_winnings(paid_at) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contest_winnings_cashout_id ON public.contest_winnings(cashout_id) WHERE cashout_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.contest_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_winnings ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_prizes IS 'Prix fixes par position pour les concours (ex: 1er = 50%, 2e = 30%)';
COMMENT ON TABLE public.contest_winnings IS 'Gains réels persistés par créateur/concours (calculés à la fin du concours)';
COMMENT ON COLUMN public.contest_prizes.position IS 'Position du gagnant (1 = premier, 2 = second, etc.)';
COMMENT ON COLUMN public.contest_prizes.percentage IS 'Pourcentage du prize pool (ex: 50.00 pour 50%)';
COMMENT ON COLUMN public.contest_prizes.amount_cents IS 'Montant fixe en centimes (alternative à percentage)';
COMMENT ON COLUMN public.contest_winnings.rank IS 'Rang du créateur dans le classement final';
COMMENT ON COLUMN public.contest_winnings.payout_cents IS 'Montant du gain en centimes';
COMMENT ON COLUMN public.contest_winnings.payout_percentage IS 'Pourcentage du prize pool gagné';
COMMENT ON COLUMN public.contest_winnings.calculated_at IS 'Date de calcul du gain';
COMMENT ON COLUMN public.contest_winnings.paid_at IS 'Date de paiement effectif (via cashout)';
COMMENT ON COLUMN public.contest_winnings.cashout_id IS 'Cashout associé au gain (si payé)';
