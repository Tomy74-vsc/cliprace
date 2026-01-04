-- =====================================================
-- 41_admin_saved_views.sql
-- =====================================================
-- Saved admin views (filter presets) for the admin interface.
-- Admin-only: RLS policy is_admin(auth.uid()).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_saved_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  route text NOT NULL,
  name text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_saved_views_route ON public.admin_saved_views(route);
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_created_by ON public.admin_saved_views(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_created_at ON public.admin_saved_views(created_at DESC);

ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_saved_views_admin_all" ON public.admin_saved_views;
CREATE POLICY "admin_saved_views_admin_all" ON public.admin_saved_views
  FOR ALL USING (public.is_admin(auth.uid()));

