-- Seed data for development and testing
-- Note: This should only be run in development environments

-- Insert sample admin user (replace with actual admin user ID)
-- INSERT INTO admins (user_id, is_super_admin, created_at) 
-- VALUES ('00000000-0000-0000-0000-000000000000', TRUE, NOW());

-- Sample contest categories/networks (stored as JSONB in contests.networks)
-- These are examples of how to structure the networks field:
/*
{
  "tiktok": {
    "enabled": true,
    "requirements": {
      "min_followers": 1000,
      "min_views": 10000
    }
  },
  "instagram": {
    "enabled": true,
    "requirements": {
      "min_followers": 500,
      "min_views": 5000
    }
  }
}
*/

-- Sample contest formats (stored as JSONB in contests.formats)
/*
{
  "video": {
    "enabled": true,
    "max_duration": 60,
    "min_duration": 15,
    "required_elements": ["hashtag", "mention"]
  },
  "story": {
    "enabled": false
  },
  "reel": {
    "enabled": true,
    "max_duration": 30,
    "min_duration": 10
  }
}
*/

-- Sample social media structure (stored as JSONB in profiles_creator.social_media)
/*
{
  "tiktok": {
    "handle": "@username",
    "url": "https://tiktok.com/@username",
    "verified": true,
    "followers": 10000
  },
  "instagram": {
    "handle": "@username",
    "url": "https://instagram.com/username",
    "verified": false,
    "followers": 5000
  },
  "youtube": {
    "handle": "@username",
    "url": "https://youtube.com/@username",
    "verified": true,
    "subscribers": 2000
  }
}
*/

-- Create sample data for testing (only in development)
DO $$
BEGIN
  -- Only create sample data if we're in development
  IF current_setting('app.settings.environment', true) = 'development' THEN
    
    -- Sample brand profiles (these would be created through the signup flow in real usage)
    /*
    INSERT INTO profiles_brand (
      user_id, company_name, legal_name, industry, company_size, 
      description, website, country
    ) VALUES 
    (
      '11111111-1111-1111-1111-111111111111',
      'TechCorp',
      'TechCorp SAS',
      'Technology',
      '10-50',
      'Leading technology company',
      'https://techcorp.com',
      'FR'
    ),
    (
      '22222222-2222-2222-2222-222222222222',
      'FashionBrand',
      'Fashion Brand SARL',
      'Fashion',
      '1-10',
      'Trendy fashion brand',
      'https://fashionbrand.com',
      'FR'
    );
    */
    
    -- Sample creator profiles
    /*
    INSERT INTO profiles_creator (
      user_id, handle, bio, primary_network, 
      followers_total, avg_views_30d, country
    ) VALUES 
    (
      '33333333-3333-3333-3333-333333333333',
      '@techcreator',
      'Tech content creator',
      'tiktok',
      50000,
      100000,
      'FR'
    ),
    (
      '44444444-4444-4444-4444-444444444444',
      '@fashioncreator',
      'Fashion and lifestyle content',
      'instagram',
      25000,
      50000,
      'FR'
    );
    */
    
    -- Sample contests
    /*
    INSERT INTO contests (
      brand_id, title, description, starts_at, ends_at,
      networks, formats, hashtags, visibility, status,
      budget_cents, prize_pool_cents
    ) VALUES 
    (
      '11111111-1111-1111-1111-111111111111',
      'Tech Innovation Challenge',
      'Create innovative tech content',
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '30 days',
      '["tiktok", "instagram"]'::jsonb,
      '{"video": {"enabled": true, "max_duration": 60}}'::jsonb,
      ARRAY['#TechInnovation', '#TechCorp'],
      'public',
      'active',
      100000,
      50000
    );
    */
    
  END IF;
END $$;

-- Create utility functions for development
CREATE OR REPLACE FUNCTION reset_database()
RETURNS VOID AS $$
BEGIN
  -- This function should only be used in development
  IF current_setting('app.settings.environment', true) != 'development' THEN
    RAISE EXCEPTION 'reset_database can only be used in development environment';
  END IF;
  
  -- Clear all data (in reverse dependency order)
  DELETE FROM audit_logs;
  DELETE FROM metrics_daily;
  DELETE FROM leaderboards;
  DELETE FROM contest_analytics;
  DELETE FROM submissions;
  DELETE FROM contest_prizes;
  DELETE FROM contest_terms;
  DELETE FROM contests;
  DELETE FROM payments_brand;
  DELETE FROM cashouts;
  DELETE FROM profiles_creator;
  DELETE FROM profiles_brand;
  DELETE FROM profiles;
  DELETE FROM admins;
  
  -- Reset sequences
  -- Note: UUID sequences don't need resetting
  
  RAISE NOTICE 'Database reset completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create test data
CREATE OR REPLACE FUNCTION create_test_data()
RETURNS VOID AS $$
BEGIN
  -- This function should only be used in development
  IF current_setting('app.settings.environment', true) != 'development' THEN
    RAISE EXCEPTION 'create_test_data can only be used in development environment';
  END IF;
  
  -- Create test admin
  INSERT INTO admins (user_id, is_super_admin) 
  VALUES ('00000000-0000-0000-0000-000000000000', TRUE)
  ON CONFLICT (user_id) DO NOTHING;
  
  RAISE NOTICE 'Test data created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get database health status
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE (
  metric TEXT,
  value TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Users'::TEXT as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'WARNING' END as status
  FROM profiles
  
  UNION ALL
  
  SELECT 
    'Active Contests'::TEXT as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'INFO' END as status
  FROM contests WHERE status = 'active'
  
  UNION ALL
  
  SELECT 
    'Pending Submissions'::TEXT as metric,
    COUNT(*)::TEXT as value,
    CASE WHEN COUNT(*) < 100 THEN 'OK' ELSE 'WARNING' END as status
  FROM submissions WHERE status = 'pending'
  
  UNION ALL
  
  SELECT 
    'Database Size'::TEXT as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    'OK'::TEXT as status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
