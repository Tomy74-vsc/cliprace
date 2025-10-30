-- Fix RLS recursion issue in profiles table
-- The policy "Admins can view all profiles" was causing infinite recursion
-- because it queries the profiles table within its own policy condition

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a function to check if user is admin without causing recursion
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- Use auth.jwt() to get role from JWT token instead of querying profiles table
  -- This avoids the recursion issue
  RETURN COALESCE(
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin',
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a safer admin policy that doesn't cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        is_admin()
    );

-- Also create a policy for admins to manage profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (
        is_admin()
    );

-- Add comment explaining the fix
COMMENT ON POLICY "Admins can view all profiles" ON profiles IS 
'Admins can view all profiles using JWT metadata to avoid RLS recursion';

COMMENT ON POLICY "Admins can manage all profiles" ON profiles IS 
'Admins can manage all profiles using JWT metadata to avoid RLS recursion';
