-- ============================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================
-- Create storage buckets for file uploads
-- Note: Buckets must be created in Supabase dashboard first
-- Then apply these policies via SQL Editor

-- ============================================
-- BUCKET CONFIGURATIONS
-- ============================================

-- Bucket: avatars
-- Purpose: Store user profile images and brand logos
-- Configuration:
--   - File size limit: 5MB
--   - Allowed formats: jpg, jpeg, png, webp
--   - Public read access
--   - User-specific upload permissions

-- Bucket: contest_assets
-- Purpose: Store contest cover images, visual assets, and rule documents
-- Configuration:
--   - File size limit: 10MB
--   - Allowed formats: jpg, jpeg, png, webp, pdf
--   - Public read access for active contests
--   - Brand owner upload permissions

-- Bucket: submission_content
-- Purpose: Store submission videos and thumbnails
-- Configuration:
--   - File size limit: 100MB for videos, 5MB for thumbnails
--   - Allowed formats: mp4, mov, avi, jpg, jpeg, png
--   - Public read access for approved submissions
--   - Creator upload permissions

-- Bucket: invoices
-- Purpose: Store payment invoices and receipts
-- Configuration:
--   - File size limit: 5MB
--   - Allowed formats: pdf
--   - Private access only
--   - Brand owner and admin access

-- ============================================
-- STORAGE POLICIES
-- ============================================
-- Note: RLS is already enabled on storage.objects by default
-- We only need to create the policies

-- ============================================
-- AVATARS BUCKET POLICIES
-- ============================================

-- Public read access for avatars
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Users can upload their own avatars
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own avatars
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatars
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND 
    auth.uid() IS NOT NULL AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- CONTEST ASSETS BUCKET POLICIES
-- ============================================

-- Public read access for contest assets
DROP POLICY IF EXISTS "Public can view contest assets" ON storage.objects;
CREATE POLICY "Public can view contest assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'contest_assets');

-- Brand owners can upload contest assets
DROP POLICY IF EXISTS "Brand owners can upload contest assets" ON storage.objects;
CREATE POLICY "Brand owners can upload contest assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contest_assets' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id::text = (storage.foldername(name))[1]
      AND contests.brand_id = auth.uid()
    )
  );

-- Brand owners can update their contest assets
DROP POLICY IF EXISTS "Brand owners can update their contest assets" ON storage.objects;
CREATE POLICY "Brand owners can update their contest assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'contest_assets' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id::text = (storage.foldername(name))[1]
      AND contests.brand_id = auth.uid()
    )
  );

-- Brand owners can delete their contest assets
DROP POLICY IF EXISTS "Brand owners can delete their contest assets" ON storage.objects;
CREATE POLICY "Brand owners can delete their contest assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'contest_assets' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id::text = (storage.foldername(name))[1]
      AND contests.brand_id = auth.uid()
    )
  );

-- ============================================
-- SUBMISSION CONTENT BUCKET POLICIES
-- ============================================

-- Public read access for approved submission content
DROP POLICY IF EXISTS "Public can view approved submission content" ON storage.objects;
CREATE POLICY "Public can view approved submission content" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'submission_content' AND
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id::text = (storage.foldername(name))[1]
      AND submissions.status = 'approved'
    )
  );

-- Creators can upload submission content
DROP POLICY IF EXISTS "Creators can upload submission content" ON storage.objects;
CREATE POLICY "Creators can upload submission content" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'submission_content' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id::text = (storage.foldername(name))[1]
      AND submissions.creator_id = auth.uid()
    )
  );

-- Creators can update their submission content
DROP POLICY IF EXISTS "Creators can update their submission content" ON storage.objects;
CREATE POLICY "Creators can update their submission content" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'submission_content' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id::text = (storage.foldername(name))[1]
      AND submissions.creator_id = auth.uid()
    )
  );

-- Creators can delete their submission content
DROP POLICY IF EXISTS "Creators can delete their submission content" ON storage.objects;
CREATE POLICY "Creators can delete their submission content" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'submission_content' AND 
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM submissions 
      WHERE submissions.id::text = (storage.foldername(name))[1]
      AND submissions.creator_id = auth.uid()
    )
  );

-- ============================================
-- INVOICES BUCKET POLICIES
-- ============================================

