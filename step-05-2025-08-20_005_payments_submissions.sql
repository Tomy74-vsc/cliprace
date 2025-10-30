-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content
  network network_enum NOT NULL,
  video_url TEXT NOT NULL,
  content_url TEXT,
  thumbnail_url TEXT,
  
  -- Status and moderation
  status submission_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id),
  
  -- Metrics (updated via external APIs)
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Timing
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT submissions_positive_views CHECK (views >= 0),
  CONSTRAINT submissions_positive_likes CHECK (likes >= 0),
  CONSTRAINT submissions_positive_comments CHECK (comments >= 0),
  CONSTRAINT submissions_positive_shares CHECK (shares >= 0),
  CONSTRAINT submissions_engagement_rate_range CHECK (engagement_rate >= 0 AND engagement_rate <= 100)
);

-- Create payments_brand table
CREATE TABLE IF NOT EXISTS payments_brand (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  
  -- Payment details
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status payment_status NOT NULL DEFAULT 'pending',
  
  -- Invoice
  invoice_pdf_url TEXT,
  invoice_number TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create cashouts table for creator earnings
CREATE TABLE IF NOT EXISTS cashouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Financial details
  stripe_transfer_id TEXT,
  gross_cents INTEGER NOT NULL CHECK (gross_cents > 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  net_cents INTEGER NOT NULL CHECK (net_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status cashout_status NOT NULL DEFAULT 'pending',
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Metadata
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT cashouts_net_equals_gross_minus_fee CHECK (net_cents = gross_cents - platform_fee_cents)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_network ON submissions(network);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_views ON submissions(views DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_engagement ON submissions(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_posted_at ON submissions(posted_at) WHERE posted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_moderated_at ON submissions(moderated_at) WHERE moderated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_id ON payments_brand(brand_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_contest_id ON payments_brand(contest_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_status ON payments_brand(status);
CREATE INDEX IF NOT EXISTS idx_payments_brand_created_at ON payments_brand(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_brand_stripe_session ON payments_brand(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_cashouts_creator_id ON cashouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_cashouts_status ON cashouts(status);
CREATE INDEX IF NOT EXISTS idx_cashouts_created_at ON cashouts(created_at);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashouts ENABLE ROW LEVEL SECURITY;

-- Submissions policies
DROP POLICY IF EXISTS "Creators can view their own submissions" ON submissions;
CREATE POLICY "Creators can view their own submissions" ON submissions
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can create submissions" ON submissions;
CREATE POLICY "Creators can create submissions" ON submissions
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their own submissions" ON submissions;
CREATE POLICY "Creators can update their own submissions" ON submissions
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Brand owners can view contest submissions" ON submissions;
CREATE POLICY "Brand owners can view contest submissions" ON submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = submissions.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Brand owners can moderate contest submissions" ON submissions;
CREATE POLICY "Brand owners can moderate contest submissions" ON submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = submissions.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view approved submissions" ON submissions;
CREATE POLICY "Public can view approved submissions" ON submissions
  FOR SELECT USING (status = 'approved');

-- Payments brand policies
DROP POLICY IF EXISTS "Brand owners can view their payments" ON payments_brand;
CREATE POLICY "Brand owners can view their payments" ON payments_brand
  FOR SELECT USING (auth.uid() = brand_id);

DROP POLICY IF EXISTS "Brand owners can create payments" ON payments_brand;
CREATE POLICY "Brand owners can create payments" ON payments_brand
  FOR INSERT WITH CHECK (auth.uid() = brand_id);

DROP POLICY IF EXISTS "Admins can view all payments" ON payments_brand;
CREATE POLICY "Admins can view all payments" ON payments_brand
  FOR SELECT USING (is_admin());

-- Cashouts policies
DROP POLICY IF EXISTS "Creators can view their own cashouts" ON cashouts;
CREATE POLICY "Creators can view their own cashouts" ON cashouts
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can create cashouts" ON cashouts;
CREATE POLICY "Creators can create cashouts" ON cashouts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Admins can view all cashouts" ON cashouts;
CREATE POLICY "Admins can view all cashouts" ON cashouts
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update cashout status" ON cashouts;
CREATE POLICY "Admins can update cashout status" ON cashouts
  FOR UPDATE USING (is_admin());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate creator earnings from contests
CREATE OR REPLACE FUNCTION calculate_creator_earnings(p_creator_id UUID)
RETURNS TABLE (
  total_earnings_cents BIGINT,
  pending_cashouts_cents BIGINT,
  completed_cashouts_cents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(cp.amount_cents), 0) as total_earnings_cents,
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.gross_cents ELSE 0 END), 0) as pending_cashouts_cents,
    COALESCE(SUM(CASE WHEN c.status = 'completed' THEN c.gross_cents ELSE 0 END), 0) as completed_cashouts_cents
  FROM contest_prizes cp
  JOIN leaderboards l ON l.contest_id = cp.contest_id AND l.rank = cp.position
  JOIN submissions s ON s.id = l.submission_id
  LEFT JOIN cashouts c ON c.creator_id = p_creator_id
  WHERE s.creator_id = p_creator_id
  AND s.status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can submit to contest
CREATE OR REPLACE FUNCTION can_submit_to_contest(p_contest_id UUID, p_creator_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  contest_record RECORD;
  creator_profile RECORD;
  submission_count INTEGER;
BEGIN
  -- Get contest details
  SELECT * INTO contest_record FROM contests WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if contest is active
  IF contest_record.status != 'active' OR 
     contest_record.starts_at > NOW() OR 
     contest_record.ends_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Get creator profile
  SELECT * INTO creator_profile FROM profiles WHERE id = p_creator_id AND role = 'creator';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check follower requirements
  IF contest_record.min_followers > 0 AND creator_profile.followers_total < contest_record.min_followers THEN
    RETURN FALSE;
  END IF;
  
  -- Check monthly views requirements
  IF contest_record.min_monthly_views > 0 AND creator_profile.avg_views_30d < contest_record.min_monthly_views THEN
    RETURN FALSE;
  END IF;
  
  -- Check participant limit
  IF contest_record.participant_limit > 0 THEN
    SELECT COUNT(*) INTO submission_count 
    FROM submissions 
    WHERE contest_id = p_contest_id AND creator_id = p_creator_id;
    
    IF submission_count >= contest_record.participant_limit THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
