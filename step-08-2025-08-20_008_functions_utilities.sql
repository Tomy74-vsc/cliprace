-- Utility functions for the application

-- Function to get brand dashboard metrics
CREATE OR REPLACE FUNCTION brand_dashboard_metrics(p_brand_id UUID)
RETURNS TABLE (
  total_contests BIGINT,
  active_contests BIGINT,
  completed_contests BIGINT,
  total_views BIGINT,
  total_submissions BIGINT,
  total_spent_cents BIGINT,
  avg_engagement_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(c.id) as total_contests,
    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_contests,
    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_contests,
    COALESCE(SUM(c.total_views), 0) as total_views,
    COALESCE(SUM(c.total_submissions), 0) as total_submissions,
    COALESCE(SUM(pb.amount_cents), 0) as total_spent_cents,
    COALESCE(AVG(s.engagement_rate), 0) as avg_engagement_rate
  FROM contests c
  LEFT JOIN payments_brand pb ON pb.contest_id = c.id AND pb.status = 'paid'
  LEFT JOIN submissions s ON s.contest_id = c.id AND s.status = 'approved'
  WHERE c.brand_id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get creator dashboard metrics
CREATE OR REPLACE FUNCTION creator_dashboard_metrics(p_creator_id UUID)
RETURNS TABLE (
  total_submissions BIGINT,
  approved_submissions BIGINT,
  total_views BIGINT,
  total_earnings_cents BIGINT,
  pending_cashouts_cents BIGINT,
  avg_engagement_rate DECIMAL,
  contests_participated BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(s.id) as total_submissions,
    COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_submissions,
    COALESCE(SUM(s.views), 0) as total_views,
    COALESCE(SUM(l.prize_cents), 0) as total_earnings_cents,
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.gross_cents ELSE 0 END), 0) as pending_cashouts_cents,
    COALESCE(AVG(s.engagement_rate), 0) as avg_engagement_rate,
    COUNT(DISTINCT s.contest_id) as contests_participated
  FROM submissions s
  LEFT JOIN leaderboards l ON l.submission_id = s.id
  LEFT JOIN cashouts c ON c.creator_id = p_creator_id
  WHERE s.creator_id = p_creator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get contest performance metrics
CREATE OR REPLACE FUNCTION contest_performance_metrics(p_contest_id UUID)
RETURNS TABLE (
  total_views BIGINT,
  total_submissions BIGINT,
  total_engagement BIGINT,
  avg_engagement_rate DECIMAL,
  conversion_rate DECIMAL,
  unique_creators BIGINT,
  top_performing_submission_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.views), 0) as total_views,
    COUNT(s.id) as total_submissions,
    COALESCE(SUM(s.likes + s.comments + s.shares), 0) as total_engagement,
    COALESCE(AVG(s.engagement_rate), 0) as avg_engagement_rate,
    CASE 
      WHEN COUNT(s.id) > 0 THEN 
        (COUNT(CASE WHEN s.status = 'approved' THEN 1 END)::DECIMAL / COUNT(s.id)::DECIMAL) * 100
      ELSE 0 
    END as conversion_rate,
    COUNT(DISTINCT s.creator_id) as unique_creators,
    (
      SELECT s2.id 
      FROM submissions s2 
      WHERE s2.contest_id = p_contest_id 
      AND s2.status = 'approved'
      ORDER BY s2.engagement_rate DESC, s2.views DESC 
      LIMIT 1
    ) as top_performing_submission_id
  FROM submissions s
  WHERE s.contest_id = p_contest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search contests
