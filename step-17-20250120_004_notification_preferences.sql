-- Add notification preferences to profiles table
-- This migration adds notification preference columns to the profiles table

-- Add notification preference columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;

-- Add notification preference columns to profiles_creator table
ALTER TABLE profiles_creator 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;

-- Add notification preference columns to profiles_brand table
ALTER TABLE profiles_brand 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;

-- Add indexes for notification preferences
CREATE INDEX IF NOT EXISTS idx_profiles_email_notifications ON profiles(email_notifications);
CREATE INDEX IF NOT EXISTS idx_profiles_push_notifications ON profiles(push_notifications);
CREATE INDEX IF NOT EXISTS idx_profiles_in_app_notifications ON profiles(in_app_notifications);

-- Add comments to explain the columns
COMMENT ON COLUMN profiles.email_notifications IS 'Whether user wants to receive email notifications';
COMMENT ON COLUMN profiles.push_notifications IS 'Whether user wants to receive push notifications';
COMMENT ON COLUMN profiles.in_app_notifications IS 'Whether user wants to receive in-app notifications';

COMMENT ON COLUMN profiles_creator.email_notifications IS 'Whether creator wants to receive email notifications';
COMMENT ON COLUMN profiles_creator.push_notifications IS 'Whether creator wants to receive push notifications';
COMMENT ON COLUMN profiles_creator.in_app_notifications IS 'Whether creator wants to receive in-app notifications';

COMMENT ON COLUMN profiles_brand.email_notifications IS 'Whether brand wants to receive email notifications';
COMMENT ON COLUMN profiles_brand.push_notifications IS 'Whether brand wants to receive push notifications';
COMMENT ON COLUMN profiles_brand.in_app_notifications IS 'Whether brand wants to receive in-app notifications';

-- Create a function to get user notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  email_notifications BOOLEAN,
  push_notifications BOOLEAN,
  in_app_notifications BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email_notifications,
    p.push_notifications,
    p.in_app_notifications
  FROM profiles p
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update user notification preferences
CREATE OR REPLACE FUNCTION update_user_notification_preferences(
  user_id UUID DEFAULT auth.uid(),
  email_pref BOOLEAN DEFAULT NULL,
  push_pref BOOLEAN DEFAULT NULL,
  in_app_pref BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update main profiles table
  UPDATE profiles 
  SET 
    email_notifications = COALESCE(email_pref, email_notifications),
    push_notifications = COALESCE(push_pref, push_notifications),
    in_app_notifications = COALESCE(in_app_pref, in_app_notifications),
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Update creator profile if exists
  UPDATE profiles_creator 
  SET 
    email_notifications = COALESCE(email_pref, email_notifications),
    push_notifications = COALESCE(push_pref, push_notifications),
    in_app_notifications = COALESCE(in_app_pref, in_app_notifications),
    updated_at = NOW()
  WHERE user_id = user_id;
  
  -- Update brand profile if exists
  UPDATE profiles_brand 
  SET 
    email_notifications = COALESCE(email_pref, email_notifications),
    push_notifications = COALESCE(push_pref, push_notifications),
    in_app_notifications = COALESCE(in_app_pref, in_app_notifications),
    updated_at = NOW()
  WHERE user_id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a table for push notification tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, token)
);

-- Add indexes for push tokens
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_platform ON user_push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active);

-- Enable RLS for push tokens
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for push tokens
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON user_push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON user_push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Add comments for push tokens table
COMMENT ON TABLE user_push_tokens IS 'Stores push notification tokens for users';
COMMENT ON COLUMN user_push_tokens.token IS 'Push notification token';
COMMENT ON COLUMN user_push_tokens.platform IS 'Platform: web, ios, or android';
COMMENT ON COLUMN user_push_tokens.device_id IS 'Optional device identifier';
COMMENT ON COLUMN user_push_tokens.is_active IS 'Whether the token is currently active';
