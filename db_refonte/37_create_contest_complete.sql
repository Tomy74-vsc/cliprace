-- =====================================================
-- 37_create_contest_complete.sql (corrigé)
-- =====================================================
-- Fonction transactionnelle pour créer un concours complet
-- (contests + contest_terms + contest_assets + contest_prizes)
-- Idempotent : CREATE OR REPLACE FUNCTION
-- =====================================================

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
  p_budget_cents integer DEFAULT NULL
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

  v_budget := COALESCE(p_budget_cents, p_prize_pool_cents, 0);
  v_max_winners := GREATEST(COALESCE(p_max_winners, 1), 1);

  -- Créer une version des CGU si fournie (markdown ou URL)
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
    contest_terms_id
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
    v_terms_id
  )
  RETURNING id INTO v_contest_id;

  -- Assets optionnels
  IF jsonb_typeof(p_assets) = 'array' THEN
    INSERT INTO public.contest_assets (contest_id, url, type)
    SELECT
      v_contest_id,
      asset->>'url',
      COALESCE(NULLIF(asset->>'type', ''), 'image')
    FROM jsonb_array_elements(p_assets) AS asset
    WHERE asset ? 'url'
      AND COALESCE(NULLIF(asset->>'type', ''), 'image') IN ('image', 'video', 'pdf');
  END IF;

  -- Prix optionnels
  IF jsonb_typeof(p_prizes) = 'array' THEN
    INSERT INTO public.contest_prizes (contest_id, position, amount_cents, percentage)
    SELECT
      v_contest_id,
      (prize->>'position')::integer,
      NULLIF((prize->>'amount_cents')::integer, 0),
      NULLIF((prize->>'percentage')::numeric, 0)
    FROM jsonb_array_elements(p_prizes) AS prize
    WHERE prize ? 'position';
  END IF;

  RETURN v_contest_id;
END;
$function$;

COMMENT ON FUNCTION public.create_contest_complete(
  uuid, text, text, text, timestamptz, timestamptz, integer, text, text, platform[], integer,
  text, text, text, jsonb, jsonb, integer
) IS 'Crée un concours complet (contests + contest_terms + contest_assets + contest_prizes) de manière atomique et retourne l''id';