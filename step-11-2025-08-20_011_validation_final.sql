-- Final validation and optimization for ClipRace database
-- This migration ensures everything is properly configured

-- Create a comprehensive view for admin dashboard
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE role = 'creator' AND is_active = TRUE) as total_creators,
  (SELECT COUNT(*) FROM profiles WHERE role = 'brand' AND is_active = TRUE) as total_brands,
  (SELECT COUNT(*) FROM contests WHERE status = 'active') as active_contests,
  (SELECT COUNT(*) FROM submissions WHERE status = 'pending') as pending_submissions,
  (SELECT COUNT(*) FROM payments_brand WHERE status = 'paid') as completed_payments,
  (SELECT COALESCE(SUM(amount_cents), 0) FROM payments_brand WHERE status = 'paid') as total_revenue_cents,
  (SELECT COUNT(*) FROM cashouts WHERE status = 'completed') as completed_cashouts,
  (SELECT COALESCE(SUM(net_cents), 0) FROM cashouts WHERE status = 'completed') as total_paid_out_cents;

-- Create a view for contest performance analytics
CREATE OR REPLACE VIEW contest_performance_view AS
SELECT 
  c.id,
  c.title,
  c.brand_id,
  pb.company_name as brand_name,
  c.status,
  c.starts_at,
  c.ends_at,
  c.prize_pool_cents,
  c.total_views,
  c.total_submissions,
  c.total_engagement,
  COUNT(s.id) as actual_submissions,
  COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_submissions,
  AVG(s.engagement_rate) as avg_engagement_rate,
  MAX(s.views) as max_submission_views
FROM contests c
LEFT JOIN profiles_brand pb ON pb.user_id = c.brand_id
LEFT JOIN submissions s ON s.contest_id = c.id
GROUP BY c.id, pb.company_name;

-- Create a view for creator performance analytics
CREATE OR REPLACE VIEW creator_performance_view AS
SELECT 
  p.id,
  p.name,
  p.handle,
  pc.followers_total,
  pc.avg_views_30d,
  pc.primary_network,
  COUNT(s.id) as total_submissions,
  COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_submissions,
  COALESCE(SUM(s.views), 0) as total_views,
  COALESCE(SUM(s.likes + s.comments + s.shares), 0) as total_engagement,
  AVG(s.engagement_rate) as avg_engagement_rate,
  COALESCE(SUM(l.prize_cents), 0) as total_earnings_cents,
  COUNT(DISTINCT s.contest_id) as contests_participated
FROM profiles p
JOIN profiles_creator pc ON pc.user_id = p.id
LEFT JOIN submissions s ON s.creator_id = p.id
LEFT JOIN leaderboards l ON l.submission_id = s.id
WHERE p.role = 'creator' AND p.is_active = TRUE
GROUP BY p.id, p.name, p.handle, pc.followers_total, pc.avg_views_30d, pc.primary_network;

-- Add missing constraints for data integrity
ALTER TABLE profiles ADD CONSTRAINT profiles_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE profiles ADD CONSTRAINT profiles_handle_format CHECK (handle IS NULL OR handle ~* '^[a-zA-Z0-9._-]+$');
ALTER TABLE profiles ADD CONSTRAINT profiles_website_format CHECK (website IS NULL OR website ~* '^https?://');

-- Add constraints for contest data integrity
ALTER TABLE contests ADD CONSTRAINT contests_title_length CHECK (length(title) >= 3 AND length(title) <= 200);
ALTER TABLE contests ADD CONSTRAINT contests_description_length CHECK (description IS NULL OR length(description) <= 2000);
ALTER TABLE contests ADD CONSTRAINT contests_prize_pool_reasonable CHECK (prize_pool_cents <= 10000000); -- Max 100k EUR

-- Add constraints for submission data integrity
ALTER TABLE submissions ADD CONSTRAINT submissions_video_url_format CHECK (video_url ~* '^https?://');
ALTER TABLE submissions ADD CONSTRAINT submissions_engagement_rate_reasonable CHECK (engagement_rate <= 100);

