-- =====================================================
-- 18_invoices_billing.sql
-- =====================================================
-- Facturation (organisations marques)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table invoices : factures
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  stripe_invoice_id text UNIQUE,
  amount_cents bigint NOT NULL,
  currency char(3) DEFAULT 'EUR' NOT NULL,
  vat_rate numeric(5, 2),
  pdf_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  issued_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT invoices_positive_amount CHECK (amount_cents >= 0)
);

-- Table tax_evidence : preuves fiscales (optionnel)
CREATE TABLE IF NOT EXISTS public.tax_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL,
  vat_number text,
  collected_at timestamptz DEFAULT NOW() NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON public.invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Index sur tax_evidence
CREATE INDEX IF NOT EXISTS idx_tax_evidence_org_id ON public.tax_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_tax_evidence_country_code ON public.tax_evidence(country_code);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_evidence ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.invoices IS 'Factures pour les organisations marques';
COMMENT ON TABLE public.tax_evidence IS 'Preuves fiscales collectées pour les organisations';
COMMENT ON COLUMN public.invoices.stripe_invoice_id IS 'ID de facture Stripe (unique)';
COMMENT ON COLUMN public.invoices.status IS 'Statut de la facture: draft, open, paid, uncollectible, void';
COMMENT ON COLUMN public.invoices.vat_rate IS 'Taux de TVA appliqué (ex: 20.00 pour 20%)';
COMMENT ON COLUMN public.tax_evidence.country_code IS 'Code pays ISO 3166-1 alpha-2';
