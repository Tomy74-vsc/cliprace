-- Create unified profiles table (replaces separate creator/brand tables)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  
  -- Common fields
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  profile_image_url TEXT,
  country TEXT DEFAULT 'FR',
  
  -- Creator specific fields
  first_name TEXT,
  last_name TEXT,
  handle TEXT UNIQUE,
  bio TEXT,
  primary_network network_enum DEFAULT 'tiktok',
  avg_views_30d INTEGER DEFAULT 0,
  followers_total INTEGER DEFAULT 0,
  social_media JSONB DEFAULT '{}'::jsonb,
  
  -- Brand specific fields
  company_name TEXT,
  legal_name TEXT,
  vat_number TEXT,
  address TEXT,
  city TEXT,
  industry TEXT,
  company_size TEXT,
  logo_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create separate profile tables for backward compatibility and specific queries
CREATE TABLE IF NOT EXISTS profiles_creator (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL,
  bio TEXT,
  description TEXT,
  country TEXT DEFAULT 'FR',
  primary_network network_enum DEFAULT 'tiktok',
  avg_views_30d INTEGER DEFAULT 0,
  followers_total INTEGER DEFAULT 0,
  social_media JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles_brand (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  vat_number TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'FR',
  website TEXT,
  logo_url TEXT,
  industry TEXT,
  company_size TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_company_name ON profiles(company_name) WHERE company_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);

CREATE INDEX IF NOT EXISTS idx_profiles_creator_handle ON profiles_creator(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_creator_primary_network ON profiles_creator(primary_network);
CREATE INDEX IF NOT EXISTS idx_profiles_creator_followers ON profiles_creator(followers_total);

CREATE INDEX IF NOT EXISTS idx_profiles_brand_company_name ON profiles_brand(company_name);
CREATE INDEX IF NOT EXISTS idx_profiles_brand_industry ON profiles_brand(industry);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_creator ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_brand ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- Public read access for verified profiles
DROP POLICY IF EXISTS "Public can view verified profiles" ON profiles;
CREATE POLICY "Public can view verified profiles" ON profiles
  FOR SELECT USING (is_verified = TRUE AND is_active = TRUE);

-- Creator profiles policies
DROP POLICY IF EXISTS "Users can view their own creator profile" ON profiles_creator;
CREATE POLICY "Users can view their own creator profile" ON profiles_creator
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own creator profile" ON profiles_creator;
CREATE POLICY "Users can insert their own creator profile" ON profiles_creator
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own creator profile" ON profiles_creator;
CREATE POLICY "Users can update their own creator profile" ON profiles_creator
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own creator profile" ON profiles_creator;
CREATE POLICY "Users can delete their own creator profile" ON profiles_creator
  FOR DELETE USING (auth.uid() = user_id);

-- Public read access for creator profiles
DROP POLICY IF EXISTS "Public can view creator profiles" ON profiles_creator;
CREATE POLICY "Public can view creator profiles" ON profiles_creator
  FOR SELECT USING (TRUE);

-- Brand profiles policies
DROP POLICY IF EXISTS "Users can view their own brand profile" ON profiles_brand;
CREATE POLICY "Users can view their own brand profile" ON profiles_brand
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own brand profile" ON profiles_brand;
CREATE POLICY "Users can insert their own brand profile" ON profiles_brand
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own brand profile" ON profiles_brand;
CREATE POLICY "Users can update their own brand profile" ON profiles_brand
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own brand profile" ON profiles_brand;
CREATE POLICY "Users can delete their own brand profile" ON profiles_brand
  FOR DELETE USING (auth.uid() = user_id);

-- Public read access for brand profiles
DROP POLICY IF EXISTS "Public can view brand profiles" ON profiles_brand;
CREATE POLICY "Public can view brand profiles" ON profiles_brand
  FOR SELECT USING (TRUE);

-- Function to check if user is creator
CREATE OR REPLACE FUNCTION is_creator(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = is_creator.user_id 
    AND role = 'creator'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is brand
CREATE OR REPLACE FUNCTION is_brand(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = is_brand.user_id 
    AND role = 'brand'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS user_role AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT role INTO user_role_val
  FROM profiles 
  WHERE profiles.id = get_user_role.user_id;
  
  RETURN user_role_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  auth.uid() = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_creator_updated_at
  BEFORE UPDATE ON profiles_creator
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_brand_updated_at
  BEFORE UPDATE ON profiles_brand
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
