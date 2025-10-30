-- Fix RLS policies to prevent infinite recursion
-- This migration cleans up conflicting policies and creates safe ones

-- 1. Drop all existing policies on profiles table to start clean
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
DROP POLICY IF EXISTS "Public can view verified profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- 2. Drop all existing policies on profiles_creator table
DROP POLICY IF EXISTS "Users can view their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can insert their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can update their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can delete their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Public can view creator profiles" ON profiles_creator;

-- 3. Drop all existing policies on profiles_brand table
DROP POLICY IF EXISTS "Users can view their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can insert their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can update their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can delete their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Public can view brand profiles" ON profiles_brand;

-- 4. Create safe helper functions that don't cause recursion
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Use JWT metadata to avoid querying profiles table
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_creator(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Use JWT metadata to avoid querying profiles table
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'creator',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_brand(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Use JWT metadata to avoid querying profiles table
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'brand',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create safe RLS policies for profiles table
-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

-- Users can insert their own profile (for registration)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
    AND email = auth.jwt() ->> 'email'
    AND role IN ('creator', 'brand', 'admin')
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = id 
    AND email = auth.jwt() ->> 'email'
  );

-- Users can delete their own profile
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

-- Public can view verified profiles (for discovery)
DROP POLICY IF EXISTS "Public can view verified profiles" ON profiles;
CREATE POLICY "Public can view verified profiles" ON profiles
  FOR SELECT USING (
    is_verified = TRUE 
    AND is_active = TRUE
  );

-- Admins can view all profiles (using JWT metadata to avoid recursion)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    is_admin()
  );

-- Admins can manage all profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    is_admin()
  );

-- 6. Create safe RLS policies for profiles_creator table
DROP POLICY IF EXISTS "Users can view their own creator profile" ON profiles_creator;
CREATE POLICY "Users can view their own creator profile" ON profiles_creator
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own creator profile" ON profiles_creator;
CREATE POLICY "Users can insert their own creator profile" ON profiles_creator
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
    AND is_creator()
  );

DROP POLICY IF EXISTS "Users can update their own creator profile" ON profiles_creator;
CREATE POLICY "Users can update their own creator profile" ON profiles_creator
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own creator profile" ON profiles_creator;
CREATE POLICY "Users can delete their own creator profile" ON profiles_creator
  FOR DELETE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Public can view creator profiles (for discovery)
DROP POLICY IF EXISTS "Public can view creator profiles" ON profiles_creator;
CREATE POLICY "Public can view creator profiles" ON profiles_creator
  FOR SELECT USING (TRUE);

-- 7. Create safe RLS policies for profiles_brand table
DROP POLICY IF EXISTS "Users can view their own brand profile" ON profiles_brand;
CREATE POLICY "Users can view their own brand profile" ON profiles_brand
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own brand profile" ON profiles_brand;
CREATE POLICY "Users can insert their own brand profile" ON profiles_brand
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
    AND is_brand()
  );

DROP POLICY IF EXISTS "Users can update their own brand profile" ON profiles_brand;
CREATE POLICY "Users can update their own brand profile" ON profiles_brand
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own brand profile" ON profiles_brand;
CREATE POLICY "Users can delete their own brand profile" ON profiles_brand
  FOR DELETE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Public can view brand profiles (for discovery)
DROP POLICY IF EXISTS "Public can view brand profiles" ON profiles_brand;
CREATE POLICY "Public can view brand profiles" ON profiles_brand
  FOR SELECT USING (TRUE);

-- 8. Add comments for documentation
COMMENT ON POLICY "Users can view their own profile" ON profiles IS 
'Safe policy: users can only view their own profile using auth.uid()';

COMMENT ON POLICY "Users can insert their own profile" ON profiles IS 
'Safe policy: users can only insert their own profile during registration';

COMMENT ON POLICY "Public can view verified profiles" ON profiles IS 
'Safe policy: public can view verified and active profiles for discovery';

COMMENT ON POLICY "Admins can view all profiles" ON profiles IS 
'Safe policy: admins can view all profiles using JWT metadata to avoid recursion';

-- 9. Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_creator ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_brand ENABLE ROW LEVEL SECURITY;