-- Brand owners can view their own invoices
DROP POLICY IF EXISTS "Brand owners can view their invoices" ON storage.objects;
CREATE POLICY "Brand owners can view their invoices" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM payments_brand 
      WHERE payments_brand.id::text = (storage.foldername(name))[1]
      AND payments_brand.brand_id = auth.uid()
    )
  );

-- Admins can view all invoices
DROP POLICY IF EXISTS "Admins can view all invoices" ON storage.objects;
CREATE POLICY "Admins can view all invoices" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'invoices' AND 
    auth.uid() IS NOT NULL AND
    is_admin()
  );

-- Only admins can upload invoices (system generated)
DROP POLICY IF EXISTS "Admins can upload invoices" ON storage.objects;
CREATE POLICY "Admins can upload invoices" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'invoices' AND 
    auth.uid() IS NOT NULL AND
    is_admin()
  );

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to generate unique file names
CREATE OR REPLACE FUNCTION generate_unique_filename(
  p_user_id UUID,
  p_original_name TEXT,
  p_bucket TEXT DEFAULT 'avatars'
)
RETURNS TEXT AS $$
DECLARE
  file_extension TEXT;
  timestamp_str TEXT;
  random_str TEXT;
  unique_filename TEXT;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_original_name IS NULL OR p_original_name = '' THEN
    RAISE EXCEPTION 'User ID and original name are required';
  END IF;
  
  -- Extract file extension (case insensitive)
  file_extension := COALESCE(
    CASE 
      WHEN position('.' in lower(p_original_name)) > 0 
      THEN substring(lower(p_original_name) from '\.([^.]*)$')
      ELSE ''
    END,
    ''
  );
  
  -- Generate timestamp and random string
  timestamp_str := to_char(NOW(), 'YYYYMMDDHH24MISS');
  random_str := substring(md5(random()::text) from 1 for 8);
  
  -- Create unique filename with proper folder structure
  unique_filename := p_user_id::text || '/' || timestamp_str || '_' || random_str;
  
  -- Add extension if present
  IF file_extension != '' THEN
    unique_filename := unique_filename || '.' || file_extension;
  END IF;
  
  RETURN unique_filename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get file URL
CREATE OR REPLACE FUNCTION get_file_url(
  p_bucket TEXT,
  p_file_path TEXT
)
RETURNS TEXT AS $$
DECLARE
  supabase_url TEXT;
BEGIN
  -- Validate inputs
  IF p_bucket IS NULL OR p_bucket = '' OR p_file_path IS NULL OR p_file_path = '' THEN
    RAISE EXCEPTION 'Bucket and file path are required';
  END IF;
  
  -- Get Supabase URL from settings or use default pattern
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url');
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: construct URL from current database
    supabase_url := 'your-project-ref.supabase.co';
  END;
  
  RETURN 'https://' || supabase_url || '/storage/v1/object/public/' || p_bucket || '/' || p_file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate file type for bucket
CREATE OR REPLACE FUNCTION validate_file_type(
  p_bucket TEXT,
  p_file_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  file_extension TEXT;
  allowed_extensions TEXT[];
BEGIN
  -- Extract file extension
  file_extension := lower(substring(p_file_name from '\.([^.]*)$'));
  
  -- Define allowed extensions per bucket
  CASE p_bucket
    WHEN 'avatars' THEN
      allowed_extensions := ARRAY['jpg', 'jpeg', 'png', 'webp'];
    WHEN 'contest_assets' THEN
      allowed_extensions := ARRAY['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    WHEN 'submission_content' THEN
      allowed_extensions := ARRAY['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png'];
    WHEN 'invoices' THEN
      allowed_extensions := ARRAY['pdf'];
    ELSE
      RETURN FALSE;
  END CASE;
  
  -- Check if extension is allowed
  RETURN file_extension = ANY(allowed_extensions);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get file size limit for bucket
CREATE OR REPLACE FUNCTION get_file_size_limit(p_bucket TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE p_bucket
    WHEN 'avatars' THEN
      RETURN 5 * 1024 * 1024; -- 5MB
    WHEN 'contest_assets' THEN
      RETURN 10 * 1024 * 1024; -- 10MB
    WHEN 'submission_content' THEN
      RETURN 100 * 1024 * 1024; -- 100MB
    WHEN 'invoices' THEN
      RETURN 5 * 1024 * 1024; -- 5MB
    ELSE
      RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