-- Create function to validate contest data before creation
CREATE OR REPLACE FUNCTION validate_contest_data(
  p_title TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_prize_pool_cents INTEGER,
  p_brand_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check title length
  IF length(p_title) < 3 OR length(p_title) > 200 THEN
    RETURN FALSE;
  END IF;
  
  -- Check dates
  IF p_ends_at <= p_starts_at THEN
    RETURN FALSE;
  END IF;
  
  -- Check if starts in the future
  IF p_starts_at <= NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check prize pool
  IF p_prize_pool_cents < 0 OR p_prize_pool_cents > 10000000 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if brand exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_brand_id 
    AND role = 'brand' 
    AND is_active = TRUE
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate submission data
CREATE OR REPLACE FUNCTION validate_submission_data(
  p_contest_id UUID,
  p_creator_id UUID,
  p_video_url TEXT,
  p_network network_enum
)
RETURNS BOOLEAN AS $$
DECLARE
  contest_record RECORD;
  creator_record RECORD;
BEGIN
  -- Check if contest exists and is active
  SELECT * INTO contest_record FROM contests WHERE id = p_contest_id;
  IF NOT FOUND OR contest_record.status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if contest is currently accepting submissions
  IF contest_record.starts_at > NOW() OR contest_record.ends_at < NOW() THEN
    RETURN FALSE;
  END IF;
  
  -- Check if creator exists and is active
  SELECT * INTO creator_record FROM profiles WHERE id = p_creator_id AND role = 'creator' AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check video URL format
  IF p_video_url !~* '^https?://' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if creator can submit to this contest
  IF NOT can_submit_to_contest(p_contest_id, p_creator_id) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get platform statistics
CREATE OR REPLACE FUNCTION get_platform_statistics()
RETURNS TABLE (
  total_users BIGINT,
  total_creators BIGINT,
  total_brands BIGINT,
  total_contests BIGINT,
  active_contests BIGINT,
  total_submissions BIGINT,
  approved_submissions BIGINT,
  total_revenue_cents BIGINT,
  total_paid_out_cents BIGINT,
  avg_contest_engagement DECIMAL,
  top_network network_enum
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE is_active = TRUE) as total_users,
    (SELECT COUNT(*) FROM profiles WHERE role = 'creator' AND is_active = TRUE) as total_creators,
    (SELECT COUNT(*) FROM profiles WHERE role = 'brand' AND is_active = TRUE) as total_brands,
    (SELECT COUNT(*) FROM contests) as total_contests,
    (SELECT COUNT(*) FROM contests WHERE status = 'active') as active_contests,
    (SELECT COUNT(*) FROM submissions) as total_submissions,
    (SELECT COUNT(*) FROM submissions WHERE status = 'approved') as approved_submissions,
    (SELECT COALESCE(SUM(amount_cents), 0) FROM payments_brand WHERE status = 'paid') as total_revenue_cents,
    (SELECT COALESCE(SUM(net_cents), 0) FROM cashouts WHERE status = 'completed') as total_paid_out_cents,
    (SELECT COALESCE(AVG(engagement_rate), 0) FROM submissions WHERE status = 'approved') as avg_contest_engagement,
    (SELECT primary_network FROM profiles_creator GROUP BY primary_network ORDER BY COUNT(*) DESC LIMIT 1) as top_network;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old data (for maintenance)
-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE (
  cleaned_audit_logs BIGINT,
  cleaned_metrics BIGINT,
  cleaned_old_contests BIGINT
) AS $$
DECLARE
  audit_count BIGINT;
  metrics_count BIGINT;
  contests_count BIGINT;
BEGIN
  -- Clean up audit logs older than 1 year
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  GET DIAGNOSTICS audit_count = ROW_COUNT;
  
  -- Clean up daily metrics older than 6 months
  DELETE FROM metrics_daily 
  WHERE date < CURRENT_DATE - INTERVAL '6 months';
  GET DIAGNOSTICS metrics_count = ROW_COUNT;
  
  -- Clean up very old completed contests (older than 2 years)
  DELETE FROM contests 
  WHERE status = 'completed' 
  AND ends_at < NOW() - INTERVAL '2 years';
  GET DIAGNOSTICS contests_count = ROW_COUNT;
  
  RETURN QUERY SELECT audit_count, metrics_count, contests_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT SELECT ON admin_dashboard_stats TO authenticated;
GRANT SELECT ON contest_performance_view TO authenticated;
GRANT SELECT ON creator_performance_view TO authenticated;

-- Create final validation check
CREATE OR REPLACE FUNCTION validate_database_integrity()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check if all required tables exist
  RETURN QUERY
  SELECT 
    'Tables Check'::TEXT,
    CASE WHEN COUNT(*) >= 13 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Found ' || COUNT(*) || ' tables (expected 13+)'::TEXT
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';
  
  -- Check if all required types exist
  RETURN QUERY
  SELECT 
    'Types Check'::TEXT,
    CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Found ' || COUNT(*) || ' custom types (expected 6+)'::TEXT
  FROM pg_type 
  WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND typname LIKE '%_enum';
  
  -- Check if RLS is enabled on all tables
  RETURN QUERY
  SELECT 
    'RLS Check'::TEXT,
    CASE WHEN COUNT(*) >= 13 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'RLS enabled on ' || COUNT(*) || ' tables (expected 13+)'::TEXT
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true;
  
  -- Check if all required functions exist
  RETURN QUERY
  SELECT 
    'Functions Check'::TEXT,
    CASE WHEN COUNT(*) >= 20 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'Found ' || COUNT(*) || ' functions (expected 20+)'::TEXT
  FROM pg_proc 
  WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Final comment
COMMENT ON DATABASE postgres IS 'ClipRace - Complete contest platform database with optimized performance and security';
