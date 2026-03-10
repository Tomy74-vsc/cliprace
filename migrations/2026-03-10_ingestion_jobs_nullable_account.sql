ALTER TABLE public.ingestion_jobs
  ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_submission_id
  ON public.ingestion_jobs(submission_id)
  WHERE submission_id IS NOT NULL;

COMMENT ON COLUMN public.ingestion_jobs.account_id IS
  'FK vers platform_accounts — NULL pour les jobs directs par submission (YouTube sans OAuth)';

-- is_resolved: used by admin ingestion UI (ingestion/page.tsx)
ALTER TABLE public.ingestion_errors
  ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ingestion_errors_is_resolved
  ON public.ingestion_errors(is_resolved)
  WHERE is_resolved = false;

COMMENT ON COLUMN public.ingestion_jobs.submission_id IS
  'FK vers submissions — pour les jobs d''ingestion directs par vidéo';
