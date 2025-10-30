-- Create contests table
CREATE TABLE IF NOT EXISTS contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  visual_url TEXT,
  
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Configuration
  networks JSONB NOT NULL DEFAULT '[]'::jsonb,
  formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  hashtags TEXT[] DEFAULT '{}',
  visibility visibility_enum NOT NULL DEFAULT 'public',
  
  -- Requirements
  min_followers INTEGER DEFAULT 0,
  min_monthly_views INTEGER DEFAULT 0,
  participant_limit INTEGER,
  
  -- Status and metrics
  status contest_status NOT NULL DEFAULT 'draft',
  total_views INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  
  -- Financial
  budget_cents INTEGER NOT NULL DEFAULT 0,
  prize_pool_cents INTEGER NOT NULL DEFAULT 0,
  payout_model payout_model_enum NOT NULL DEFAULT 'standard',
  
  -- Rules and terms
  rules_text TEXT,
  rules_file_url TEXT,
  terms_accepted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT contests_ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT contests_positive_budget CHECK (budget_cents >= 0),
  CONSTRAINT contests_positive_prize CHECK (prize_pool_cents >= 0)
);

-- Create contest prizes table
CREATE TABLE IF NOT EXISTS contest_prizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique positions per contest
  UNIQUE(contest_id, position)
);

-- Create contest terms table
CREATE TABLE IF NOT EXISTS contest_terms (
  contest_id UUID PRIMARY KEY REFERENCES contests(id) ON DELETE CASCADE,
  terms_pdf_url TEXT NOT NULL,
  accepted_by_brand_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contests_brand_id ON contests(brand_id);
CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_starts_at ON contests(starts_at);
CREATE INDEX IF NOT EXISTS idx_contests_ends_at ON contests(ends_at);
CREATE INDEX IF NOT EXISTS idx_contests_visibility ON contests(visibility);
CREATE INDEX IF NOT EXISTS idx_contests_created_at ON contests(created_at);
CREATE INDEX IF NOT EXISTS idx_contests_prize_pool ON contests(prize_pool_cents);
CREATE INDEX IF NOT EXISTS idx_contests_hashtags ON contests USING gin(hashtags);
CREATE INDEX IF NOT EXISTS idx_contests_networks ON contests USING gin(networks);
CREATE INDEX IF NOT EXISTS idx_contests_title_search ON contests USING gin(to_tsvector('french', title));

CREATE INDEX IF NOT EXISTS idx_contest_prizes_contest_id ON contest_prizes(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_prizes_position ON contest_prizes(contest_id, position);

-- Enable RLS
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_terms ENABLE ROW LEVEL SECURITY;

-- Contests policies
DROP POLICY IF EXISTS "Brand owners can manage their contests" ON contests;
CREATE POLICY "Brand owners can manage their contests" ON contests
  FOR ALL USING (auth.uid() = brand_id);

DROP POLICY IF EXISTS "Public can view active contests" ON contests;
CREATE POLICY "Public can view active contests" ON contests
  FOR SELECT USING (
    status = 'active' AND 
    visibility = 'public' AND 
    starts_at <= NOW() AND 
    ends_at >= NOW()
  );

DROP POLICY IF EXISTS "Creators can view contest details for participation" ON contests;
CREATE POLICY "Creators can view contest details for participation" ON contests
  FOR SELECT USING (
    status IN ('active', 'completed') AND 
    visibility IN ('public', 'invite_only')
  );

-- Contest prizes policies
DROP POLICY IF EXISTS "Brand owners can manage contest prizes" ON contest_prizes;
CREATE POLICY "Brand owners can manage contest prizes" ON contest_prizes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = contest_prizes.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view contest prizes" ON contest_prizes;
CREATE POLICY "Public can view contest prizes" ON contest_prizes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = contest_prizes.contest_id 
      AND contests.status IN ('active', 'completed')
    )
  );

-- Contest terms policies
DROP POLICY IF EXISTS "Brand owners can manage contest terms" ON contest_terms;
CREATE POLICY "Brand owners can manage contest terms" ON contest_terms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = contest_terms.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view contest terms" ON contest_terms;
CREATE POLICY "Public can view contest terms" ON contest_terms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = contest_terms.contest_id 
      AND contests.status IN ('active', 'completed')
    )
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_contests_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate contest metrics
CREATE OR REPLACE FUNCTION calculate_contest_metrics(p_contest_id UUID)
RETURNS TABLE (
  total_views BIGINT,
  total_submissions BIGINT,
  total_engagement BIGINT,
  avg_engagement_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.views), 0) as total_views,
    COUNT(s.id) as total_submissions,
    COALESCE(SUM(s.likes + s.comments + s.shares), 0) as total_engagement,
    COALESCE(AVG(s.engagement_rate), 0) as avg_engagement_rate
  FROM submissions s
  WHERE s.contest_id = p_contest_id
  AND s.status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if contest is active
CREATE OR REPLACE FUNCTION is_contest_active(p_contest_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM contests 
    WHERE id = p_contest_id 
    AND status = 'active'
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