CREATE OR REPLACE FUNCTION search_contests(
  p_search_term TEXT DEFAULT '',
  p_networks network_enum[] DEFAULT '{}',
  p_min_prize_cents INTEGER DEFAULT 0,
  p_max_prize_cents INTEGER DEFAULT NULL,
  p_status contest_status DEFAULT 'active',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  cover_url TEXT,
  prize_pool_cents INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  networks JSONB,
  hashtags TEXT[],
  brand_name TEXT,
  brand_logo_url TEXT,
  total_submissions INTEGER,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.cover_url,
    c.prize_pool_cents,
    c.starts_at,
    c.ends_at,
    c.networks,
    c.hashtags,
    pb.company_name as brand_name,
    pb.logo_url as brand_logo_url,
    c.total_submissions,
    EXTRACT(DAYS FROM (c.ends_at - NOW()))::INTEGER as days_remaining
  FROM contests c
  JOIN profiles_brand pb ON pb.user_id = c.brand_id
  WHERE 
    (p_search_term = '' OR c.title ILIKE '%' || p_search_term || '%' OR c.description ILIKE '%' || p_search_term || '%')
    AND (p_networks = '{}' OR c.networks ?| array(SELECT unnest(p_networks)::text))
    AND c.prize_pool_cents >= p_min_prize_cents
    AND (p_max_prize_cents IS NULL OR c.prize_pool_cents <= p_max_prize_cents)
    AND c.status = p_status
    AND c.visibility = 'public'
  ORDER BY c.prize_pool_cents DESC, c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search creators
CREATE OR REPLACE FUNCTION search_creators(
  p_search_term TEXT DEFAULT '',
  p_networks network_enum[] DEFAULT '{}',
  p_min_followers INTEGER DEFAULT 0,
  p_max_followers INTEGER DEFAULT NULL,
  p_min_avg_views INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  handle TEXT,
  bio TEXT,
  profile_image_url TEXT,
  primary_network network_enum,
  followers_total INTEGER,
  avg_views_30d INTEGER,
  social_media JSONB,
  is_verified BOOLEAN,
  country TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.handle,
    p.bio,
    p.profile_image_url,
    pc.primary_network,
    pc.followers_total,
    pc.avg_views_30d,
    pc.social_media,
    p.is_verified,
    p.country
  FROM profiles p
  JOIN profiles_creator pc ON pc.user_id = p.id
  WHERE 
    p.role = 'creator'
    AND p.is_active = TRUE
    AND (p_search_term = '' OR p.name ILIKE '%' || p_search_term || '%' OR p.handle ILIKE '%' || p_search_term || '%')
    AND (p_networks = '{}' OR pc.primary_network = ANY(p_networks))
    AND pc.followers_total >= p_min_followers
    AND (p_max_followers IS NULL OR pc.followers_total <= p_max_followers)
    AND pc.avg_views_30d >= p_min_avg_views
  ORDER BY pc.followers_total DESC, p.is_verified DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending contests
CREATE OR REPLACE FUNCTION get_trending_contests(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  cover_url TEXT,
  prize_pool_cents INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  brand_name TEXT,
  brand_logo_url TEXT,
  total_submissions INTEGER,
  engagement_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.cover_url,
    c.prize_pool_cents,
    c.starts_at,
    c.ends_at,
    pb.company_name as brand_name,
    pb.logo_url as brand_logo_url,
    c.total_submissions,
    COALESCE(AVG(s.engagement_rate), 0) as engagement_score
  FROM contests c
  JOIN profiles_brand pb ON pb.user_id = c.brand_id
  LEFT JOIN submissions s ON s.contest_id = c.id AND s.status = 'approved'
  WHERE 
    c.status = 'active'
    AND c.visibility = 'public'
    AND c.starts_at <= NOW()
    AND c.ends_at >= NOW()
  GROUP BY c.id, pb.company_name, pb.logo_url
  ORDER BY engagement_score DESC, c.total_submissions DESC, c.prize_pool_cents DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top creators
CREATE OR REPLACE FUNCTION get_top_creators(
  p_network network_enum DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  handle TEXT,
  profile_image_url TEXT,
  primary_network network_enum,
  followers_total INTEGER,
  avg_views_30d INTEGER,
  total_earnings_cents BIGINT,
  contests_won BIGINT,
  is_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.handle,
    p.profile_image_url,
    pc.primary_network,
    pc.followers_total,
    pc.avg_views_30d,
    COALESCE(SUM(l.prize_cents), 0) as total_earnings_cents,
    COUNT(l.id) as contests_won,
    p.is_verified
  FROM profiles p
  JOIN profiles_creator pc ON pc.user_id = p.id
  LEFT JOIN leaderboards l ON l.creator_id = p.id AND l.rank = 1
  WHERE 
    p.role = 'creator'
    AND p.is_active = TRUE
    AND (p_network IS NULL OR pc.primary_network = p_network)
  GROUP BY p.id, pc.primary_network, pc.followers_total, pc.avg_views_30d, p.is_verified
  ORDER BY total_earnings_cents DESC, contests_won DESC, pc.followers_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update contest metrics
CREATE OR REPLACE FUNCTION update_contest_metrics(p_contest_id UUID)
RETURNS VOID AS $$
DECLARE
  contest_metrics RECORD;
BEGIN
  -- Get aggregated metrics
  SELECT 
    COALESCE(SUM(s.views), 0) as total_views,
    COUNT(s.id) as total_submissions,
    COALESCE(SUM(s.likes + s.comments + s.shares), 0) as total_engagement
  INTO contest_metrics
  FROM submissions s
  WHERE s.contest_id = p_contest_id AND s.status = 'approved';
  
  -- Update contest with new metrics
  UPDATE contests 
  SET 
    total_views = contest_metrics.total_views,
    total_submissions = contest_metrics.total_submissions,
    total_engagement = contest_metrics.total_engagement,
    updated_at = NOW()
  WHERE id = p_contest_id;
  
  -- Update leaderboard
  PERFORM update_contest_leaderboard(p_contest_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
