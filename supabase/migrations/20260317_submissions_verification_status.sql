ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_verification_status_check
  CHECK (verification_status IN ('unverified', 'verified', 'manual_verified', 'blocked'));

ALTER TABLE public.contest_winnings
  ADD COLUMN IF NOT EXISTS eligibility_status text NOT NULL DEFAULT 'needs_verification';

ALTER TABLE public.contest_winnings
  ADD CONSTRAINT contest_winnings_eligibility_status_check
  CHECK (eligibility_status IN ('eligible', 'needs_verification', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_submissions_verification_status
  ON public.submissions(verification_status);

CREATE INDEX IF NOT EXISTS idx_contest_winnings_eligibility
  ON public.contest_winnings(eligibility_status);

COMMENT ON COLUMN public.submissions.verification_status IS
  'unverified | verified | manual_verified | blocked';
COMMENT ON COLUMN public.contest_winnings.eligibility_status IS
  'eligible | needs_verification | blocked';

