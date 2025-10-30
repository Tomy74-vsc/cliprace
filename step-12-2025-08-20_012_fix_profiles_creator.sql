-- Fix profiles_creator table by adding missing description column
-- This migration addresses the schema mismatch error

-- Add description column to profiles_creator if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles_creator' 
        AND column_name = 'description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles_creator ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add any other missing columns that might be needed
DO $$ 
BEGIN
    -- Add first_name and last_name if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles_creator' 
        AND column_name = 'first_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles_creator ADD COLUMN first_name TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles_creator' 
        AND column_name = 'last_name'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE profiles_creator ADD COLUMN last_name TEXT;
    END IF;
END $$;

-- Update the comment on the table
COMMENT ON TABLE profiles_creator IS 'Creator-specific profile information with all required fields';
