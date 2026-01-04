-- =====================================================
-- 48_marketing_campaigns.sql
-- =====================================================
-- Marketing "campaigns" layer (optional but powerful):
-- - campaigns: marketing initiatives (budget, dates, status)
-- - campaign_contests: link contests to campaigns
-- - campaign_assets: link assets (briefs/creas) to campaigns
-- - campaign_metrics_daily: daily KPIs (can be filled from event_log or providers)
-- Idempotent.
-- =====================================================

-- -----------------------------------------------------
-- campaigns
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  name text NOT NULL,
  objective text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  budget_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.campaigns(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_metadata_gin ON public.campaigns USING gin (metadata jsonb_path_ops);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_contests (M:N)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_contests (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_contests_contest ON public.campaign_contests(contest_id);

ALTER TABLE public.campaign_contests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_assets (M:N)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_assets (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'creative' CHECK (kind IN ('brief', 'creative', 'logo', 'legal', 'other')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_assets_asset ON public.campaign_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_kind ON public.campaign_assets(kind);

ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_metrics_daily
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_metrics_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  spend_cents integer NOT NULL DEFAULT 0,
  revenue_cents integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date ON public.campaign_metrics_daily(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON public.campaign_metrics_daily(metric_date DESC);

ALTER TABLE public.campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS (admin-only; enforce fine-grained access in API)
-- -----------------------------------------------------

DROP POLICY IF EXISTS "campaigns_admin_all" ON public.campaigns;
CREATE POLICY "campaigns_admin_all" ON public.campaigns
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_contests_admin_all" ON public.campaign_contests;
CREATE POLICY "campaign_contests_admin_all" ON public.campaign_contests
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_assets_admin_all" ON public.campaign_assets;
CREATE POLICY "campaign_assets_admin_all" ON public.campaign_assets
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_metrics_daily_admin_all" ON public.campaign_metrics_daily;
CREATE POLICY "campaign_metrics_daily_admin_all" ON public.campaign_metrics_daily
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

