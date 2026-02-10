-- Migration: add contest_type and product fields to contests
-- Date: 2026-02-09

-- 1) Add enum type for contest_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'contest_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.contest_type AS ENUM ('cash', 'product');
  END IF;
END $$;

-- 2) Add columns to contests table if they don't already exist
DO $$
BEGIN
  -- contest_type
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contests'
      AND column_name = 'contest_type'
  ) THEN
    ALTER TABLE public.contests
      ADD COLUMN contest_type public.contest_type NOT NULL DEFAULT 'cash';
  END IF;

  -- product_details
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contests'
      AND column_name = 'product_details'
  ) THEN
    ALTER TABLE public.contests
      ADD COLUMN product_details jsonb;

    COMMENT ON COLUMN public.contests.product_details IS
      'Structured product info for product contests: { name: text, value: numeric, image_url: text, brand_url?: text }';
  END IF;

  -- shipping_info
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contests'
      AND column_name = 'shipping_info'
  ) THEN
    ALTER TABLE public.contests
      ADD COLUMN shipping_info jsonb;

    COMMENT ON COLUMN public.contests.shipping_info IS
      'Shipping details for product contests: { shipping_type: ''brand_managed'', regions: text[] }';
  END IF;

  -- platform_fee
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contests'
      AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE public.contests
      ADD COLUMN platform_fee integer DEFAULT 0;

    COMMENT ON COLUMN public.contests.platform_fee IS
      'Platform fee (in cents) charged upfront for product contests (e.g. 5000 = 50€).';
  END IF;
END $$;

