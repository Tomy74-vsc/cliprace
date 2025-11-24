-- =====================================================
-- 13_seed_minimal.sql
-- =====================================================
-- Données de seed minimales pour développement/test
-- Idempotent : INSERT ... ON CONFLICT DO NOTHING
-- ATTENTION : Ce fichier est commenté par défaut
-- Ne pas insérer dans auth.users (géré par Supabase Auth)
-- =====================================================

/*
-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
-- 1. Les utilisateurs doivent être créés via Supabase Auth (interface ou API)
-- 2. Remplacez les UUIDs ci-dessous par les UUIDs réels de vos utilisateurs auth.users
-- 3. Exécutez ce fichier uniquement en environnement de développement
-- =====================================================

-- Exemple de seed (à décommenter et adapter) :
-- Remplacez les UUIDs par ceux de vos utilisateurs créés via Supabase Auth

-- 1. Créer un admin (remplacer 'admin-user-uuid' par l'UUID réel)
INSERT INTO public.profiles (id, role, email, display_name, is_active)
VALUES (
  'admin-user-uuid'::uuid,
  'admin',
  'admin@cliprace.com',
  'Admin ClipRace',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Créer 2 marques
INSERT INTO public.profiles (id, role, email, display_name, is_active)
VALUES 
  ('brand-1-uuid'::uuid, 'brand', 'brand1@example.com', 'Brand One', true),
  ('brand-2-uuid'::uuid, 'brand', 'brand2@example.com', 'Brand Two', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_brands (user_id, company_name, website, industry)
VALUES 
  ('brand-1-uuid'::uuid, 'Brand One Inc.', 'https://brand1.com', 'Fashion'),
  ('brand-2-uuid'::uuid, 'Brand Two Ltd.', 'https://brand2.com', 'Tech')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Créer 3 créateurs
INSERT INTO public.profiles (id, role, email, display_name, is_active)
VALUES 
  ('creator-1-uuid'::uuid, 'creator', 'creator1@example.com', 'Creator One', true),
  ('creator-2-uuid'::uuid, 'creator', 'creator2@example.com', 'Creator Two', true),
  ('creator-3-uuid'::uuid, 'creator', 'creator3@example.com', 'Creator Three', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profile_creators (user_id, first_name, last_name, handle, primary_platform, followers, avg_views)
VALUES 
  ('creator-1-uuid'::uuid, 'John', 'Doe', '@creator1', 'tiktok', 10000, 50000),
  ('creator-2-uuid'::uuid, 'Jane', 'Smith', '@creator2', 'instagram', 5000, 25000),
  ('creator-3-uuid'::uuid, 'Bob', 'Johnson', '@creator3', 'youtube', 20000, 100000)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Créer 1 concours actif
INSERT INTO public.contests (
  id,
  brand_id,
  title,
  slug,
  brief_md,
  status,
  budget_cents,
  prize_pool_cents,
  start_at,
  end_at,
  networks,
  max_winners
)
VALUES (
  'contest-1-uuid'::uuid,
  'brand-1-uuid'::uuid,
  'Summer Fashion Contest',
  'summer-fashion-contest',
  'Create a video showcasing your summer fashion style!',
  'active',
  100000, -- 1000 EUR
  50000,  -- 500 EUR
  public.now_utc() - INTERVAL '1 day',
  public.now_utc() + INTERVAL '30 days',
  ARRAY['tiktok', 'instagram']::platform[],
  3
)
ON CONFLICT (id) DO NOTHING;

-- 5. Créer quelques soumissions
INSERT INTO public.submissions (
  id,
  contest_id,
  creator_id,
  platform,
  external_url,
  title,
  status,
  submitted_at,
  approved_at
)
VALUES 
  (
    'submission-1-uuid'::uuid,
    'contest-1-uuid'::uuid,
    'creator-1-uuid'::uuid,
    'tiktok',
    'https://tiktok.com/@creator1/video/123',
    'My Summer Look',
    'approved',
    public.now_utc() - INTERVAL '1 day',
    public.now_utc() - INTERVAL '12 hours'
  ),
  (
    'submission-2-uuid'::uuid,
    'contest-1-uuid'::uuid,
    'creator-2-uuid'::uuid,
    'instagram',
    'https://instagram.com/p/abc123',
    'Summer Vibes',
    'approved',
    public.now_utc() - INTERVAL '12 hours',
    public.now_utc() - INTERVAL '6 hours'
  ),
  (
    'submission-3-uuid'::uuid,
    'contest-1-uuid'::uuid,
    'creator-3-uuid'::uuid,
    'youtube',
    'https://youtube.com/watch?v=xyz789',
    'Summer Style Guide',
    'pending',
    public.now_utc() - INTERVAL '6 hours',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Créer quelques métriques
INSERT INTO public.metrics_daily (submission_id, metric_date, views, likes, comments, shares, weighted_views)
VALUES 
  ('submission-1-uuid'::uuid, CURRENT_DATE - INTERVAL '1 day', 1000, 50, 10, 5, 1250.00),
  ('submission-1-uuid'::uuid, CURRENT_DATE, 1500, 75, 15, 8, 1875.00),
  ('submission-2-uuid'::uuid, CURRENT_DATE - INTERVAL '1 day', 800, 40, 8, 4, 1000.00),
  ('submission-2-uuid'::uuid, CURRENT_DATE, 1200, 60, 12, 6, 1500.00)
ON CONFLICT (submission_id, metric_date) DO NOTHING;

*/

-- Message de fin
DO $$ 
BEGIN
  RAISE NOTICE 'Seed file loaded. Uncomment and adapt UUIDs before running.';
END $$;
