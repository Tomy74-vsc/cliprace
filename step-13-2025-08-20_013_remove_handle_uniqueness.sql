-- Remove unique constraints on personal information fields
-- This allows multiple users to have the same personal information
-- while maintaining email uniqueness for authentication

-- Remove unique constraint on handle in profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_handle_key;

-- Remove unique constraint on handle in profiles_creator table  
ALTER TABLE profiles_creator DROP CONSTRAINT IF EXISTS profiles_creator_handle_key;

-- Add a comment explaining the change
COMMENT ON COLUMN profiles.handle IS 'Creator handle - no longer unique to allow multiple users with same handle';
COMMENT ON COLUMN profiles_creator.handle IS 'Creator handle - no longer unique to allow multiple users with same handle';

-- Create a non-unique index for performance instead
CREATE INDEX IF NOT EXISTS idx_profiles_handle_non_unique ON profiles(handle) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_creator_handle_non_unique ON profiles_creator(handle) WHERE handle IS NOT NULL;

-- Add a function to generate unique handles when needed
CREATE OR REPLACE FUNCTION generate_unique_handle(base_handle TEXT)
RETURNS TEXT AS $$
DECLARE
    unique_handle TEXT;
    counter INTEGER := 1;
BEGIN
    unique_handle := base_handle;
    
    -- Check if handle exists and append number if needed
    WHILE EXISTS (
        SELECT 1 FROM profiles 
        WHERE handle = unique_handle 
        AND id != auth.uid()
    ) LOOP
        unique_handle := base_handle || '_' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN unique_handle;
END;
$$ LANGUAGE plpgsql;

-- Add a function to validate handle format
CREATE OR REPLACE FUNCTION validate_handle_format(handle_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Handle must be 3-30 characters, alphanumeric, dots, underscores, hyphens only
    RETURN handle_text ~ '^[a-zA-Z0-9._-]{3,30}$';
END;
$$ LANGUAGE plpgsql;

-- Update the existing constraint to use the new validation function
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE profiles ADD CONSTRAINT profiles_handle_format CHECK (handle IS NULL OR validate_handle_format(handle));

ALTER TABLE profiles_creator DROP CONSTRAINT IF EXISTS profiles_creator_handle_format;
ALTER TABLE profiles_creator ADD CONSTRAINT profiles_creator_handle_format CHECK (handle IS NULL OR validate_handle_format(handle));
