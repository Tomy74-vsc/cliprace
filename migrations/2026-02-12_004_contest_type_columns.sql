-- =====================================================
-- 2026-02-12_004_contest_type_columns.sql
-- =====================================================
-- Adds contest_type, product_details, shipping_info, platform_fee to contests table
-- and updates the create_contest_complete RPC to accept these params.
-- Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================

-- 1) Add columns (idempotent via DO block)
DO $$
BEGIN
  -- contest_type: 'cash' (default) or 'product'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'contest_type'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN contest_type text NOT NULL DEFAULT 'cash';
    ALTER TABLE public.contests ADD CONSTRAINT contests_valid_type CHECK (contest_type IN ('cash', 'product'));
  END IF;

  -- product_details: JSONB for product contests (name, value, image_url, brand_url)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'product_details'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN product_details jsonb DEFAULT NULL;
  END IF;

  -- shipping_info: JSONB for product contests (shipping_type, regions)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'shipping_info'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN shipping_info jsonb DEFAULT NULL;
  END IF;

  -- platform_fee: integer in cents (for product contests, e.g. 5000 = 50 EUR)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN platform_fee integer NOT NULL DEFAULT 0;
    ALTER TABLE public.contests ADD CONSTRAINT contests_positive_platform_fee CHECK (platform_fee >= 0);
  END IF;
END
$$;

-- 2) Update the RPC to accept and store new params
CREATE OR REPLACE FUNCTION public.create_contest_complete(
  p_brand_id uuid,
  p_title text,
  p_slug text,
  p_brief_md text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_prize_pool_cents integer,
  p_cover_url text DEFAULT NULL,
  p_currency text DEFAULT 'EUR',
  p_networks platform[] DEFAULT ARRAY[]::platform[],
  p_max_winners integer DEFAULT 1,
  p_terms_version text DEFAULT NULL,
  p_terms_markdown text DEFAULT NULL,
  p_terms_url text DEFAULT NULL,
  p_assets jsonb DEFAULT '[]'::jsonb,
  p_prizes jsonb DEFAULT '[]'::jsonb,
  p_budget_cents integer DEFAULT NULL,
  -- New params for cash/product contest model
  p_contest_type text DEFAULT 'cash',
  p_product_details jsonb DEFAULT NULL,
  p_shipping_info jsonb DEFAULT NULL,
  p_platform_fee integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_contest_id uuid;
  v_terms_id uuid;
  v_terms_version text;
  v_budget integer;
  v_max_winners integer;
BEGIN
  IF p_brand_id IS NULL THEN
    RAISE EXCEPTION 'Brand id is required';
  END IF;

  -- Validate contest_type
  IF p_contest_type NOT IN ('cash', 'product') THEN
    RAISE EXCEPTION 'Invalid contest type: %. Must be cash or product.', p_contest_type;
  END IF;

  v_budget := COALESCE(p_budget_cents, p_prize_pool_cents, 0);
  v_max_winners := GREATEST(COALESCE(p_max_winners, 1), 1);

  -- Create terms version if provided (markdown or URL)
  IF COALESCE(p_terms_markdown, p_terms_url) IS NOT NULL THEN
    v_terms_version := COALESCE(
      p_terms_version,
      CONCAT('contest-', p_slug, '-', to_char(NOW(), 'YYYYMMDDHH24MISS'))
    );

    INSERT INTO public.contest_terms (version, terms_markdown, terms_url, is_active)
    VALUES (v_terms_version, p_terms_markdown, p_terms_url, true)
    ON CONFLICT (version) DO UPDATE
      SET terms_markdown = EXCLUDED.terms_markdown,
          terms_url = EXCLUDED.terms_url,
          is_active = EXCLUDED.is_active
    RETURNING id INTO v_terms_id;
  END IF;

  INSERT INTO public.contests (
    brand_id,
    title,
    slug,
    brief_md,
    cover_url,
    status,
    budget_cents,
    prize_pool_cents,
    currency,
    start_at,
    end_at,
    networks,
    max_winners,
    contest_terms_id,
    contest_type,
    product_details,
    shipping_info,
    platform_fee
  )
  VALUES (
    p_brand_id,
    p_title,
    p_slug,
    p_brief_md,
    p_cover_url,
    'draft',
    v_budget,
    p_prize_pool_cents,
    COALESCE(NULLIF(TRIM(p_currency), ''), 'EUR'),
    p_start_at,
    p_end_at,
    COALESCE(p_networks, ARRAY[]::platform[]),
    v_max_winners,
    v_terms_id,
    COALESCE(p_contest_type, 'cash'),
    p_product_details,
    p_shipping_info,
    COALESCE(p_platform_fee, 0)
  )
  RETURNING id INTO v_contest_id;

  -- Insert assets
  IF p_assets IS NOT NULL AND jsonb_array_length(p_assets) > 0 THEN
    INSERT INTO public.contest_assets (contest_id, url, type)
    SELECT v_contest_id, elem->>'url', COALESCE(elem->>'type', 'image')
    FROM jsonb_array_elements(p_assets) elem;
  END IF;

  -- Insert prizes
  IF p_prizes IS NOT NULL AND jsonb_array_length(p_prizes) > 0 THEN
    INSERT INTO public.contest_prizes (contest_id, position, amount_cents, percentage)
    SELECT
      v_contest_id,
      (elem->>'position')::integer,
      NULLIF((elem->>'amount_cents')::integer, 0),
      NULLIF((elem->>'percentage')::numeric, 0)
    FROM jsonb_array_elements(p_prizes) elem;
  END IF;

  RETURN v_contest_id;
END;
$function$;

COMMENT ON FUNCTION public.create_contest_complete(
  uuid, text, text, text, timestamptz, timestamptz, integer, text, text, platform[], integer,
  text, text, text, jsonb, jsonb, integer, text, jsonb, jsonb, integer
) IS 'Creates a contest draft atomically (contests + terms + assets + prizes) with cash/product type support. Returns the contest id.';
