-- Additional indexes for performance optimization

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contests_brand_status ON contests(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_contests_status_visibility ON contests(status, visibility);
CREATE INDEX IF NOT EXISTS idx_contests_active_dates ON contests(starts_at, ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_contests_prize_status ON contests(prize_pool_cents DESC, status) WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_submissions_contest_status ON submissions(contest_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_status ON submissions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_network_status ON submissions(network, status);
CREATE INDEX IF NOT EXISTS idx_submissions_engagement_views ON submissions(engagement_rate DESC, views DESC) WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_verified_active ON profiles(is_verified, is_active) WHERE role = 'creator';
CREATE INDEX IF NOT EXISTS idx_profiles_handle_active ON profiles(handle) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_creator_followers_network ON profiles_creator(followers_total DESC, primary_network);
CREATE INDEX IF NOT EXISTS idx_profiles_creator_views_network ON profiles_creator(avg_views_30d DESC, primary_network);

CREATE INDEX IF NOT EXISTS idx_profiles_brand_industry_company ON profiles_brand(industry, company_name);

CREATE INDEX IF NOT EXISTS idx_payments_brand_status_created ON payments_brand(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_status ON payments_brand(brand_id, status);

CREATE INDEX IF NOT EXISTS idx_cashouts_creator_status ON cashouts(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_cashouts_status_created ON cashouts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboards_contest_rank ON leaderboards(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboards_creator_rank ON leaderboards(creator_id, rank);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_date ON metrics_daily(submission_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date_views ON metrics_daily(date DESC, views DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);

-- Partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_contests_active_public ON contests(prize_pool_cents DESC, created_at DESC) 
  WHERE status = 'active' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_submissions_approved_engagement ON submissions(engagement_rate DESC, views DESC) 
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_profiles_creators_verified ON profiles(handle, followers_total DESC) 
  WHERE role = 'creator' AND is_verified = TRUE AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_brands_verified ON profiles(company_name) 
  WHERE role = 'brand' AND is_active = TRUE;

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_contests_title_search ON contests USING gin(to_tsvector('french', title));
CREATE INDEX IF NOT EXISTS idx_contests_description_search ON contests USING gin(to_tsvector('french', description));

CREATE INDEX IF NOT EXISTS idx_profiles_name_search ON profiles USING gin(to_tsvector('french', name));
CREATE INDEX IF NOT EXISTS idx_profiles_creator_bio_search ON profiles_creator USING gin(to_tsvector('french', bio));

-- JSONB indexes for social media and metadata
CREATE INDEX IF NOT EXISTS idx_profiles_creator_social_media ON profiles_creator USING gin(social_media);
CREATE INDEX IF NOT EXISTS idx_contests_networks ON contests USING gin(networks);
CREATE INDEX IF NOT EXISTS idx_contests_formats ON contests USING gin(formats);
CREATE INDEX IF NOT EXISTS idx_contests_hashtags ON contests USING gin(hashtags);

-- Array indexes for hashtags
CREATE INDEX IF NOT EXISTS idx_contests_hashtags_array ON contests USING gin(hashtags);

-- Statistics update function
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS VOID AS $$
BEGIN
  -- Update statistics for all tables
  ANALYZE profiles;
  ANALYZE profiles_creator;
  ANALYZE profiles_brand;
  ANALYZE contests;
  ANALYZE submissions;
  ANALYZE payments_brand;
  ANALYZE cashouts;
  ANALYZE leaderboards;
  ANALYZE metrics_daily;
  ANALYZE audit_logs;
END;
$$ LANGUAGE plpgsql;

-- Function to get database performance metrics
CREATE OR REPLACE FUNCTION get_database_metrics()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  table_size TEXT,
  index_size TEXT,
  total_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    n_tup_ins - n_tup_del as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE (
  cleaned_audit_logs BIGINT,
  cleaned_metrics BIGINT
) AS $$
DECLARE
  audit_count BIGINT;
  metrics_count BIGINT;
BEGIN
  -- Clean up audit logs older than 1 year
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
  GET DIAGNOSTICS audit_count = ROW_COUNT;
  
  -- Clean up daily metrics older than 6 months
  DELETE FROM metrics_daily 
  WHERE date < CURRENT_DATE - INTERVAL '6 months';
  GET DIAGNOSTICS metrics_count = ROW_COUNT;
  
  RETURN QUERY SELECT audit_count, metrics_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to update statistics (requires pg_cron extension)
-- This would need to be set up in the Supabase dashboard
/*
SELECT cron.schedule('update-statistics', '0 2 * * *', 'SELECT update_table_statistics();');
SELECT cron.schedule('cleanup-old-data', '0 3 * * 0', 'SELECT cleanup_old_data();');
*/
