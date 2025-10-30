-- Create metrics_daily table for tracking submission performance over time
CREATE TABLE IF NOT EXISTS metrics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Daily metrics
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Calculated fields
  views_change INTEGER DEFAULT 0,
  likes_change INTEGER DEFAULT 0,
  comments_change INTEGER DEFAULT 0,
  shares_change INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT metrics_daily_unique_submission_date UNIQUE (submission_id, date),
  CONSTRAINT metrics_daily_positive_views CHECK (views >= 0),
  CONSTRAINT metrics_daily_positive_likes CHECK (likes >= 0),
  CONSTRAINT metrics_daily_positive_comments CHECK (comments >= 0),
  CONSTRAINT metrics_daily_positive_shares CHECK (shares >= 0)
);

-- Create leaderboards table for contest rankings
CREATE TABLE IF NOT EXISTS leaderboards (
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Ranking metrics
  views_weighted INTEGER NOT NULL DEFAULT 0,
  engagement_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT leaderboards_pkey PRIMARY KEY (contest_id, rank),
  CONSTRAINT leaderboards_positive_rank CHECK (rank > 0),
  CONSTRAINT leaderboards_positive_views CHECK (views_weighted >= 0),
  CONSTRAINT leaderboards_positive_engagement CHECK (engagement_score >= 0),
  CONSTRAINT leaderboards_positive_prize CHECK (prize_cents >= 0)
);

-- Create contest_analytics table for aggregated contest performance
CREATE TABLE IF NOT EXISTS contest_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Daily aggregated metrics
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  new_submissions INTEGER DEFAULT 0,
  
  -- Engagement metrics
  avg_engagement_rate DECIMAL(5,2) DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  
  -- Creator metrics
  unique_creators INTEGER DEFAULT 0,
  new_creators INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT contest_analytics_unique_contest_date UNIQUE (contest_id, date),
  CONSTRAINT contest_analytics_positive_metrics CHECK (
    total_views >= 0 AND total_likes >= 0 AND total_comments >= 0 AND 
    total_shares >= 0 AND total_submissions >= 0 AND new_submissions >= 0
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_id ON metrics_daily(submission_id);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_views ON metrics_daily(views DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_engagement ON metrics_daily(engagement_rate DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboards_contest_id ON leaderboards(contest_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_creator_id ON leaderboards(creator_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_rank ON leaderboards(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboards_views ON leaderboards(views_weighted DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboards_engagement ON leaderboards(engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_contest_analytics_contest_id ON contest_analytics(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_analytics_date ON contest_analytics(date);
CREATE INDEX IF NOT EXISTS idx_contest_analytics_views ON contest_analytics(total_views DESC);

-- Enable RLS
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_analytics ENABLE ROW LEVEL SECURITY;

-- Metrics daily policies
DROP POLICY IF EXISTS "Creators can view their submission metrics" ON metrics_daily;
CREATE POLICY "Creators can view their submission metrics" ON metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id = metrics_daily.submission_id 
      AND submissions.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Brand owners can view contest metrics" ON metrics_daily;
CREATE POLICY "Brand owners can view contest metrics" ON metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN contests c ON c.id = s.contest_id
      WHERE s.id = metrics_daily.submission_id 
      AND c.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view metrics for approved submissions" ON metrics_daily;
CREATE POLICY "Public can view metrics for approved submissions" ON metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id = metrics_daily.submission_id 
      AND submissions.status = 'approved'
    )
  );

-- Leaderboards policies
DROP POLICY IF EXISTS "Public can view leaderboards" ON leaderboards;
CREATE POLICY "Public can view leaderboards" ON leaderboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = leaderboards.contest_id 
      AND contests.status IN ('active', 'completed')
    )
  );

DROP POLICY IF EXISTS "Brand owners can view their contest leaderboards" ON leaderboards;
CREATE POLICY "Brand owners can view their contest leaderboards" ON leaderboards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = leaderboards.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

-- Contest analytics policies
DROP POLICY IF EXISTS "Brand owners can view their contest analytics" ON contest_analytics;
CREATE POLICY "Brand owners can view their contest analytics" ON contest_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = contest_analytics.contest_id 
      AND contests.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all analytics" ON contest_analytics;
CREATE POLICY "Admins can view all analytics" ON contest_analytics
  FOR SELECT USING (is_admin());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_metrics_daily_updated_at
  BEFORE UPDATE ON metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_analytics_updated_at
  BEFORE UPDATE ON contest_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  p_views INTEGER,
  p_likes INTEGER,
  p_comments INTEGER,
  p_shares INTEGER
)
RETURNS DECIMAL(10,2) AS $$
BEGIN
  -- Weighted engagement calculation
  -- Likes: 1 point, Comments: 3 points, Shares: 5 points
  -- Normalized by views to get engagement rate
  IF p_views = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ((p_likes * 1.0) + (p_comments * 3.0) + (p_shares * 5.0)) / p_views * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update leaderboard for a contest
CREATE OR REPLACE FUNCTION update_contest_leaderboard(p_contest_id UUID)
RETURNS VOID AS $$
DECLARE
  submission_record RECORD;
  current_rank INTEGER := 1;
BEGIN
  -- Clear existing leaderboard
  DELETE FROM leaderboards WHERE contest_id = p_contest_id;
  
  -- Rebuild leaderboard based on engagement score
  FOR submission_record IN
    SELECT 
      s.id as submission_id,
      s.creator_id,
      s.views,
      s.likes,
      s.comments,
      s.shares,
      calculate_engagement_score(s.views, s.likes, s.comments, s.shares) as engagement_score
    FROM submissions s
    WHERE s.contest_id = p_contest_id
    AND s.status = 'approved'
    ORDER BY engagement_score DESC, s.views DESC, s.created_at ASC
  LOOP
    INSERT INTO leaderboards (
      contest_id, rank, submission_id, creator_id,
      views_weighted, engagement_score, prize_cents
    ) VALUES (
      p_contest_id, current_rank, submission_record.submission_id, submission_record.creator_id,
      submission_record.views, submission_record.engagement_score, 0
    );
    
    current_rank := current_rank + 1;
  END LOOP;
  
  -- Update prize amounts based on contest prizes
  UPDATE leaderboards 
  SET prize_cents = cp.amount_cents
  FROM contest_prizes cp
  WHERE leaderboards.contest_id = cp.contest_id
  AND leaderboards.rank = cp.position;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get contest leaderboard
CREATE OR REPLACE FUNCTION get_contest_leaderboard(p_contest_id UUID)
RETURNS TABLE (
  rank INTEGER,
  creator_id UUID,
  creator_name TEXT,
  creator_handle TEXT,
  creator_avatar_url TEXT,
  submission_id UUID,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  engagement_score DECIMAL(10,2),
  prize_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.rank,
    l.creator_id,
    p.name as creator_name,
    p.handle as creator_handle,
    p.profile_image_url as creator_avatar_url,
    l.submission_id,
    s.views,
    s.likes,
    s.comments,
    s.shares,
    l.engagement_score,
    l.prize_cents
  FROM leaderboards l
  JOIN submissions s ON s.id = l.submission_id
  JOIN profiles p ON p.id = l.creator_id
  WHERE l.contest_id = p_contest_id
  ORDER BY l.rank ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
