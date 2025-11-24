-- =====================================================
-- 19_kyc_risk.sql
-- =====================================================
-- KYC / Cashout (vérifications d'identité)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table kyc_checks : vérifications KYC des utilisateurs
CREATE TABLE IF NOT EXISTS public.kyc_checks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text DEFAULT 'stripe' NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  reason text,
  reviewed_at timestamptz,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table risk_flags : drapeaux de risque utilisateur (optionnel)
CREATE TABLE IF NOT EXISTS public.risk_flags (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur kyc_checks
CREATE INDEX IF NOT EXISTS idx_kyc_checks_status ON public.kyc_checks(status);
CREATE INDEX IF NOT EXISTS idx_kyc_checks_provider ON public.kyc_checks(provider);
CREATE INDEX IF NOT EXISTS idx_kyc_checks_reviewed_at ON public.kyc_checks(reviewed_at) WHERE reviewed_at IS NOT NULL;

-- Index sur risk_flags
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_id ON public.risk_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON public.risk_flags(severity);
CREATE INDEX IF NOT EXISTS idx_risk_flags_resolved ON public.risk_flags(user_id, resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.kyc_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.kyc_checks IS 'Vérifications KYC (Know Your Customer) pour les cashouts';
COMMENT ON TABLE public.risk_flags IS 'Drapeaux de risque pour les utilisateurs (fraude, etc.)';
COMMENT ON COLUMN public.kyc_checks.provider IS 'Fournisseur KYC (stripe, etc.)';
COMMENT ON COLUMN public.kyc_checks.status IS 'Statut de vérification: pending, verified, failed';
COMMENT ON COLUMN public.kyc_checks.reason IS 'Raison en cas d''échec de vérification';
COMMENT ON COLUMN public.risk_flags.severity IS 'Sévérité du drapeau: low, medium, high, critical';
