-- =====================================================
-- 16_platform_links.sql
-- =====================================================
-- Connexions plateformes & OAuth
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table platform_accounts : comptes liés aux plateformes
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform platform NOT NULL,
  platform_user_id text,
  handle text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, platform)
);

-- Table platform_oauth_tokens : tokens OAuth (service role uniquement)
CREATE TABLE IF NOT EXISTS public.platform_oauth_tokens (
  account_id uuid PRIMARY KEY REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table ingestion_jobs : jobs d'ingestion de métriques
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts integer DEFAULT 0 NOT NULL,
  last_error text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table ingestion_errors : erreurs d'ingestion
CREATE TABLE IF NOT EXISTS public.ingestion_errors (
  id bigserial PRIMARY KEY,
  job_id bigint NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  error_code text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur platform_accounts
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON public.platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON public.platform_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_platform ON public.platform_accounts(user_id, platform);
-- Unicité si platform_user_id est connue (stabilise les liens API)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_accounts_platform_user_unique 
  ON public.platform_accounts(platform, platform_user_id) 
  WHERE platform_user_id IS NOT NULL;

-- Index sur ingestion_jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_account_id ON public.ingestion_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scheduled_at ON public.ingestion_jobs(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_account_status ON public.ingestion_jobs(account_id, status, scheduled_at DESC);

-- Index sur ingestion_errors
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_job_id ON public.ingestion_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_error_code ON public.ingestion_errors(error_code);
-- GIN jsonb sur details
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_details_gin ON public.ingestion_errors USING gin (details jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.platform_accounts IS 'Comptes utilisateurs liés aux plateformes sociales (TikTok, Instagram, etc.)';
COMMENT ON TABLE public.platform_oauth_tokens IS 'Tokens OAuth des comptes plateformes (écriture réservée au service_role)';
COMMENT ON TABLE public.ingestion_jobs IS 'Jobs d''ingestion de métriques depuis les plateformes';
COMMENT ON TABLE public.ingestion_errors IS 'Erreurs survenues lors de l''ingestion de métriques';
COMMENT ON COLUMN public.platform_oauth_tokens.account_id IS 'FK vers platform_accounts (clé primaire unique)';
COMMENT ON COLUMN public.platform_oauth_tokens.scopes IS 'Scopes OAuth accordés';
