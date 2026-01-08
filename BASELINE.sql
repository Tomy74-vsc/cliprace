-- =====================================================
-- BASELINE.sql (generated)
-- =====================================================
-- Canonical baseline for Supabase/Postgres (schema + RLS + storage + core functions).
-- Source: db_refonte/*.sql + migrations/*.sql (with a few safety patches appended).
-- NOTE: Some legacy scripts are intentionally NOT included: 00_platform_settings_readonly.sql, 51_admin_transactions.sql, 52_admin_kpi_materialized.sql, 53_admin_indexes_search.sql, 12c/12e contest_assets hotfixes.
-- =====================================================


-- ------------------------------
-- BEGIN 00_extensions_enums.sql
-- ------------------------------
-- =====================================================
-- 00_extensions_enums.sql
-- =====================================================
-- Extensions PostgreSQL et types énumérés
-- Idempotent : utilise DO $$ BEGIN ... EXCEPTION ... END $$;
-- =====================================================

-- Extensions nécessaires
DO $$ 
BEGIN
  -- uuid-ossp : pour uuid_generate_v4() (alternative à gen_random_uuid())
  -- Note : gen_random_uuid() de pgcrypto est préféré pour meilleures performances
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  -- pgcrypto : pour gen_random_uuid() et fonctions cryptographiques
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  -- citext pour comparaisons de texte insensibles à la casse (optionnel)
  CREATE EXTENSION IF NOT EXISTS "citext";
EXCEPTION 
  WHEN OTHERS THEN
    RAISE NOTICE 'Extensions already exist or cannot be created: %', SQLERRM;
END $$;

-- Types énumérés
DO $$ 
BEGIN
  -- user_role : admin, brand, creator
  CREATE TYPE user_role AS ENUM ('admin', 'brand', 'creator');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- contest_status : draft, active, paused, ended, archived
  CREATE TYPE contest_status AS ENUM ('draft', 'active', 'paused', 'ended', 'archived');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- submission_status : pending, approved, rejected, removed
  CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'removed');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- payment_status : requires_payment, processing, succeeded, failed, refunded
  CREATE TYPE payment_status AS ENUM ('requires_payment', 'processing', 'succeeded', 'failed', 'refunded');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- cashout_status : requested, processing, paid, failed, canceled
  CREATE TYPE cashout_status AS ENUM ('requested', 'processing', 'paid', 'failed', 'canceled');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  -- platform : tiktok, instagram, youtube, x
  CREATE TYPE platform AS ENUM ('tiktok', 'instagram', 'youtube', 'x');
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

-- Commentaires pour documentation
COMMENT ON TYPE user_role IS 'Rôles utilisateurs : admin, brand, creator';
COMMENT ON TYPE contest_status IS 'Statuts de concours : draft, active, paused, ended, archived';
COMMENT ON TYPE submission_status IS 'Statuts de soumission : pending, approved, rejected, removed';
COMMENT ON TYPE payment_status IS 'Statuts de paiement : requires_payment, processing, succeeded, failed, refunded';
COMMENT ON TYPE cashout_status IS 'Statuts de cashout : requested, processing, paid, failed, canceled';
COMMENT ON TYPE platform IS 'Plateformes sociales : tiktok, instagram, youtube, x';
-- ------------------------------
-- END 00_extensions_enums.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 02_profiles.sql
-- ------------------------------
-- =====================================================
-- 02_profiles.sql
-- =====================================================
-- Tables de profils utilisateurs (profiles, profile_brands, profile_creators)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table principale profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email citext NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  country text DEFAULT 'FR',
  is_active boolean DEFAULT true NOT NULL,
  onboarding_complete boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table profile_brands : détails spécifiques marques
CREATE TABLE IF NOT EXISTS public.profile_brands (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  vat_number text,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_postal_code text,
  address_country text DEFAULT 'FR',
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table profile_creators : détails spécifiques créateurs
CREATE TABLE IF NOT EXISTS public.profile_creators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  handle text,
  primary_platform platform DEFAULT 'tiktok',
  followers integer DEFAULT 0,
  avg_views integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON public.profiles(role, is_active);

-- Index sur profile_creators
CREATE INDEX IF NOT EXISTS idx_profile_creators_handle ON public.profile_creators(handle) WHERE handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_creators_primary_platform ON public.profile_creators(primary_platform);

-- Index sur profile_brands
CREATE INDEX IF NOT EXISTS idx_profile_brands_company_name ON public.profile_brands(company_name);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_creators ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.profiles IS 'Table principale des profils utilisateurs (admin, brand, creator)';
COMMENT ON TABLE public.profile_brands IS 'Détails spécifiques des marques';
COMMENT ON TABLE public.profile_creators IS 'Détails spécifiques des créateurs';
COMMENT ON COLUMN public.profiles.id IS 'UUID de l''utilisateur (référence auth.users)';
COMMENT ON COLUMN public.profiles.role IS 'Rôle de l''utilisateur (admin, brand, creator)';
COMMENT ON COLUMN public.profiles.email IS 'Email de l''utilisateur (citext pour comparaison insensible à la casse)';
-- ------------------------------
-- END 02_profiles.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 01_functions_core.sql
-- ------------------------------
-- =====================================================
-- 01_functions_core.sql
-- =====================================================
-- Fonctions core utilitaires
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction now_utc() : uniformise le temps en UTC
CREATE OR REPLACE FUNCTION public.now_utc()
RETURNS timestamptz 
LANGUAGE sql 
STABLE 
AS $$
  SELECT timezone('utc', now());
$$;

COMMENT ON FUNCTION public.now_utc() IS 'Retourne la date/heure actuelle en UTC';

-- Fonction is_admin() : vérifie si un utilisateur est admin
-- IMPORTANT : stable et non récursive (lit profiles par id direct)
-- Utilise SECURITY DEFINER pour éviter les problèmes RLS
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_admin.uid 
    AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS 'Vérifie si un utilisateur est admin (stable, non récursive)';

-- Fonction get_user_role() : obtient le rôle d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid DEFAULT auth.uid())
RETURNS user_role 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.profiles 
  WHERE id = get_user_role.uid;
$$;

COMMENT ON FUNCTION public.get_user_role(uuid) IS 'Retourne le rôle d''un utilisateur (admin, brand, creator)';

-- Fonction is_creator() : vérifie si un utilisateur est créateur
CREATE OR REPLACE FUNCTION public.is_creator(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_creator.uid 
    AND role = 'creator'
  );
$$;

COMMENT ON FUNCTION public.is_creator(uuid) IS 'Vérifie si un utilisateur est créateur';

-- Fonction is_brand() : vérifie si un utilisateur est marque
CREATE OR REPLACE FUNCTION public.is_brand(uid uuid DEFAULT auth.uid())
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = is_brand.uid 
    AND role = 'brand'
  );
$$;

COMMENT ON FUNCTION public.is_brand(uuid) IS 'Vérifie si un utilisateur est marque';
-- ------------------------------
-- END 01_functions_core.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 03_contests.sql
-- ------------------------------
-- =====================================================
-- 03_contests.sql
-- =====================================================
-- Tables de concours (contests, contest_terms, contest_assets)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table contest_terms : versions des CGU
CREATE TABLE IF NOT EXISTS public.contest_terms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  terms_markdown text,
  terms_url text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  UNIQUE(version)
);

-- Table contests : concours créés par les marques
CREATE TABLE IF NOT EXISTS public.contests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  brief_md text,
  cover_url text,
  status contest_status NOT NULL DEFAULT 'draft',
  budget_cents integer NOT NULL DEFAULT 0,
  prize_pool_cents integer NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  networks platform[] DEFAULT ARRAY[]::platform[],
  max_winners integer DEFAULT 1,
  contest_terms_id uuid REFERENCES public.contest_terms(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT contests_ends_after_starts CHECK (end_at > start_at),
  CONSTRAINT contests_positive_budget CHECK (budget_cents >= 0),
  CONSTRAINT contests_positive_prize CHECK (prize_pool_cents >= 0),
  CONSTRAINT contests_max_winners_positive CHECK (max_winners > 0)
);

-- Table contest_assets : assets associés aux concours (images, vidéos, PDFs)
CREATE TABLE IF NOT EXISTS public.contest_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video', 'pdf')),
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur contests
CREATE INDEX IF NOT EXISTS idx_contests_brand_id ON public.contests(brand_id);
CREATE INDEX IF NOT EXISTS idx_contests_status ON public.contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_start_at ON public.contests(start_at);
CREATE INDEX IF NOT EXISTS idx_contests_brand_status ON public.contests(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_contests_active_dates ON public.contests(start_at, end_at) WHERE status = 'active';

-- Index sur contest_assets
CREATE INDEX IF NOT EXISTS idx_contest_assets_contest_id ON public.contest_assets(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_assets_type ON public.contest_assets(type);

-- Enable RLS
ALTER TABLE public.contest_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_assets ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contests IS 'Concours créés par les marques';
COMMENT ON TABLE public.contest_terms IS 'Versions des conditions générales d''utilisation des concours';
COMMENT ON TABLE public.contest_assets IS 'Assets associés aux concours (images, vidéos, PDFs)';
COMMENT ON COLUMN public.contests.slug IS 'Slug unique pour l''URL du concours';
COMMENT ON COLUMN public.contests.networks IS 'Tableau des plateformes acceptées pour ce concours';
COMMENT ON COLUMN public.contests.max_winners IS 'Nombre maximum de gagnants';
-- ------------------------------
-- END 03_contests.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 04_submissions_metrics.sql
-- ------------------------------
-- =====================================================
-- 04_submissions_metrics.sql
-- =====================================================
-- Tables de soumissions et métriques (submissions, metrics_daily)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table submissions : soumissions des créateurs
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  platform platform NOT NULL,
  external_url text NOT NULL,
  external_post_id text,
  thumbnail_url text,
  title text,
  status submission_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz DEFAULT NOW() NOT NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Unicité : un créateur ne peut pas soumettre la même URL deux fois pour un concours
  UNIQUE(contest_id, creator_id, external_url)
);

-- Table metrics_daily : métriques quotidiennes des soumissions
CREATE TABLE IF NOT EXISTS public.metrics_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  weighted_views numeric(12, 2) DEFAULT 0,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Une seule métrique par soumission et par date
  UNIQUE(submission_id, metric_date)
);

-- Index sur submissions
CREATE INDEX IF NOT EXISTS idx_submissions_contest_id ON public.submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON public.submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_contest_status ON public.submissions(contest_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_status ON public.submissions(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_platform ON public.submissions(platform);

-- Index sur metrics_daily
CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_id ON public.metrics_daily(submission_id);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON public.metrics_daily(metric_date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_submission_date ON public.metrics_daily(submission_id, metric_date DESC);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.submissions IS 'Soumissions des créateurs pour les concours';
COMMENT ON TABLE public.metrics_daily IS 'Métriques quotidiennes des soumissions (views, likes, comments, shares)';
COMMENT ON COLUMN public.submissions.external_url IS 'URL externe du post (TikTok, Instagram, YouTube, X)';
COMMENT ON COLUMN public.submissions.external_post_id IS 'ID du post sur la plateforme externe';
COMMENT ON COLUMN public.metrics_daily.weighted_views IS 'Vues pondérées (calculées selon l''algorithme de classement)';
-- ------------------------------
-- END 04_submissions_metrics.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 05_payments_cashouts.sql
-- ------------------------------
-- =====================================================
-- 05_payments_cashouts.sql
-- =====================================================
-- Tables de paiements et cashouts (payments_brand, cashouts, webhooks_stripe)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table payments_brand : paiements des marques pour activer les concours
CREATE TABLE IF NOT EXISTS public.payments_brand (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  stripe_customer_id text,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  status payment_status NOT NULL DEFAULT 'requires_payment',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT payments_brand_positive_amount CHECK (amount_cents >= 0)
);

-- Table cashouts : retraits des créateurs via Stripe Connect
CREATE TABLE IF NOT EXISTS public.cashouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  stripe_account_id text,
  stripe_transfer_id text UNIQUE,
  status cashout_status NOT NULL DEFAULT 'requested',
  metadata jsonb DEFAULT '{}'::jsonb,
  requested_at timestamptz DEFAULT NOW() NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT cashouts_positive_amount CHECK (amount_cents >= 0)
);

-- Table webhooks_stripe : événements Stripe bruts pour idempotence
CREATE TABLE IF NOT EXISTS public.webhooks_stripe (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur payments_brand
CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_id ON public.payments_brand(brand_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_contest_id ON public.payments_brand(contest_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand_status ON public.payments_brand(status);
CREATE INDEX IF NOT EXISTS idx_payments_brand_brand_status ON public.payments_brand(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_brand_stripe_session ON public.payments_brand(stripe_checkout_session_id);

-- Index sur cashouts
CREATE INDEX IF NOT EXISTS idx_cashouts_creator_id ON public.cashouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_cashouts_status ON public.cashouts(status);
CREATE INDEX IF NOT EXISTS idx_cashouts_creator_status ON public.cashouts(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_cashouts_stripe_transfer ON public.cashouts(stripe_transfer_id);

-- Index sur webhooks_stripe
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_event_id ON public.webhooks_stripe(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_processed ON public.webhooks_stripe(processed);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_event_type ON public.webhooks_stripe(event_type);
-- GIN jsonb
CREATE INDEX IF NOT EXISTS idx_payments_brand_metadata_gin ON public.payments_brand USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_cashouts_metadata_gin ON public.cashouts USING gin (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_webhooks_stripe_payload_gin ON public.webhooks_stripe USING gin (payload jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.payments_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks_stripe ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.payments_brand IS 'Paiements des marques pour activer les concours (Stripe Checkout)';
COMMENT ON TABLE public.cashouts IS 'Retraits des créateurs via Stripe Connect';
COMMENT ON TABLE public.webhooks_stripe IS 'Événements Stripe bruts pour idempotence et audit';
COMMENT ON COLUMN public.payments_brand.stripe_checkout_session_id IS 'ID de session Stripe Checkout (unique)';
COMMENT ON COLUMN public.payments_brand.stripe_payment_intent_id IS 'ID de PaymentIntent Stripe (unique)';
COMMENT ON COLUMN public.cashouts.stripe_transfer_id IS 'ID du transfer Stripe Connect (unique)';
COMMENT ON COLUMN public.webhooks_stripe.stripe_event_id IS 'ID d''événement Stripe (unique pour idempotence)';
-- ------------------------------
-- END 05_payments_cashouts.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 05_payments_cashouts_4eyes.sql
-- ------------------------------
-- =====================================================
-- 05_payments_cashouts_4eyes.sql
-- =====================================================
-- Migration: Ajouter 4-eyes (2 approvals) pour cashouts
-- =====================================================

-- Ajouter colonne review_state si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cashouts' 
    AND column_name = 'review_state'
  ) THEN
    ALTER TABLE public.cashouts
    ADD COLUMN review_state text DEFAULT 'pending'
    CHECK (review_state IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Table cashout_reviews pour tracker les approbations
CREATE TABLE IF NOT EXISTS public.cashout_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cashout_id uuid NOT NULL REFERENCES public.cashouts(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approve', 'reject')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (cashout_id, admin_id) -- Un admin ne peut approuver qu'une fois
);

CREATE INDEX IF NOT EXISTS idx_cashout_reviews_cashout_id ON public.cashout_reviews(cashout_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashout_reviews_admin_id ON public.cashout_reviews(admin_id);

ALTER TABLE public.cashout_reviews ENABLE ROW LEVEL SECURITY;
-- ------------------------------
-- END 05_payments_cashouts_4eyes.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 06_moderation_audit.sql
-- ------------------------------
-- =====================================================
-- 06_moderation_audit.sql
-- =====================================================
-- Tables de modération et audit (moderation_queue, moderation_rules, audit_logs)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table moderation_queue : queue de modération pour les soumissions
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table moderation_rules : règles de modération configurables
CREATE TABLE IF NOT EXISTS public.moderation_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  rule_type text NOT NULL CHECK (rule_type IN ('content', 'spam', 'duplicate', 'domain', 'flood')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table audit_logs : logs d'audit de toutes les actions sensibles
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  row_pk uuid,
  old_values jsonb,
  new_values jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur moderation_queue
CREATE INDEX IF NOT EXISTS idx_moderation_queue_submission_id ON public.moderation_queue(submission_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON public.moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_reviewed_by ON public.moderation_queue(reviewed_by);

-- Index sur moderation_rules
CREATE INDEX IF NOT EXISTS idx_moderation_rules_rule_type ON public.moderation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_moderation_rules_is_active ON public.moderation_rules(is_active);

-- Index sur audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_row_pk ON public.audit_logs(row_pk);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
-- GIN pour recherche sur JSONB
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values_gin ON public.audit_logs USING gin (old_values jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin ON public.audit_logs USING gin (new_values jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.moderation_queue IS 'Queue de modération pour les soumissions nécessitant une révision';
COMMENT ON TABLE public.moderation_rules IS 'Règles de modération configurables (auto-modération)';
COMMENT ON TABLE public.audit_logs IS 'Logs d''audit de toutes les actions sensibles (CRUD sur données critiques)';
COMMENT ON COLUMN public.audit_logs.table_name IS 'Nom de la table concernée';
COMMENT ON COLUMN public.audit_logs.row_pk IS 'Clé primaire de la ligne modifiée';
COMMENT ON COLUMN public.audit_logs.old_values IS 'Anciennes valeurs (JSONB)';
COMMENT ON COLUMN public.audit_logs.new_values IS 'Nouvelles valeurs (JSONB)';
-- ------------------------------
-- END 06_moderation_audit.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 07_messaging_notifications.sql
-- ------------------------------
-- =====================================================
-- 07_messaging_notifications.sql
-- =====================================================
-- Tables de messagerie et notifications (messages_threads, messages, notifications)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table messages_threads : threads de conversation brand-creator
CREATE TABLE IF NOT EXISTS public.messages_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  brand_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  last_message text,
  unread_for_brand boolean DEFAULT false NOT NULL,
  unread_for_creator boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul thread par brand-creator-contest
  UNIQUE(contest_id, brand_id, creator_id)
);

-- Table messages : messages individuels dans les threads
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.messages_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table notifications : notifications utilisateur
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur messages_threads
CREATE INDEX IF NOT EXISTS idx_messages_threads_brand_id ON public.messages_threads(brand_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_creator_id ON public.messages_threads(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_contest_id ON public.messages_threads(contest_id);
CREATE INDEX IF NOT EXISTS idx_messages_threads_updated_at ON public.messages_threads(updated_at DESC);
-- Index partiels pour unread
CREATE INDEX IF NOT EXISTS idx_threads_brand_unread ON public.messages_threads(brand_id) WHERE unread_for_brand;
CREATE INDEX IF NOT EXISTS idx_threads_creator_unread ON public.messages_threads(creator_id) WHERE unread_for_creator;

-- Index sur messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.messages(thread_id, created_at DESC);

-- Index sur notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Enable RLS
ALTER TABLE public.messages_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.messages_threads IS 'Threads de conversation entre marques et créateurs';
COMMENT ON TABLE public.messages IS 'Messages individuels dans les threads';
COMMENT ON TABLE public.notifications IS 'Notifications utilisateur (in-app)';
COMMENT ON COLUMN public.messages_threads.last_message IS 'Extrait du dernier message (pour preview)';
COMMENT ON COLUMN public.messages_threads.unread_for_brand IS 'Marqueur de non-lu pour la marque';
COMMENT ON COLUMN public.messages_threads.unread_for_creator IS 'Marqueur de non-lu pour le créateur';
COMMENT ON COLUMN public.notifications.content IS 'Contenu de la notification (JSONB avec title, message, action, etc.)';
-- ------------------------------
-- END 07_messaging_notifications.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 15_orgs.sql
-- ------------------------------
-- =====================================================
-- 15_orgs.sql
-- =====================================================
-- Organisations multi-membres (côté marque)
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Table orgs : organisations
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  billing_email citext,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table org_members : membres des organisations
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_org text NOT NULL CHECK (role_in_org IN ('owner', 'admin', 'editor', 'finance')),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

-- Ajouter org_id nullable aux tables existantes (compatibilité ascendante)
DO $$
BEGIN
  -- Ajouter org_id à contests si pas déjà présent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
  
  -- Ajouter org_id à payments_brand si pas déjà présent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments_brand' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.payments_brand ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index sur orgs
CREATE INDEX IF NOT EXISTS idx_orgs_billing_email ON public.orgs(billing_email) WHERE billing_email IS NOT NULL;

-- Index sur org_members
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.org_members(org_id, role_in_org);

-- Index sur org_id dans les tables mises à jour
CREATE INDEX IF NOT EXISTS idx_contests_org_id ON public.contests(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_brand_org_id ON public.payments_brand(org_id) WHERE org_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.orgs IS 'Organisations multi-membres (côté marque)';
COMMENT ON TABLE public.org_members IS 'Membres des organisations avec leurs rôles';
COMMENT ON COLUMN public.org_members.role_in_org IS 'Rôle dans l''organisation: owner, admin, editor, finance';
COMMENT ON COLUMN public.contests.org_id IS 'Organisation associée (nullable pour compatibilité ascendante)';
COMMENT ON COLUMN public.payments_brand.org_id IS 'Organisation associée (nullable pour compatibilité ascendante)';
-- ------------------------------
-- END 15_orgs.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 16_platform_links.sql
-- ------------------------------
-- =====================================================
-- 16_platform_links.sql
-- =====================================================
-- Connexions plateformes & OAuth
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table platform_accounts : comptes liés aux plateformes
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform platform NOT NULL,
  platform_user_id text,
  handle text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, platform)
);

-- Table platform_oauth_tokens : tokens OAuth (service role uniquement)
CREATE TABLE IF NOT EXISTS public.platform_oauth_tokens (
  account_id uuid PRIMARY KEY REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table ingestion_jobs : jobs d'ingestion de métriques
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.platform_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  attempts integer DEFAULT 0 NOT NULL,
  last_error text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table ingestion_errors : erreurs d'ingestion
CREATE TABLE IF NOT EXISTS public.ingestion_errors (
  id bigserial PRIMARY KEY,
  job_id bigint NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  error_code text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur platform_accounts
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON public.platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON public.platform_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_platform ON public.platform_accounts(user_id, platform);
-- Unicité si platform_user_id est connue (stabilise les liens API)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_accounts_platform_user_unique 
  ON public.platform_accounts(platform, platform_user_id) 
  WHERE platform_user_id IS NOT NULL;

-- Index sur ingestion_jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_account_id ON public.ingestion_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_scheduled_at ON public.ingestion_jobs(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_account_status ON public.ingestion_jobs(account_id, status, scheduled_at DESC);

-- Index sur ingestion_errors
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_job_id ON public.ingestion_errors(job_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_error_code ON public.ingestion_errors(error_code);
-- GIN jsonb sur details
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_details_gin ON public.ingestion_errors USING gin (details jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.platform_accounts IS 'Comptes utilisateurs liés aux plateformes sociales (TikTok, Instagram, etc.)';
COMMENT ON TABLE public.platform_oauth_tokens IS 'Tokens OAuth des comptes plateformes (écriture réservée au service_role)';
COMMENT ON TABLE public.ingestion_jobs IS 'Jobs d''ingestion de métriques depuis les plateformes';
COMMENT ON TABLE public.ingestion_errors IS 'Erreurs survenues lors de l''ingestion de métriques';
COMMENT ON COLUMN public.platform_oauth_tokens.account_id IS 'FK vers platform_accounts (clé primaire unique)';
COMMENT ON COLUMN public.platform_oauth_tokens.scopes IS 'Scopes OAuth accordés';
-- ------------------------------
-- END 16_platform_links.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 17_notification_center.sql
-- ------------------------------
-- =====================================================
-- 17_notification_center.sql
-- =====================================================
-- Préférences de notification & Push tokens
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table notification_preferences : préférences de notification par utilisateur
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'inapp')),
  enabled boolean DEFAULT true NOT NULL,
  PRIMARY KEY (user_id, event, channel),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table push_tokens : tokens push pour notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_event ON public.notification_preferences(event);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_channel ON public.notification_preferences(channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_event ON public.notification_preferences(user_id, event);

-- Index sur push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token) WHERE token IS NOT NULL;
-- Unicité user_id, token pour éviter doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token_unique ON public.push_tokens(user_id, token);
-- GIN jsonb sur device_info
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_info_gin ON public.push_tokens USING gin (device_info jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.notification_preferences IS 'Préférences de notification par utilisateur, événement et canal';
COMMENT ON TABLE public.push_tokens IS 'Tokens push pour notifications mobile/web';
COMMENT ON COLUMN public.notification_preferences.event IS 'Type d''événement (ex: submission_approved, contest_ended)';
COMMENT ON COLUMN public.notification_preferences.channel IS 'Canal de notification: email, push, inapp';
COMMENT ON COLUMN public.push_tokens.device_info IS 'Informations sur le device (platform, app_version, etc.)';
-- ------------------------------
-- END 17_notification_center.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 18_invoices_billing.sql
-- ------------------------------
-- =====================================================
-- 18_invoices_billing.sql
-- =====================================================
-- Facturation (organisations marques)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table invoices : factures
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE RESTRICT,
  stripe_invoice_id text UNIQUE,
  amount_cents bigint NOT NULL,
  currency char(3) DEFAULT 'EUR' NOT NULL,
  vat_rate numeric(5, 2),
  pdf_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  issued_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  CONSTRAINT invoices_positive_amount CHECK (amount_cents >= 0)
);

-- Table tax_evidence : preuves fiscales (optionnel)
CREATE TABLE IF NOT EXISTS public.tax_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL,
  vat_number text,
  collected_at timestamptz DEFAULT NOW() NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur invoices
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON public.invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON public.invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Index sur tax_evidence
CREATE INDEX IF NOT EXISTS idx_tax_evidence_org_id ON public.tax_evidence(org_id);
CREATE INDEX IF NOT EXISTS idx_tax_evidence_country_code ON public.tax_evidence(country_code);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_evidence ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.invoices IS 'Factures pour les organisations marques';
COMMENT ON TABLE public.tax_evidence IS 'Preuves fiscales collectées pour les organisations';
COMMENT ON COLUMN public.invoices.stripe_invoice_id IS 'ID de facture Stripe (unique)';
COMMENT ON COLUMN public.invoices.status IS 'Statut de la facture: draft, open, paid, uncollectible, void';
COMMENT ON COLUMN public.invoices.vat_rate IS 'Taux de TVA appliqué (ex: 20.00 pour 20%)';
COMMENT ON COLUMN public.tax_evidence.country_code IS 'Code pays ISO 3166-1 alpha-2';
-- ------------------------------
-- END 18_invoices_billing.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 19_kyc_risk.sql
-- ------------------------------
-- =====================================================
-- 19_kyc_risk.sql
-- =====================================================
-- KYC / Cashout (vérifications d'identité)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table kyc_checks : vérifications KYC des utilisateurs
CREATE TABLE IF NOT EXISTS public.kyc_checks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text DEFAULT 'stripe' NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  reason text,
  reviewed_at timestamptz,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table risk_flags : drapeaux de risque utilisateur (optionnel)
CREATE TABLE IF NOT EXISTS public.risk_flags (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur kyc_checks
CREATE INDEX IF NOT EXISTS idx_kyc_checks_status ON public.kyc_checks(status);
CREATE INDEX IF NOT EXISTS idx_kyc_checks_provider ON public.kyc_checks(provider);
CREATE INDEX IF NOT EXISTS idx_kyc_checks_reviewed_at ON public.kyc_checks(reviewed_at) WHERE reviewed_at IS NOT NULL;

-- Index sur risk_flags
CREATE INDEX IF NOT EXISTS idx_risk_flags_user_id ON public.risk_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON public.risk_flags(severity);
CREATE INDEX IF NOT EXISTS idx_risk_flags_resolved ON public.risk_flags(user_id, resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.kyc_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.kyc_checks IS 'Vérifications KYC (Know Your Customer) pour les cashouts';
COMMENT ON TABLE public.risk_flags IS 'Drapeaux de risque pour les utilisateurs (fraude, etc.)';
COMMENT ON COLUMN public.kyc_checks.provider IS 'Fournisseur KYC (stripe, etc.)';
COMMENT ON COLUMN public.kyc_checks.status IS 'Statut de vérification: pending, verified, failed';
COMMENT ON COLUMN public.kyc_checks.reason IS 'Raison en cas d''échec de vérification';
COMMENT ON COLUMN public.risk_flags.severity IS 'Sévérité du drapeau: low, medium, high, critical';
-- ------------------------------
-- END 19_kyc_risk.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 20_assets.sql
-- ------------------------------
-- =====================================================
-- 20_assets.sql
-- =====================================================
-- Métadonnées fichiers (au-dessus des buckets Storage)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table assets : métadonnées des fichiers
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  bucket text NOT NULL,
  path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Au moins owner_id ou org_id doit être défini
  CONSTRAINT assets_owner_or_org CHECK (
    (owner_id IS NOT NULL AND org_id IS NULL) OR 
    (owner_id IS NULL AND org_id IS NOT NULL) OR 
    (owner_id IS NOT NULL AND org_id IS NOT NULL)
  )
);

-- Index sur assets
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON public.assets(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON public.assets(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_bucket ON public.assets(bucket);
CREATE INDEX IF NOT EXISTS idx_assets_visibility ON public.assets(visibility);
CREATE INDEX IF NOT EXISTS idx_assets_moderation_status ON public.assets(moderation_status);
CREATE INDEX IF NOT EXISTS idx_assets_bucket_path ON public.assets(bucket, path);

-- Contrainte unique sur (bucket, path) avec idempotence
CREATE UNIQUE INDEX IF NOT EXISTS assets_bucket_path_unique 
  ON public.assets(bucket, path)
  WHERE bucket IS NOT NULL AND path IS NOT NULL;

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.assets IS 'Métadonnées des fichiers stockés dans les buckets Storage';
COMMENT ON COLUMN public.assets.owner_id IS 'Propriétaire individuel (nullable si org_id est défini)';
COMMENT ON COLUMN public.assets.org_id IS 'Organisation propriétaire (nullable si owner_id est défini)';
COMMENT ON COLUMN public.assets.bucket IS 'Nom du bucket Storage (avatars, contest_assets, ugc_videos, etc.)';
COMMENT ON COLUMN public.assets.path IS 'Chemin du fichier dans le bucket';
COMMENT ON COLUMN public.assets.sha256 IS 'Hash SHA-256 du fichier pour vérification d''intégrité';
COMMENT ON COLUMN public.assets.visibility IS 'Visibilité: private (défaut) ou public';
COMMENT ON COLUMN public.assets.moderation_status IS 'Statut de modération: pending, approved, rejected';
-- ------------------------------
-- END 20_assets.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 21_moderation_history.sql
-- ------------------------------
-- =====================================================
-- 21_moderation_history.sql
-- =====================================================
-- Historique des décisions de modération
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table moderation_actions : historique des actions de modération
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id bigserial PRIMARY KEY,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'remove')),
  reason text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur moderation_actions
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON public.moderation_actions(target_table, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_actor_id ON public.moderation_actions(actor_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_action ON public.moderation_actions(action);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);

-- Enable RLS
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.moderation_actions IS 'Historique des actions de modération (approve, reject, remove)';
COMMENT ON COLUMN public.moderation_actions.target_table IS 'Nom de la table cible (ex: submissions, assets)';
COMMENT ON COLUMN public.moderation_actions.target_id IS 'ID de la ligne cible';
COMMENT ON COLUMN public.moderation_actions.action IS 'Action effectuée: approve, reject, remove';
COMMENT ON COLUMN public.moderation_actions.reason IS 'Raison de l''action (obligatoire pour reject/remove)';
COMMENT ON COLUMN public.moderation_actions.actor_id IS 'Utilisateur ayant effectué l''action (NULL = système)';
-- ------------------------------
-- END 21_moderation_history.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 22_messaging.sql
-- ------------------------------
-- =====================================================
-- 22_messaging.sql
-- =====================================================
-- Threads & Messages (complément/complétion)
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Note : messages_threads et messages existent déjà dans 07_messaging_notifications.sql
-- Ce fichier ajoute org_id à messages_threads et complète les fonctionnalités

-- Ajouter org_id à messages_threads si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages_threads' 
    AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.messages_threads ADD COLUMN org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index sur org_id dans messages_threads
CREATE INDEX IF NOT EXISTS idx_messages_threads_org_id ON public.messages_threads(org_id) WHERE org_id IS NOT NULL;

-- Fonction helper pour vérifier si un utilisateur est membre d'une org
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
    AND user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS 'Vérifie si un utilisateur est membre d''une organisation';

-- Commentaires additionnels
COMMENT ON COLUMN public.messages_threads.org_id IS 'Organisation associée au thread (nullable pour compatibilité)';
-- ------------------------------
-- END 22_messaging.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 23_webhooks_outbound.sql
-- ------------------------------
-- =====================================================
-- 23_webhooks_outbound.sql
-- =====================================================
-- Intégrations sortantes (webhooks)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table webhook_endpoints : endpoints de webhook configurés par les organisations
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  secret text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table webhook_deliveries : livraisons de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id bigserial PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  retry_count integer DEFAULT 0 NOT NULL,
  last_error text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur webhook_endpoints
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_id ON public.webhook_endpoints(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON public.webhook_endpoints(active) WHERE active = true;

-- Index sur webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created ON public.webhook_deliveries(endpoint_id, created_at DESC);
-- GIN jsonb sur payload
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_payload_gin ON public.webhook_deliveries USING gin (payload jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.webhook_endpoints IS 'Endpoints de webhook configurés par les organisations';
COMMENT ON TABLE public.webhook_deliveries IS 'Historique des livraisons de webhooks';
COMMENT ON COLUMN public.webhook_endpoints.secret IS 'Secret pour signer les webhooks (HMAC)';
COMMENT ON COLUMN public.webhook_endpoints.active IS 'Endpoint actif ou désactivé';
COMMENT ON COLUMN public.webhook_deliveries.event IS 'Type d''événement (ex: submission.approved, contest.ended)';
COMMENT ON COLUMN public.webhook_deliveries.payload IS 'Payload JSON envoyé au webhook';
COMMENT ON COLUMN public.webhook_deliveries.status IS 'Statut de livraison: pending, success, failed';
COMMENT ON COLUMN public.webhook_deliveries.retry_count IS 'Nombre de tentatives de livraison';
-- ------------------------------
-- END 23_webhooks_outbound.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 24_event_log.sql
-- ------------------------------
-- =====================================================
-- 24_event_log.sql
-- =====================================================
-- Journal produit minimal (event tracking)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table event_log : journal d'événements produit
CREATE TABLE IF NOT EXISTS public.event_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur event_log
CREATE INDEX IF NOT EXISTS idx_event_log_user_id ON public.event_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_org_id ON public.event_log(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_event_name ON public.event_log(event_name);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON public.event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_org_created ON public.event_log(org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_user_created ON public.event_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
-- GIN jsonb sur properties
CREATE INDEX IF NOT EXISTS idx_event_log_properties_gin ON public.event_log USING gin (properties jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.event_log IS 'Journal d''événements produit (tracking analytics)';
COMMENT ON COLUMN public.event_log.user_id IS 'Utilisateur concerné (nullable si événement org)';
COMMENT ON COLUMN public.event_log.org_id IS 'Organisation concernée (nullable si événement utilisateur)';
COMMENT ON COLUMN public.event_log.event_name IS 'Nom de l''événement (ex: submission.created, contest.viewed)';
COMMENT ON COLUMN public.event_log.properties IS 'Propriétés additionnelles de l''événement (JSONB)';

-- Note : Au moins user_id ou org_id doit être défini (mais on ne met pas de contrainte CHECK pour flexibilité)
-- ------------------------------
-- END 24_event_log.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 25_contest_prizes_winnings.sql
-- ------------------------------
-- =====================================================
-- 25_contest_prizes_winnings.sql
-- =====================================================
-- Système de prix fixes par position et gains persistés
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Table contest_prizes : prix fixes par position
CREATE TABLE IF NOT EXISTS public.contest_prizes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  position integer NOT NULL,
  percentage numeric(5, 2) CHECK (percentage >= 0 AND percentage <= 100),
  amount_cents integer CHECK (amount_cents >= 0),
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Une seule position par concours
  UNIQUE(contest_id, position),
  -- Au moins percentage ou amount_cents doit être défini
  CONSTRAINT contest_prizes_has_value CHECK (
    (percentage IS NOT NULL AND percentage > 0) OR 
    (amount_cents IS NOT NULL AND amount_cents > 0)
  )
);

-- Table contest_winnings : gains réels persistés par créateur/concours
CREATE TABLE IF NOT EXISTS public.contest_winnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE RESTRICT,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  rank integer NOT NULL,
  payout_cents integer NOT NULL,
  payout_percentage numeric(5, 2),
  calculated_at timestamptz DEFAULT NOW() NOT NULL,
  paid_at timestamptz,
  cashout_id uuid REFERENCES public.cashouts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul gain par créateur/concours
  UNIQUE(contest_id, creator_id),
  CONSTRAINT contest_winnings_positive_payout CHECK (payout_cents >= 0)
);

-- Index sur contest_prizes
CREATE INDEX IF NOT EXISTS idx_contest_prizes_contest_id ON public.contest_prizes(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_prizes_position ON public.contest_prizes(contest_id, position);

-- Index sur contest_winnings
CREATE INDEX IF NOT EXISTS idx_contest_winnings_contest_id ON public.contest_winnings(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_creator_id ON public.contest_winnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_rank ON public.contest_winnings(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_contest_winnings_paid_at ON public.contest_winnings(paid_at) WHERE paid_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contest_winnings_cashout_id ON public.contest_winnings(cashout_id) WHERE cashout_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.contest_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_winnings ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_prizes IS 'Prix fixes par position pour les concours (ex: 1er = 50%, 2e = 30%)';
COMMENT ON TABLE public.contest_winnings IS 'Gains réels persistés par créateur/concours (calculés à la fin du concours)';
COMMENT ON COLUMN public.contest_prizes.position IS 'Position du gagnant (1 = premier, 2 = second, etc.)';
COMMENT ON COLUMN public.contest_prizes.percentage IS 'Pourcentage du prize pool (ex: 50.00 pour 50%)';
COMMENT ON COLUMN public.contest_prizes.amount_cents IS 'Montant fixe en centimes (alternative à percentage)';
COMMENT ON COLUMN public.contest_winnings.rank IS 'Rang du créateur dans le classement final';
COMMENT ON COLUMN public.contest_winnings.payout_cents IS 'Montant du gain en centimes';
COMMENT ON COLUMN public.contest_winnings.payout_percentage IS 'Pourcentage du prize pool gagné';
COMMENT ON COLUMN public.contest_winnings.calculated_at IS 'Date de calcul du gain';
COMMENT ON COLUMN public.contest_winnings.paid_at IS 'Date de paiement effectif (via cashout)';
COMMENT ON COLUMN public.contest_winnings.cashout_id IS 'Cashout associé au gain (si payé)';
-- ------------------------------
-- END 25_contest_prizes_winnings.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 26_contest_terms_acceptances.sql
-- ------------------------------
-- =====================================================
-- 26_contest_terms_acceptances.sql
-- =====================================================
-- Traçabilité des acceptations de CGU et lien contest → contest_terms
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Ajouter contest_terms_id à contests si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'contest_terms_id'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN contest_terms_id uuid REFERENCES public.contest_terms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Table contest_terms_acceptances : traçabilité des acceptations de CGU
CREATE TABLE IF NOT EXISTS public.contest_terms_acceptances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contest_terms_id uuid NOT NULL REFERENCES public.contest_terms(id) ON DELETE RESTRICT,
  accepted_at timestamptz DEFAULT NOW() NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  -- Un seul acceptation par utilisateur/concours (mais peut changer si nouvelles CGU)
  UNIQUE(contest_id, user_id, contest_terms_id)
);

-- Index sur contest_terms_acceptances
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_contest_id ON public.contest_terms_acceptances(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_user_id ON public.contest_terms_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_terms_id ON public.contest_terms_acceptances(contest_terms_id);
CREATE INDEX IF NOT EXISTS idx_contest_terms_acceptances_accepted_at ON public.contest_terms_acceptances(accepted_at DESC);

-- Index sur contest_terms_id dans contests
CREATE INDEX IF NOT EXISTS idx_contests_contest_terms_id ON public.contests(contest_terms_id) WHERE contest_terms_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.contest_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_terms_acceptances IS 'Traçabilité des acceptations de CGU par utilisateur/concours (conformité légale)';
COMMENT ON COLUMN public.contests.contest_terms_id IS 'Version des CGU acceptée pour ce concours';
COMMENT ON COLUMN public.contest_terms_acceptances.contest_terms_id IS 'Version des CGU acceptée';
COMMENT ON COLUMN public.contest_terms_acceptances.accepted_at IS 'Date/heure d''acceptation';
COMMENT ON COLUMN public.contest_terms_acceptances.ip_address IS 'Adresse IP de l''utilisateur lors de l''acceptation';
COMMENT ON COLUMN public.contest_terms_acceptances.user_agent IS 'User agent du navigateur lors de l''acceptation';
-- ------------------------------
-- END 26_contest_terms_acceptances.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 27_follows_favorites.sql
-- ------------------------------
-- =====================================================
-- 27_follows_favorites.sql
-- =====================================================
-- Système social : Follow/Abonnements et Favoris/Watchlist
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table follows : abonnements entre utilisateurs
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  -- Un utilisateur ne peut pas se suivre lui-même
  CONSTRAINT follows_not_self CHECK (follower_id != followee_id)
);

-- Table contest_favorites : favoris/watchlist de concours
CREATE TABLE IF NOT EXISTS public.contest_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, contest_id)
);

-- Index sur follows
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON public.follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at DESC);

-- Index sur contest_favorites
CREATE INDEX IF NOT EXISTS idx_contest_favorites_user_id ON public.contest_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_favorites_contest_id ON public.contest_favorites(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_favorites_created_at ON public.contest_favorites(created_at DESC);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_favorites ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.follows IS 'Abonnements entre utilisateurs (créateurs suivent marques et vice-versa)';
COMMENT ON TABLE public.contest_favorites IS 'Favoris/watchlist de concours par utilisateur';
COMMENT ON COLUMN public.follows.follower_id IS 'Utilisateur qui suit';
COMMENT ON COLUMN public.follows.followee_id IS 'Utilisateur suivi';
-- ------------------------------
-- END 27_follows_favorites.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 28_tags_categories.sql
-- ------------------------------
-- =====================================================
-- 28_tags_categories.sql
-- =====================================================
-- Système de tags/catégories pour organiser les concours
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table contest_tags : tags/catégories disponibles
CREATE TABLE IF NOT EXISTS public.contest_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  color text, -- Couleur hex pour l'UI (ex: '#FF5733')
  icon_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Table contest_tag_links : liens entre concours et tags
CREATE TABLE IF NOT EXISTS public.contest_tag_links (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.contest_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  PRIMARY KEY (contest_id, tag_id)
);

-- Index sur contest_tags
CREATE INDEX IF NOT EXISTS idx_contest_tags_slug ON public.contest_tags(slug);
CREATE INDEX IF NOT EXISTS idx_contest_tags_is_active ON public.contest_tags(is_active) WHERE is_active = true;

-- Index sur contest_tag_links
CREATE INDEX IF NOT EXISTS idx_contest_tag_links_contest_id ON public.contest_tag_links(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_tag_links_tag_id ON public.contest_tag_links(tag_id);

-- Enable RLS
ALTER TABLE public.contest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_tag_links ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.contest_tags IS 'Tags/catégories pour organiser et rechercher les concours';
COMMENT ON TABLE public.contest_tag_links IS 'Liens entre concours et tags (many-to-many)';
COMMENT ON COLUMN public.contest_tags.slug IS 'Slug unique pour l''URL (ex: "fashion", "tech")';
COMMENT ON COLUMN public.contest_tags.color IS 'Couleur hex pour l''interface (ex: "#FF5733")';
COMMENT ON COLUMN public.contest_tags.icon_url IS 'URL de l''icône du tag';
-- ------------------------------
-- END 28_tags_categories.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 29_status_history.sql
-- ------------------------------
-- =====================================================
-- 29_status_history.sql
-- =====================================================
-- Historique des changements de statut (traçabilité complète)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table status_history : historique des changements de statut
CREATE TABLE IF NOT EXISTS public.status_history (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL, -- 'contests', 'submissions', 'payments_brand', etc.
  row_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur status_history
CREATE INDEX IF NOT EXISTS idx_status_history_table_row ON public.status_history(table_name, row_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_by ON public.status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_history_new_status ON public.status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.status_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.status_history IS 'Historique complet des changements de statut pour toutes les entités';
COMMENT ON COLUMN public.status_history.table_name IS 'Nom de la table concernée (ex: "contests", "submissions")';
COMMENT ON COLUMN public.status_history.row_id IS 'ID de la ligne concernée';
COMMENT ON COLUMN public.status_history.old_status IS 'Ancien statut';
COMMENT ON COLUMN public.status_history.new_status IS 'Nouveau statut';
COMMENT ON COLUMN public.status_history.changed_by IS 'Utilisateur ayant effectué le changement (NULL = système)';
COMMENT ON COLUMN public.status_history.reason IS 'Raison du changement (obligatoire pour certains statuts)';
COMMENT ON COLUMN public.status_history.metadata IS 'Métadonnées additionnelles (JSONB)';
-- ------------------------------
-- END 29_status_history.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 30_submission_comments.sql
-- ------------------------------
-- =====================================================
-- 30_submission_comments.sql
-- =====================================================
-- Commentaires sur les soumissions (interactions marque-créateur)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table submission_comments : commentaires sur les soumissions
CREATE TABLE IF NOT EXISTS public.submission_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL,
  is_internal boolean DEFAULT false NOT NULL, -- Commentaire interne (marque) ou public
  parent_id uuid REFERENCES public.submission_comments(id) ON DELETE CASCADE, -- Pour les réponses
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur submission_comments
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_id ON public.submission_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_author_id ON public.submission_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_parent_id ON public.submission_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submission_comments_created_at ON public.submission_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_created ON public.submission_comments(submission_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.submission_comments ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.submission_comments IS 'Commentaires sur les soumissions (interactions marque-créateur)';
COMMENT ON COLUMN public.submission_comments.author_id IS 'Auteur du commentaire (marque ou créateur)';
COMMENT ON COLUMN public.submission_comments.body IS 'Contenu du commentaire';
COMMENT ON COLUMN public.submission_comments.is_internal IS 'Commentaire interne (visible seulement par la marque) ou public (visible par le créateur)';
COMMENT ON COLUMN public.submission_comments.parent_id IS 'Commentaire parent (pour les réponses/threads)';
-- ------------------------------
-- END 30_submission_comments.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 31_notification_templates.sql
-- ------------------------------
-- =====================================================
-- 31_notification_templates.sql
-- =====================================================
-- Templates de notifications centralisés (emails, push, in-app)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table notification_templates : templates de notifications
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL UNIQUE, -- 'submission_approved', 'contest_ended', etc.
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'inapp', 'sms')),
  subject text, -- Pour email
  body_html text, -- Template HTML (avec variables {{variable}})
  body_text text, -- Template texte brut
  variables jsonb DEFAULT '{}'::jsonb, -- Variables disponibles et leur description
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index sur notification_templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON public.notification_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON public.notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON public.notification_templates(is_active) WHERE is_active = true;
-- GIN jsonb sur variables
CREATE INDEX IF NOT EXISTS idx_notification_templates_variables_gin ON public.notification_templates USING gin (variables jsonb_path_ops);

-- Enable RLS
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE public.notification_templates IS 'Templates de notifications centralisés pour emails, push, in-app';
COMMENT ON COLUMN public.notification_templates.event_type IS 'Type d''événement (ex: "submission_approved", "contest_ended")';
COMMENT ON COLUMN public.notification_templates.channel IS 'Canal de notification: email, push, inapp, sms';
COMMENT ON COLUMN public.notification_templates.subject IS 'Sujet pour les emails';
COMMENT ON COLUMN public.notification_templates.body_html IS 'Template HTML avec variables {{variable}}';
COMMENT ON COLUMN public.notification_templates.body_text IS 'Template texte brut avec variables {{variable}}';
COMMENT ON COLUMN public.notification_templates.variables IS 'Variables disponibles et leur description (JSONB)';
-- ------------------------------
-- END 31_notification_templates.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 36_messages_attachments.sql
-- ------------------------------
-- =====================================================
-- 36_messages_attachments.sql
-- =====================================================
-- Pièces jointes des messages (liées aux assets Storage)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

-- Table messages_attachments : pièces jointes d'un message
CREATE TABLE IF NOT EXISTS public.messages_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  url text, -- fallback si pas d'asset_id
  mime_type text,
  created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_messages_attachments_message_id ON public.messages_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_attachments_asset_id ON public.messages_attachments(asset_id);

-- Enable RLS
ALTER TABLE public.messages_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: participants du thread du message + admin
DROP POLICY IF EXISTS "messages_attachments_participants_manage" ON public.messages_attachments;
CREATE POLICY "messages_attachments_participants_manage" ON public.messages_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.messages_threads mt ON mt.id = m.thread_id
      WHERE m.id = messages_attachments.message_id
        AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.messages_threads mt ON mt.id = m.thread_id
      WHERE m.id = messages_attachments.message_id
        AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  );

COMMENT ON TABLE public.messages_attachments IS 'Pièces jointes des messages (référence à assets ou URL)';
-- ------------------------------
-- END 36_messages_attachments.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 38_rate_limits.sql
-- ------------------------------
-- =====================================================
-- 38_rate_limits.sql
-- =====================================================
-- Journal des hits pour rate limiting (persistant)
-- Idempotent : CREATE IF NOT EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  route text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_route ON public.rate_limits(key, route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits_service_only" ON public.rate_limits;
CREATE POLICY "rate_limits_service_only" ON public.rate_limits
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.rate_limits IS 'Enregistrements de rate limiting côté serveur (purge via expires_at).';
-- ------------------------------
-- END 38_rate_limits.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 39_admin_tables.sql
-- ------------------------------
-- =====================================================
-- 39_admin_tables.sql
-- =====================================================
-- Admin-only tables used by the admin interface.
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE POLICY.
-- =====================================================

-- =====================================================
-- SALES_LEADS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  company text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  source text,
  value_cents integer NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON public.sales_leads(status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_to ON public.sales_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at ON public.sales_leads(created_at DESC);

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_leads_admin_all" ON public.sales_leads;
CREATE POLICY "sales_leads_admin_all" ON public.sales_leads
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- SUPPORT_TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_all" ON public.support_tickets
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PLATFORM_SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_admin_all" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_all" ON public.platform_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- FEATURE_FLAGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_admin_all" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_all" ON public.feature_flags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- EMAIL_OUTBOX
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'canceled')),
  provider text,
  error_message text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox(status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_scheduled_at ON public.email_outbox(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_template_id ON public.email_outbox(template_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id ON public.email_outbox(user_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON public.email_outbox(created_at DESC);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_outbox_admin_all" ON public.email_outbox;
CREATE POLICY "email_outbox_admin_all" ON public.email_outbox
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- EMAIL_LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  outbox_id uuid REFERENCES public.email_outbox(id) ON DELETE SET NULL,
  status text NOT NULL,
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_outbox_id ON public.email_logs(outbox_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_admin_all" ON public.email_logs;
CREATE POLICY "email_logs_admin_all" ON public.email_logs
  FOR ALL USING (public.is_admin(auth.uid()));
-- ------------------------------
-- END 39_admin_tables.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 41_admin_saved_views.sql
-- ------------------------------
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
-- ------------------------------
-- END 41_admin_saved_views.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 41_admin_saved_views_team_personal.sql
-- ------------------------------
-- =====================================================
-- 41_admin_saved_views_team_personal.sql
-- =====================================================
-- Migration: Ajouter visibility (personal/team) et is_default
-- pour les saved views admin
-- =====================================================

-- Ajouter colonnes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_saved_views' 
    AND column_name = 'visibility'
  ) THEN
    ALTER TABLE public.admin_saved_views
    ADD COLUMN visibility text NOT NULL DEFAULT 'personal'
    CHECK (visibility IN ('personal', 'team'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_saved_views' 
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE public.admin_saved_views
    ADD COLUMN is_default boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index pour is_default
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_default 
  ON public.admin_saved_views(route, is_default) 
  WHERE is_default = true;

-- Index pour visibility
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_visibility 
  ON public.admin_saved_views(route, visibility);

-- Contrainte : une seule vue par défaut par route
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_saved_views_default_unique
  ON public.admin_saved_views(route)
  WHERE is_default = true AND visibility = 'team';

-- Note: On permet plusieurs vues default 'personal' car chaque admin peut avoir sa propre vue par défaut
-- ------------------------------
-- END 41_admin_saved_views_team_personal.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 42_admin_rbac.sql
-- ------------------------------
-- =====================================================
-- 42_admin_rbac.sql
-- =====================================================
-- RBAC (roles/permissions) for admin staff.
-- Goal: restrict which admin can access which module and whether they can write.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION + DROP/CREATE POLICY.
-- =====================================================

-- -----------------------------------------------------
-- Tables
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_staff (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_active ON public.admin_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_staff_super ON public.admin_staff(is_super_admin) WHERE is_super_admin = true;

-- -----------------------------------------------------
-- Bootstrap + helpers
-- -----------------------------------------------------

-- True when the RBAC system has not been initialized yet (no admin_staff rows).
-- SECURITY DEFINER avoids RLS recursion and lets policies check bootstrap state safely.
CREATE OR REPLACE FUNCTION public.admin_staff_is_bootstrap()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_staff);
$$;

COMMENT ON FUNCTION public.admin_staff_is_bootstrap() IS 'Retourne true si admin_staff est vide (bootstrap RBAC).';

-- True when user is an active super admin.
CREATE OR REPLACE FUNCTION public.is_admin_super(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_staff s
    WHERE s.user_id = is_admin_super.uid
      AND s.is_active = true
      AND s.is_super_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_super(uuid) IS 'Retourne true si l''utilisateur est super admin (admin_staff).';

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_key ON public.admin_roles(key);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON public.admin_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission ON public.admin_role_permissions(permission_key);

CREATE TABLE IF NOT EXISTS public.admin_staff_roles (
  user_id uuid NOT NULL REFERENCES public.admin_staff(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_staff_roles_user ON public.admin_staff_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_staff_roles_role ON public.admin_staff_roles(role_id);

CREATE TABLE IF NOT EXISTS public.admin_staff_permission_overrides (
  user_id uuid NOT NULL REFERENCES public.admin_staff(user_id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_overrides_user ON public.admin_staff_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_overrides_permission ON public.admin_staff_permission_overrides(permission_key);

-- -----------------------------------------------------
-- RLS
-- -----------------------------------------------------

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_staff_permission_overrides ENABLE ROW LEVEL SECURITY;

-- admin_staff
DROP POLICY IF EXISTS "admin_staff_read" ON public.admin_staff;
CREATE POLICY "admin_staff_read" ON public.admin_staff
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_staff_write" ON public.admin_staff;
CREATE POLICY "admin_staff_write" ON public.admin_staff
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_staff_bootstrap" ON public.admin_staff;
CREATE POLICY "admin_staff_bootstrap" ON public.admin_staff
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid())
    AND public.admin_staff_is_bootstrap()
    AND user_id = auth.uid()
    AND is_active = true
    AND is_super_admin = true
  );

-- roles / permissions (read for admins, write for super admins)
DROP POLICY IF EXISTS "admin_roles_read" ON public.admin_roles;
CREATE POLICY "admin_roles_read" ON public.admin_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_roles_write" ON public.admin_roles;
CREATE POLICY "admin_roles_write" ON public.admin_roles
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_permissions_read" ON public.admin_permissions;
CREATE POLICY "admin_permissions_read" ON public.admin_permissions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_permissions_write" ON public.admin_permissions;
CREATE POLICY "admin_permissions_write" ON public.admin_permissions
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

DROP POLICY IF EXISTS "admin_role_permissions_read" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_read" ON public.admin_role_permissions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_role_permissions_write" ON public.admin_role_permissions;
CREATE POLICY "admin_role_permissions_write" ON public.admin_role_permissions
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- staff role assignments
DROP POLICY IF EXISTS "admin_staff_roles_read" ON public.admin_staff_roles;
CREATE POLICY "admin_staff_roles_read" ON public.admin_staff_roles
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_staff_roles_write" ON public.admin_staff_roles;
CREATE POLICY "admin_staff_roles_write" ON public.admin_staff_roles
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- per-user overrides
DROP POLICY IF EXISTS "admin_overrides_read" ON public.admin_staff_permission_overrides;
CREATE POLICY "admin_overrides_read" ON public.admin_staff_permission_overrides
  FOR SELECT USING (public.is_admin_super(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin_overrides_write" ON public.admin_staff_permission_overrides;
CREATE POLICY "admin_overrides_write" ON public.admin_staff_permission_overrides
  FOR ALL USING (public.is_admin_super(auth.uid()))
  WITH CHECK (public.is_admin_super(auth.uid()));

-- -----------------------------------------------------
-- Seeds (permissions + default roles)
-- -----------------------------------------------------

INSERT INTO public.admin_permissions (key, description)
VALUES
  ('admin.team.read', 'Voir l’équipe admin et leurs rôles/droits'),
  ('admin.team.write', 'Gérer l’équipe admin (ajouter/supprimer/assigner rôles)'),
  ('dashboard.read', 'Accéder au dashboard'),
  ('brands.read', 'Voir marques/orgs'),
  ('brands.write', 'Créer/éditer marques/orgs'),
  ('contests.read', 'Voir concours'),
  ('contests.write', 'Créer/éditer/publier concours'),
  ('submissions.read', 'Voir soumissions'),
  ('submissions.write', 'Modérer/mettre à jour soumissions'),
  ('moderation.read', 'Voir modération'),
  ('moderation.write', 'Gérer queue + règles de modération'),
  ('integrations.read', 'Voir integrations/webhooks'),
  ('integrations.write', 'Modifier endpoints + relancer webhooks'),
  ('ingestion.read', 'Voir ingestion jobs/errors'),
  ('ingestion.write', 'Relancer jobs / marquer résolu'),
  ('risk.read', 'Voir KYC/risque'),
  ('risk.write', 'Résoudre flags / mettre à jour KYC'),
  ('taxonomy.read', 'Voir tags/terms/assets'),
  ('taxonomy.write', 'Gérer tags/terms/assets'),
  ('exports.read', 'Voir exports'),
  ('exports.write', 'Générer exports étendus'),
  ('users.read', 'Voir utilisateurs'),
  ('users.write', 'Modifier utilisateurs (reset onboarding, suspendre, etc.)'),
  ('finance.read', 'Voir finance'),
  ('finance.write', 'Actions finance (cashouts, void, generate, etc.)'),
  ('invoices.read', 'Voir factures'),
  ('invoices.write', 'Gérer factures'),
  ('emails.read', 'Voir emails/templates/logs'),
  ('emails.write', 'Gérer templates + dispatch emails'),
  ('crm.read', 'Voir CRM'),
  ('crm.write', 'Gérer leads CRM'),
  ('support.read', 'Voir support'),
  ('support.write', 'Gérer tickets support'),
  ('audit.read', 'Voir audit & logs'),
  ('settings.read', 'Voir settings'),
  ('settings.write', 'Modifier settings/feature flags')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_roles (key, name, description)
VALUES
  ('super_admin', 'Super admin', 'Accès complet + gestion des droits'),
  ('ops', 'Ops', 'Opérations quotidiennes (modération/ingestion/intégrations)'),
  ('finance', 'Finance', 'Accès aux pages et actions finance'),
  ('marketing', 'Marketing', 'Marques/concours/CRM + lecture sur le reste'),
  ('support', 'Support', 'Support + lecture des profils'),
  ('read_only', 'Lecture seule', 'Accès lecture seule à l’admin')
ON CONFLICT (key) DO NOTHING;

-- Helper: bind permissions to roles
INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'brands.read','brands.write',
  'contests.read','contests.write',
  'submissions.read','submissions.write',
  'moderation.read','moderation.write',
  'integrations.read','integrations.write',
  'ingestion.read','ingestion.write',
  'risk.read','risk.write',
  'taxonomy.read','taxonomy.write',
  'exports.read','exports.write',
  'users.read','users.write',
  'finance.read','finance.write',
  'invoices.read','invoices.write',
  'emails.read','emails.write',
  'crm.read','crm.write',
  'support.read','support.write',
  'audit.read',
  'settings.read','settings.write',
  'admin.team.read','admin.team.write'
)
WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'submissions.read','submissions.write',
  'moderation.read','moderation.write',
  'integrations.read','integrations.write',
  'ingestion.read','ingestion.write',
  'risk.read',
  'users.read',
  'audit.read',
  'exports.read'
)
WHERE r.key = 'ops'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'finance.read','finance.write',
  'invoices.read','invoices.write',
  'audit.read',
  'exports.read','exports.write',
  'users.read'
)
WHERE r.key = 'finance'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'brands.read','brands.write',
  'contests.read','contests.write',
  'taxonomy.read','taxonomy.write',
  'crm.read','crm.write',
  'exports.read',
  'users.read'
)
WHERE r.key = 'marketing'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key IN (
  'dashboard.read',
  'support.read','support.write',
  'users.read',
  'audit.read'
)
WHERE r.key = 'support'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.key LIKE '%.read'
WHERE r.key = 'read_only'
ON CONFLICT DO NOTHING;
-- ------------------------------
-- END 42_admin_rbac.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 42_admin_rbac_break_glass.sql
-- ------------------------------
-- =====================================================
-- 42_admin_rbac_break_glass.sql
-- =====================================================
-- Migration: Ajouter break-glass TTL à admin_staff
-- =====================================================

-- Ajouter colonnes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_staff' 
    AND column_name = 'break_glass_until'
  ) THEN
    ALTER TABLE public.admin_staff
    ADD COLUMN break_glass_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_staff' 
    AND column_name = 'break_glass_reason'
  ) THEN
    ALTER TABLE public.admin_staff
    ADD COLUMN break_glass_reason text;
  END IF;
END $$;

-- Index pour break_glass_until
CREATE INDEX IF NOT EXISTS idx_admin_staff_break_glass 
  ON public.admin_staff(break_glass_until) 
  WHERE break_glass_until IS NOT NULL;
-- ------------------------------
-- END 42_admin_rbac_break_glass.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 43_admin_inbox_permissions.sql
-- ------------------------------
-- Admin Inbox permission (RBAC extension)
-- Adds `inbox.read` and grants it to default admin roles.

begin;

insert into public.admin_permissions (key, description)
values ('inbox.read', 'Voir inbox admin (à traiter)')
on conflict (key) do nothing;

-- Default grant: most roles can see inbox (read-only)
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, 'inbox.read'
from public.admin_roles r
where r.key in ('super_admin', 'read_only', 'ops', 'support', 'marketing', 'finance')
on conflict do nothing;

commit;
-- ------------------------------
-- END 43_admin_inbox_permissions.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 44_admin_guide_permissions.sql
-- ------------------------------
-- Admin Guide permission (RBAC extension)
-- Adds `guide.read` and grants it to default admin roles.

begin;

insert into public.admin_permissions (key, description)
values ('guide.read', 'Accéder au guide admin (formation / aide contextuelle)')
on conflict (key) do nothing;

-- Default grant: all roles can read the guide
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, 'guide.read'
from public.admin_roles r
where r.key in ('super_admin', 'read_only', 'ops', 'support', 'marketing', 'finance')
on conflict do nothing;

commit;
-- ------------------------------
-- END 44_admin_guide_permissions.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 45_moderation_rules_lifecycle.sql
-- ------------------------------
-- Moderation Rules lifecycle + versioning
-- - Adds draft/published status + version counter
-- - Stores snapshots in moderation_rule_versions
-- Idempotent.

begin;

alter table public.moderation_rules
  add column if not exists status text not null default 'published';

alter table public.moderation_rules
  drop constraint if exists moderation_rules_status_check;
alter table public.moderation_rules
  add constraint moderation_rules_status_check check (status in ('draft', 'published'));

alter table public.moderation_rules
  add column if not exists version integer not null default 1;

alter table public.moderation_rules
  add column if not exists published_at timestamptz;

alter table public.moderation_rules
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

-- Safety: a draft rule cannot be active
alter table public.moderation_rules
  drop constraint if exists moderation_rules_draft_inactive;
alter table public.moderation_rules
  add constraint moderation_rules_draft_inactive check (not (status = 'draft' and is_active = true));

create table if not exists public.moderation_rule_versions (
  id bigserial primary key,
  rule_id uuid not null references public.moderation_rules(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rule_id, version)
);

create index if not exists idx_moderation_rule_versions_rule_id on public.moderation_rule_versions(rule_id, version desc);

create or replace function public.moderation_rules_versioning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if new.version is null or new.version < 1 then
      new.version := 1;
    end if;

    insert into public.moderation_rule_versions(rule_id, version, snapshot, created_by)
    values (new.id, new.version, to_jsonb(new), auth.uid());

    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if (new.name is distinct from old.name)
      or (new.description is distinct from old.description)
      or (new.rule_type is distinct from old.rule_type)
      or (new.config is distinct from old.config)
      or (new.is_active is distinct from old.is_active)
      or (new.status is distinct from old.status) then

      new.version := coalesce(old.version, 1) + 1;

      if old.status = 'draft' and new.status = 'published' and new.published_at is null then
        new.published_at := now();
        new.published_by := auth.uid();
      end if;

      insert into public.moderation_rule_versions(rule_id, version, snapshot, created_by)
      values (new.id, new.version, to_jsonb(new), auth.uid());
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_moderation_rules_versioning on public.moderation_rules;
create trigger trg_moderation_rules_versioning
before insert or update on public.moderation_rules
for each row
execute function public.moderation_rules_versioning();

-- RLS: versions are admin-only
alter table public.moderation_rule_versions enable row level security;

drop policy if exists "moderation_rule_versions_admin_all" on public.moderation_rule_versions;
create policy "moderation_rule_versions_admin_all" on public.moderation_rule_versions
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

commit;
-- ------------------------------
-- END 45_moderation_rules_lifecycle.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 46_ingestion_errors_resolution.sql
-- ------------------------------
-- Ingestion errors resolution (admin workflow)
-- Adds resolved state + who/when.
-- Idempotent.

begin;

alter table public.ingestion_errors
  add column if not exists is_resolved boolean not null default false;

alter table public.ingestion_errors
  add column if not exists resolved_at timestamptz;

alter table public.ingestion_errors
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_ingestion_errors_is_resolved on public.ingestion_errors(is_resolved);
create index if not exists idx_ingestion_errors_created_resolved on public.ingestion_errors(created_at desc, is_resolved);

commit;
-- ------------------------------
-- END 46_ingestion_errors_resolution.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 47_admin_ops_data.sql
-- ------------------------------
-- =====================================================
-- 47_admin_ops_data.sql
-- =====================================================
-- Admin "Ops Center" data to make the admin interface actionable:
-- - admin_tasks + admin_task_events (inbox/pilotage)
-- - admin_notes (internal notes on user/org/contest/...)
-- - admin_playbooks (procedures / runbooks)
-- - admin_ui_preferences (density, pinned views, table prefs)
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP/CREATE POLICY + CREATE OR REPLACE FUNCTION.
-- =====================================================

-- -----------------------------------------------------
-- admin_tasks
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_table text NOT NULL,
  source_id text NOT NULL,
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'canceled')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_tasks_source_unique UNIQUE (source_table, source_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON public.admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON public.admin_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_assigned_to ON public.admin_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_at ON public.admin_tasks(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON public.admin_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_source ON public.admin_tasks(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_metadata_gin ON public.admin_tasks USING gin (metadata jsonb_path_ops);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- admin_task_events
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_task_events (
  id bigserial PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'status_change', 'assignment', 'system')),
  message text,
  from_status text,
  to_status text,
  from_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_task_events_task_id ON public.admin_task_events(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_task_events_type ON public.admin_task_events(event_type);

ALTER TABLE public.admin_task_events ENABLE ROW LEVEL SECURITY;

-- Auto log status/assignment changes
CREATE OR REPLACE FUNCTION public.admin_tasks_emit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_task_events (task_id, event_type, from_status, to_status, created_by)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid());
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.admin_task_events (task_id, event_type, from_assigned_to, to_assigned_to, created_by)
    VALUES (NEW.id, 'assignment', OLD.assigned_to, NEW.assigned_to, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_tasks_emit_events_trigger ON public.admin_tasks;
CREATE TRIGGER admin_tasks_emit_events_trigger
  BEFORE UPDATE ON public.admin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_tasks_emit_events();

-- -----------------------------------------------------
-- admin_notes
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_table text NOT NULL,
  target_id text NOT NULL,
  note text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_target ON public.admin_notes(target_table, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_pinned ON public.admin_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_admin_notes_tags_gin ON public.admin_notes USING gin (tags);

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- admin_playbooks (runbooks)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_playbooks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  body_md text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  related_table text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_playbooks_active ON public.admin_playbooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_playbooks_tags_gin ON public.admin_playbooks USING gin (tags);

ALTER TABLE public.admin_playbooks ENABLE ROW LEVEL SECURITY;

-- Minimal default playbooks
INSERT INTO public.admin_playbooks (key, title, summary, body_md, tags, related_table)
VALUES
  (
    'webhooks.failed',
    'Webhooks en échec — quoi faire',
    'Diagnostic rapide + actions de relance côté endpoint.',
    E'1) Filtre les deliveries failed (24h) et regroupe par endpoint.\n2) Lis last_error (timeout / 4xx / 5xx / signature).\n3) Vérifie URL + secret + réseau côté marque.\n4) Corrige, puis relance (Retry) et surveille la timeline.',
    ARRAY['integrations','webhooks','ops'],
    'webhook_deliveries'
  ),
  (
    'cashouts.review',
    'Cashouts — revue & validation',
    'Checklist avant approbation (KYC, risk flags, ancienneté).',
    E'1) Priorise les demandes les plus anciennes.\n2) Vérifie KYC + flags risque.\n3) Si pause/rejet: raison obligatoire (audit).\n4) Après action: contrôle ledger.',
    ARRAY['finance','ops'],
    'payments_cashouts'
  )
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------
-- admin_ui_preferences
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_ui_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  density text NOT NULL DEFAULT 'comfort' CHECK (density IN ('compact', 'comfort', 'dense')),
  pinned_views jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_ui_preferences ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS policies (admin-only; fine-grained enforcement is done in API with RBAC)
-- -----------------------------------------------------

-- admin_tasks
DROP POLICY IF EXISTS "admin_tasks_admin_all" ON public.admin_tasks;
CREATE POLICY "admin_tasks_admin_all" ON public.admin_tasks
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_task_events
DROP POLICY IF EXISTS "admin_task_events_admin_all" ON public.admin_task_events;
CREATE POLICY "admin_task_events_admin_all" ON public.admin_task_events
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_notes
DROP POLICY IF EXISTS "admin_notes_admin_all" ON public.admin_notes;
CREATE POLICY "admin_notes_admin_all" ON public.admin_notes
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_playbooks
DROP POLICY IF EXISTS "admin_playbooks_admin_all" ON public.admin_playbooks;
CREATE POLICY "admin_playbooks_admin_all" ON public.admin_playbooks
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- admin_ui_preferences
DROP POLICY IF EXISTS "admin_ui_preferences_admin_read" ON public.admin_ui_preferences;
CREATE POLICY "admin_ui_preferences_admin_read" ON public.admin_ui_preferences
  FOR SELECT USING (public.is_admin(auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "admin_ui_preferences_admin_write" ON public.admin_ui_preferences;
CREATE POLICY "admin_ui_preferences_admin_write" ON public.admin_ui_preferences
  FOR ALL USING (public.is_admin(auth.uid()) AND user_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) AND user_id = auth.uid());
-- ------------------------------
-- END 47_admin_ops_data.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 48_marketing_campaigns.sql
-- ------------------------------
-- =====================================================
-- 48_marketing_campaigns.sql
-- =====================================================
-- Marketing "campaigns" layer (optional but powerful):
-- - campaigns: marketing initiatives (budget, dates, status)
-- - campaign_contests: link contests to campaigns
-- - campaign_assets: link assets (briefs/creas) to campaigns
-- - campaign_metrics_daily: daily KPIs (can be filled from event_log or providers)
-- Idempotent.
-- =====================================================

-- -----------------------------------------------------
-- campaigns
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  name text NOT NULL,
  objective text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  budget_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.campaigns(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_metadata_gin ON public.campaigns USING gin (metadata jsonb_path_ops);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_contests (M:N)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_contests (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_contests_contest ON public.campaign_contests(contest_id);

ALTER TABLE public.campaign_contests ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_assets (M:N)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_assets (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'creative' CHECK (kind IN ('brief', 'creative', 'logo', 'legal', 'other')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_assets_asset ON public.campaign_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_kind ON public.campaign_assets(kind);

ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- campaign_metrics_daily
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_metrics_daily (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  spend_cents integer NOT NULL DEFAULT 0,
  revenue_cents integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date ON public.campaign_metrics_daily(campaign_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON public.campaign_metrics_daily(metric_date DESC);

ALTER TABLE public.campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS (admin-only; enforce fine-grained access in API)
-- -----------------------------------------------------

DROP POLICY IF EXISTS "campaigns_admin_all" ON public.campaigns;
CREATE POLICY "campaigns_admin_all" ON public.campaigns
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_contests_admin_all" ON public.campaign_contests;
CREATE POLICY "campaign_contests_admin_all" ON public.campaign_contests
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_assets_admin_all" ON public.campaign_assets;
CREATE POLICY "campaign_assets_admin_all" ON public.campaign_assets
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "campaign_metrics_daily_admin_all" ON public.campaign_metrics_daily;
CREATE POLICY "campaign_metrics_daily_admin_all" ON public.campaign_metrics_daily
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
-- ------------------------------
-- END 48_marketing_campaigns.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 49_event_log_utm_views.sql
-- ------------------------------
-- =====================================================
-- 49_event_log_utm_views.sql
-- =====================================================
-- UTM / tracking helpers (based on event_log.properties).
-- event_log already has a GIN index on properties.
-- =====================================================

CREATE OR REPLACE VIEW public.event_log_utm AS
SELECT
  id,
  user_id,
  org_id,
  event_name,
  created_at,
  properties,
  NULLIF(properties->>'utm_source', '')   AS utm_source,
  NULLIF(properties->>'utm_medium', '')   AS utm_medium,
  NULLIF(properties->>'utm_campaign', '') AS utm_campaign,
  NULLIF(properties->>'utm_content', '')  AS utm_content,
  NULLIF(properties->>'utm_term', '')     AS utm_term
FROM public.event_log;

CREATE OR REPLACE VIEW public.event_log_utm_daily AS
SELECT
  date_trunc('day', created_at)::date AS metric_date,
  org_id,
  utm_source,
  utm_medium,
  utm_campaign,
  count(*)::bigint AS events
FROM public.event_log_utm
GROUP BY 1,2,3,4,5;
-- ------------------------------
-- END 49_event_log_utm_views.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 54_admin_mfa.sql
-- ------------------------------
-- =====================================================
-- 54_admin_mfa.sql
-- =====================================================
-- MFA TOTP (Google Authenticator) pour l'accès admin
-- Stockage serveur uniquement (service_role) : le secret ne doit jamais être lisible côté client.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_mfa (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  secret_enc text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  last_used_step bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_mfa_is_enabled ON public.admin_mfa(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_admin_mfa_verified_at ON public.admin_mfa(verified_at DESC) WHERE verified_at IS NOT NULL;

ALTER TABLE public.admin_mfa ENABLE ROW LEVEL SECURITY;

-- Lecture/écriture strictement côté serveur (service role)
DROP POLICY IF EXISTS "admin_mfa_service_role_all" ON public.admin_mfa;
CREATE POLICY "admin_mfa_service_role_all" ON public.admin_mfa
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- ------------------------------
-- END 54_admin_mfa.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 54_status_history_generalized.sql
-- ------------------------------
-- =====================================================
-- 54_status_history_generalized.sql
-- =====================================================
-- Généralisation status_history + reason_code normalisé + risk_score
-- Idempotent : ALTER TABLE IF EXISTS, CREATE TYPE IF NOT EXISTS
-- =====================================================

-- Enum reason_code normalisé pour toutes les entités
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reason_code_enum') THEN
    CREATE TYPE public.reason_code_enum AS ENUM (
      'other',
      'fraud',
      'policy_violation',
      'quality_issue',
      'duplicate',
      'spam',
      'user_request',
      'system_error',
      'maintenance',
      'support',
      'debugging',
      'testing',
      'approval',
      'rejection',
      'suspension',
      'activation',
      'payment_issue',
      'verification',
      'compliance',
      'abuse'
    );
  END IF;
END $$;

-- Ajouter reason_code à status_history si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'status_history' 
    AND column_name = 'reason_code'
  ) THEN
    ALTER TABLE public.status_history 
    ADD COLUMN reason_code public.reason_code_enum;
  END IF;
END $$;

-- Ajouter risk_score à profiles si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN risk_score INTEGER DEFAULT 0 
    CHECK (risk_score >= 0 AND risk_score <= 100);
  END IF;
END $$;

-- Vue pour calculer risk_score agrégé (basé sur plusieurs facteurs)
CREATE OR REPLACE VIEW public.profiles_risk_scores AS
SELECT 
  p.id,
  p.role,
  p.email,
  p.is_active,
  -- Facteurs de risque
  CASE 
    WHEN p.is_active = false THEN 30
    ELSE 0
  END +
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.audit_logs al 
      WHERE al.row_pk = p.id
      AND al.action LIKE '%fraud%'
      AND al.created_at >= CURRENT_DATE - INTERVAL '90 days'
    ) THEN 50
    ELSE 0
  END +
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.status_history sh 
      WHERE sh.table_name = 'profiles' 
      AND sh.row_id = p.id 
      AND sh.reason_code IN ('fraud', 'abuse', 'policy_violation')
      AND sh.created_at >= CURRENT_DATE - INTERVAL '90 days'
    ) THEN 40
    ELSE 0
  END +
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.moderation_queue mq 
      WHERE mq.submission_id IN (
        SELECT id FROM public.submissions WHERE creator_id = p.id
      )
      AND mq.status = 'pending'
    ) THEN 20
    ELSE 0
  END AS calculated_risk_score
FROM public.profiles p;

-- Fonction pour mettre à jour risk_score automatiquement
CREATE OR REPLACE FUNCTION public.update_profile_risk_score(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_risk_score INTEGER;
BEGIN
  SELECT calculated_risk_score INTO v_risk_score
  FROM public.profiles_risk_scores
  WHERE id = p_profile_id;
  
  IF v_risk_score IS NOT NULL THEN
    UPDATE public.profiles
    SET risk_score = v_risk_score
    WHERE id = p_profile_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.update_profile_risk_score(UUID) IS 'Met à jour le risk_score d''un profil basé sur les facteurs de risque';

-- Trigger pour mettre à jour risk_score après changements pertinents
CREATE OR REPLACE FUNCTION public.trigger_update_profile_risk_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mettre à jour le risk_score si c'est un profil concerné
  IF TG_TABLE_NAME = 'audit_logs' AND NEW.table_name = 'profiles' THEN
    PERFORM public.update_profile_risk_score(NEW.row_pk::UUID);
  ELSIF TG_TABLE_NAME = 'status_history' AND NEW.table_name = 'profiles' THEN
    PERFORM public.update_profile_risk_score(NEW.row_id);
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    PERFORM public.update_profile_risk_score(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Créer triggers si pas déjà présents
DROP TRIGGER IF EXISTS trg_update_risk_score_audit ON public.audit_logs;
CREATE TRIGGER trg_update_risk_score_audit
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  WHEN (NEW.table_name = 'profiles')
  EXECUTE FUNCTION public.trigger_update_profile_risk_score();

DROP TRIGGER IF EXISTS trg_update_risk_score_status ON public.status_history;
CREATE TRIGGER trg_update_risk_score_status
  AFTER INSERT ON public.status_history
  FOR EACH ROW
  WHEN (NEW.table_name = 'profiles')
  EXECUTE FUNCTION public.trigger_update_profile_risk_score();

-- Index pour recherche par risk_score
CREATE INDEX IF NOT EXISTS idx_profiles_risk_score 
  ON public.profiles(risk_score DESC, created_at DESC)
  WHERE risk_score > 0;

-- Index pour status_history avec reason_code
CREATE INDEX IF NOT EXISTS idx_status_history_reason_code 
  ON public.status_history(reason_code, created_at DESC)
  WHERE reason_code IS NOT NULL;

-- Commentaires
COMMENT ON TYPE public.reason_code_enum IS 'Codes de raison normalisés pour status_history et audit_logs';
COMMENT ON COLUMN public.status_history.reason_code IS 'Code de raison normalisé pour le changement de statut';
COMMENT ON COLUMN public.profiles.risk_score IS 'Score de risque calculé (0-100) basé sur fraud, violations, etc.';
COMMENT ON VIEW public.profiles_risk_scores IS 'Vue calculant le risk_score agrégé pour chaque profil';
-- ------------------------------
-- END 54_status_history_generalized.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 55_admin_contest_publish_transaction.sql
-- ------------------------------
-- =====================================================
-- 55_admin_contest_publish_transaction.sql
-- =====================================================
-- Transaction SQL (RPC) pour publication de concours côté admin
-- Objectifs :
-- - atomicité (update contest + status_history + audit_logs + notification)
-- - validations DB-level (statut, dates, budget/prize, assets)
-- - traçabilité (reason + reason_code + ip/user_agent)
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_publish_contest(
  p_contest_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_reason_code public.reason_code_enum DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_old_status text;
  v_ip inet;
BEGIN
  -- Safe cast IP (x-forwarded-for peut contenir plusieurs IPs)
  BEGIN
    v_ip := NULLIF(btrim(split_part(COALESCE(p_ip, ''), ',', 1)), '')::inet;
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  -- Lock row to avoid race conditions
  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;

  v_old_status := v_contest.status::text;

  -- Allowed transitions: draft/paused -> active
  IF v_old_status NOT IN ('draft', 'paused') THEN
    RAISE EXCEPTION 'Contest cannot be published from status: %', v_old_status;
  END IF;

  -- Basic validations (DB-level)
  IF v_contest.end_at <= v_contest.start_at THEN
    RAISE EXCEPTION 'Invalid dates: end_at must be after start_at';
  END IF;

  IF v_contest.budget_cents IS NULL OR v_contest.budget_cents <= 0 THEN
    RAISE EXCEPTION 'Invalid budget: budget_cents must be > 0';
  END IF;

  IF v_contest.prize_pool_cents IS NULL OR v_contest.prize_pool_cents < 0 THEN
    RAISE EXCEPTION 'Invalid prize pool: prize_pool_cents must be >= 0';
  END IF;

  IF v_contest.prize_pool_cents > v_contest.budget_cents THEN
    RAISE EXCEPTION 'Invalid prize pool: prize_pool_cents must be <= budget_cents';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contest_assets ca WHERE ca.contest_id = p_contest_id
  ) THEN
    RAISE EXCEPTION 'Contest must have at least one contest_asset to be published';
  END IF;

  -- Update contest status
  UPDATE public.contests
  SET status = 'active',
      updated_at = public.now_utc()
  WHERE id = p_contest_id;

  -- Status history (reason + reason_code)
  INSERT INTO public.status_history (
    table_name,
    row_id,
    old_status,
    new_status,
    changed_by,
    reason,
    reason_code,
    metadata
  ) VALUES (
    'contests',
    p_contest_id,
    v_old_status,
    'active',
    p_actor_id,
    p_reason,
    p_reason_code,
    jsonb_build_object(
      'ip', p_ip,
      'user_agent', p_user_agent
    )
  );

  -- Audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    row_pk,
    old_values,
    new_values,
    ip,
    user_agent
  ) VALUES (
    p_actor_id,
    'contest_publish',
    'contests',
    p_contest_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', 'active',
      'reason', p_reason,
      'reason_code', p_reason_code
    ),
    v_ip,
    p_user_agent
  );

  -- Notification brand owner (keep content aligned with notifyAdminAction)
  INSERT INTO public.notifications (
    user_id,
    type,
    content,
    read
  ) VALUES (
    v_contest.brand_id,
    'contest_published',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'contest_title', v_contest.title,
      'notification_type', 'contest_published',
      'created_by_admin', true
    ),
    false
  );

  RETURN jsonb_build_object(
    'ok', true,
    'contest_id', p_contest_id,
    'old_status', v_old_status,
    'new_status', 'active',
    'brand_id', v_contest.brand_id,
    'contest_title', v_contest.title
  );
END;
$$;

COMMENT ON FUNCTION public.admin_publish_contest(uuid, uuid, text, public.reason_code_enum, text, text)
IS 'Publie un concours (draft/paused -> active) de manière atomique avec status_history, audit_logs et notification.';
-- ------------------------------
-- END 55_admin_contest_publish_transaction.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 56_admin_contest_end_transaction.sql
-- ------------------------------
-- =====================================================
-- 56_admin_contest_end_transaction.sql
-- =====================================================
-- Transaction SQL (RPC) pour fin de concours côté admin
-- Objectifs :
-- - éviter doublons status_history (finalize_contest() log avec auth.uid() NULL en service-role)
-- - atomicité (update contest + compute/UPSERT winnings + status_history + audit_logs + notification)
-- - traçabilité (reason + reason_code + ip/user_agent)
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_end_contest(
  p_contest_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL,
  p_reason_code public.reason_code_enum DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_payouts RECORD;
  v_old_status text;
  v_ip inet;
BEGIN
  -- Safe cast IP (x-forwarded-for peut contenir plusieurs IPs)
  BEGIN
    v_ip := NULLIF(btrim(split_part(COALESCE(p_ip, ''), ',', 1)), '')::inet;
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  -- Lock row to avoid race conditions
  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;

  v_old_status := v_contest.status::text;

  -- Allowed: active -> ended
  IF v_old_status <> 'active' THEN
    RAISE EXCEPTION 'Contest must be active to be ended. Current status: %', v_old_status;
  END IF;

  -- End contest
  UPDATE public.contests
  SET status = 'ended',
      updated_at = public.now_utc()
  WHERE id = p_contest_id;

  -- Compute and upsert winnings
  FOR v_payouts IN
    SELECT * FROM public.compute_payouts(p_contest_id)
  LOOP
    INSERT INTO public.contest_winnings (
      contest_id,
      creator_id,
      rank,
      payout_cents,
      payout_percentage,
      calculated_at
    )
    VALUES (
      p_contest_id,
      v_payouts.creator_id,
      v_payouts.rank,
      v_payouts.payout_cents,
      v_payouts.payout_percentage,
      public.now_utc()
    )
    ON CONFLICT (contest_id, creator_id) DO UPDATE
    SET
      rank = EXCLUDED.rank,
      payout_cents = EXCLUDED.payout_cents,
      payout_percentage = EXCLUDED.payout_percentage,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = public.now_utc();
  END LOOP;

  -- Single, traceable status_history row (admin actor)
  INSERT INTO public.status_history (
    table_name,
    row_id,
    old_status,
    new_status,
    changed_by,
    reason,
    reason_code,
    metadata
  ) VALUES (
    'contests',
    p_contest_id,
    v_old_status,
    'ended',
    p_actor_id,
    p_reason,
    p_reason_code,
    jsonb_build_object(
      'source', 'admin_rpc',
      'ip', p_ip,
      'user_agent', p_user_agent
    )
  );

  -- Audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    row_pk,
    old_values,
    new_values,
    ip,
    user_agent
  ) VALUES (
    p_actor_id,
    'contest_end',
    'contests',
    p_contest_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', 'ended',
      'reason', p_reason,
      'reason_code', p_reason_code
    ),
    v_ip,
    p_user_agent
  );

  -- Notification brand owner
  INSERT INTO public.notifications (
    user_id,
    type,
    content,
    read
  ) VALUES (
    v_contest.brand_id,
    'contest_ended',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'contest_title', v_contest.title,
      'notification_type', 'contest_ended',
      'created_by_admin', true
    ),
    false
  );

  RETURN jsonb_build_object(
    'ok', true,
    'contest_id', p_contest_id,
    'old_status', v_old_status,
    'new_status', 'ended',
    'brand_id', v_contest.brand_id,
    'contest_title', v_contest.title
  );
END;
$$;

COMMENT ON FUNCTION public.admin_end_contest(uuid, uuid, text, public.reason_code_enum, text, text)
IS 'Termine un concours (active -> ended) de manière atomique avec compute_payouts, status_history, audit_logs et notification.';
-- ------------------------------
-- END 56_admin_contest_end_transaction.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 57_admin_aal2_rls.sql
-- ------------------------------
-- =====================================================
-- 57_admin_aal2_rls.sql
-- =====================================================
-- Optional hardening: require AAL2 for admin operations at DB level (RLS).
--
-- Pattern:
--   - must be admin (existing source of truth: public.is_admin(auth.uid()))
--   - AND must have AAL2 in JWT claim: (auth.jwt() ->> 'aal') = 'aal2'
--
-- Notes:
-- - This does NOT affect non-admin access paths (creator/brand policies remain).
-- - If you use service_role for admin jobs, it bypasses RLS anyway.
-- =====================================================

-- Helper condition (inline): COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'

-- =====================================================
-- CASHOUTS (sensitive financial ops)
-- Existing policies in 11_rls_policies.sql:
--   - cashouts_creator_manage_own
--   - cashouts_admin_all
-- We replace admin policy to require AAL2.
-- =====================================================

DROP POLICY IF EXISTS "cashouts_admin_aal2_only" ON public.cashouts;
DROP POLICY IF EXISTS "cashouts_admin_all" ON public.cashouts;

CREATE POLICY "cashouts_admin_aal2_only" ON public.cashouts
  FOR ALL
  USING (
    public.is_admin(auth.uid())
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
  );

-- =====================================================
-- AUDIT_LOGS (sensitive monitoring / investigations)
-- Existing policy in 11_rls_policies.sql:
--   - audit_logs_admin_all
-- We replace admin policy to require AAL2.
-- =====================================================

DROP POLICY IF EXISTS "audit_logs_admin_aal2_only" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;

CREATE POLICY "audit_logs_admin_aal2_only" ON public.audit_logs
  FOR ALL
  USING (
    public.is_admin(auth.uid())
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
  );
-- ------------------------------
-- END 57_admin_aal2_rls.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 08_views_materialized.sql
-- ------------------------------
-- =====================================================
-- 08_views_materialized.sql
-- =====================================================
-- Vues et vues matérialisées (leaderboard, contest_stats)
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Vue leaderboard : classement agrégé par concours et créateur
-- Agrégation des weighted_views depuis metrics_daily pour les soumissions approuvées
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  s.contest_id,
  s.creator_id,
  SUM(md.weighted_views) AS total_weighted_views,
  SUM(md.views) AS total_views,
  SUM(md.likes) AS total_likes,
  SUM(md.comments) AS total_comments,
  SUM(md.shares) AS total_shares,
  COUNT(DISTINCT s.id) AS submission_count
FROM public.submissions s
INNER JOIN public.metrics_daily md ON md.submission_id = s.id
WHERE s.status = 'approved'
GROUP BY s.contest_id, s.creator_id;

COMMENT ON VIEW public.leaderboard IS 'Classement agrégé par concours et créateur (weighted_views depuis metrics_daily)';

-- Vue contest_stats : statistiques agrégées par concours
CREATE OR REPLACE VIEW public.contest_stats AS
SELECT 
  c.id AS contest_id,
  c.title,
  c.status,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.creator_id) AS total_creators,
  COUNT(DISTINCT CASE WHEN s.status = 'approved' THEN s.id END) AS approved_submissions,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  COALESCE(SUM(md.weighted_views), 0) AS total_weighted_views
FROM public.contests c
LEFT JOIN public.submissions s ON s.contest_id = c.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
GROUP BY c.id, c.title, c.status;

COMMENT ON VIEW public.contest_stats IS 'Statistiques agrégées par concours (KPIs)';

-- Optionnel : Vue matérialisée pour meilleures performances
-- À rafraîchir périodiquement (via cron ou trigger)
DO $$ 
BEGIN
  CREATE MATERIALIZED VIEW IF NOT EXISTS public.leaderboard_materialized AS
  SELECT 
    s.contest_id,
    s.creator_id,
    SUM(md.weighted_views) AS total_weighted_views,
    SUM(md.views) AS total_views,
    SUM(md.likes) AS total_likes,
    SUM(md.comments) AS total_comments,
    SUM(md.shares) AS total_shares,
    COUNT(DISTINCT s.id) AS submission_count,
    MAX(md.metric_date) AS last_metric_date
  FROM public.submissions s
  INNER JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE s.status = 'approved'
  GROUP BY s.contest_id, s.creator_id;
  
  -- Index sur la vue matérialisée
  CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_materialized_contest_creator 
    ON public.leaderboard_materialized(contest_id, creator_id);
  CREATE INDEX IF NOT EXISTS idx_leaderboard_materialized_contest_views 
    ON public.leaderboard_materialized(contest_id, total_weighted_views DESC);
EXCEPTION 
  WHEN duplicate_table THEN NULL;
END $$;

COMMENT ON MATERIALIZED VIEW public.leaderboard_materialized IS 'Vue matérialisée du classement (rafraîchie périodiquement)';

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION public.refresh_leaderboard()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_materialized;
$$;

COMMENT ON FUNCTION public.refresh_leaderboard() IS 'Rafraîchit la vue matérialisée leaderboard_materialized';
-- ------------------------------
-- END 08_views_materialized.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 09_functions_business.sql
-- ------------------------------
-- =====================================================
-- 09_functions_business.sql
-- =====================================================
-- Fonctions métier (compute_payouts, gestion statuts concours, KPIs)
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction compute_payouts : calcule la répartition des gains selon les poids
-- Répartition proportionnelle sur Top N (max_winners) selon score pondéré
CREATE OR REPLACE FUNCTION public.compute_payouts(p_contest_id uuid)
RETURNS TABLE (
  creator_id uuid,
  rank integer,
  weighted_views numeric,
  payout_cents integer,
  payout_percentage numeric
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest RECORD;
  v_prize_pool_cents integer;
  v_max_winners integer;
  v_total_weighted numeric;
BEGIN
  -- Récupérer les infos du concours
  SELECT prize_pool_cents, max_winners INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;
  
  v_prize_pool_cents := v_contest.prize_pool_cents;
  v_max_winners := v_contest.max_winners;
  
  -- Calculer le total des weighted_views pour les Top N
  SELECT COALESCE(SUM(total_weighted_views), 0) INTO v_total_weighted
  FROM (
    SELECT total_weighted_views
    FROM public.leaderboard
    WHERE contest_id = p_contest_id
    ORDER BY total_weighted_views DESC
    LIMIT v_max_winners
  ) top_creators;
  
  -- Retourner le classement avec les payouts proportionnels
  RETURN QUERY
  SELECT 
    l.creator_id,
    ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC)::integer AS rank,
    l.total_weighted_views,
    CASE 
      WHEN v_total_weighted > 0 AND ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC) <= v_max_winners
      THEN (l.total_weighted_views / v_total_weighted * v_prize_pool_cents)::integer
      ELSE 0
    END AS payout_cents,
    CASE 
      WHEN v_total_weighted > 0 AND ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC) <= v_max_winners
      THEN (l.total_weighted_views / v_total_weighted * 100)::numeric(5, 2)
      ELSE 0::numeric(5, 2)
    END AS payout_percentage
  FROM public.leaderboard l
  WHERE l.contest_id = p_contest_id
  ORDER BY l.total_weighted_views DESC
  LIMIT v_max_winners;
END;
$$;

COMMENT ON FUNCTION public.compute_payouts(uuid) IS 'Calcule la répartition proportionnelle des gains sur Top N selon score pondéré';

-- Fonction pour vérifier si un concours est actif
CREATE OR REPLACE FUNCTION public.is_contest_active(p_contest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.contests 
    WHERE id = p_contest_id 
    AND status = 'active'
    AND start_at <= public.now_utc()
    AND end_at >= public.now_utc()
  );
$$;

COMMENT ON FUNCTION public.is_contest_active(uuid) IS 'Vérifie si un concours est actif (status=active et dates valides)';

-- Fonction pour obtenir les métriques d'un concours (pour dashboard marque)
CREATE OR REPLACE FUNCTION public.get_contest_metrics(p_contest_id uuid)
RETURNS TABLE (
  contest_id uuid,
  total_submissions bigint,
  approved_submissions bigint,
  total_creators bigint,
  total_views numeric,
  total_likes numeric,
  total_comments numeric,
  total_shares numeric,
  total_weighted_views numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    COUNT(DISTINCT s.id) AS total_submissions,
    COUNT(DISTINCT CASE WHEN s.status = 'approved' THEN s.id END) AS approved_submissions,
    COUNT(DISTINCT s.creator_id) AS total_creators,
    COALESCE(SUM(md.views), 0) AS total_views,
    COALESCE(SUM(md.likes), 0) AS total_likes,
    COALESCE(SUM(md.comments), 0) AS total_comments,
    COALESCE(SUM(md.shares), 0) AS total_shares,
    COALESCE(SUM(md.weighted_views), 0) AS total_weighted_views
  FROM public.contests c
  LEFT JOIN public.submissions s ON s.contest_id = c.id
  LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE c.id = p_contest_id
  GROUP BY c.id;
$$;

COMMENT ON FUNCTION public.get_contest_metrics(uuid) IS 'Retourne les métriques agrégées d''un concours (pour dashboard marque)';

-- Fonction pour obtenir le classement d'un concours
CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_contest_id uuid, p_limit integer DEFAULT 30)
RETURNS TABLE (
  creator_id uuid,
  rank integer,
  total_weighted_views numeric,
  total_views numeric,
  total_likes numeric,
  total_comments numeric,
  total_shares numeric,
  submission_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.creator_id,
    ROW_NUMBER() OVER (ORDER BY l.total_weighted_views DESC)::integer AS rank,
    l.total_weighted_views,
    l.total_views,
    l.total_likes,
    l.total_comments,
    l.total_shares,
    l.submission_count
  FROM public.leaderboard l
  WHERE l.contest_id = p_contest_id
  ORDER BY l.total_weighted_views DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_contest_leaderboard(uuid, integer) IS 'Retourne le classement d''un concours (Top N)';
-- ------------------------------
-- END 09_functions_business.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 33_analytics_materialized.sql
-- ------------------------------
-- =====================================================
-- 33_analytics_materialized.sql
-- =====================================================
-- Vues matérialisées pour analytics et dashboards optimisés
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Vue matérialisée : Résumé dashboard marque
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_dashboard_summary AS
SELECT 
  c.brand_id,
  COUNT(*) FILTER (WHERE c.status = 'active') AS active_contests,
  COUNT(*) FILTER (WHERE c.status = 'ended') AS ended_contests,
  COUNT(*) FILTER (WHERE c.status = 'draft') AS draft_contests,
  SUM(c.prize_pool_cents) AS total_prize_pool_cents,
  SUM(c.budget_cents) AS total_budget_cents,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.creator_id) AS total_creators,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  MAX(c.updated_at) AS last_contest_updated
FROM public.contests c
LEFT JOIN public.submissions s ON s.contest_id = c.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
GROUP BY c.brand_id;

-- Index sur brand_dashboard_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_dashboard_summary_brand_id 
  ON public.brand_dashboard_summary(brand_id);

-- Vue matérialisée : Résumé dashboard créateur
CREATE MATERIALIZED VIEW IF NOT EXISTS public.creator_dashboard_summary AS
SELECT 
  s.creator_id,
  COUNT(DISTINCT s.contest_id) AS contests_participated,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(*) FILTER (WHERE s.status = 'approved') AS approved_submissions,
  COUNT(*) FILTER (WHERE s.status = 'pending') AS pending_submissions,
  COUNT(*) FILTER (WHERE s.status = 'rejected') AS rejected_submissions,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  COALESCE(SUM(md.comments), 0) AS total_comments,
  COALESCE(SUM(md.shares), 0) AS total_shares,
  COALESCE(SUM(cw.payout_cents), 0) AS total_earnings_cents,
  COUNT(DISTINCT cw.contest_id) FILTER (WHERE cw.payout_cents > 0) AS contests_won,
  MAX(s.updated_at) AS last_submission_updated
FROM public.submissions s
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
LEFT JOIN public.contest_winnings cw ON cw.creator_id = s.creator_id
GROUP BY s.creator_id;

-- Index sur creator_dashboard_summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_dashboard_summary_creator_id 
  ON public.creator_dashboard_summary(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_dashboard_summary_earnings 
  ON public.creator_dashboard_summary(total_earnings_cents DESC);

-- Vue matérialisée : Statistiques globales plateforme
CREATE MATERIALIZED VIEW IF NOT EXISTS public.platform_stats_summary AS
SELECT 
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'brand') AS total_brands,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'creator') AS total_creators,
  COUNT(DISTINCT c.id) AS total_contests,
  COUNT(DISTINCT s.id) AS total_submissions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'approved') AS approved_submissions,
  COALESCE(SUM(c.prize_pool_cents), 0) AS total_prize_pool_cents,
  COALESCE(SUM(cw.payout_cents), 0) AS total_paid_cents,
  COALESCE(SUM(md.views), 0) AS total_views,
  COALESCE(SUM(md.likes), 0) AS total_likes,
  MAX(c.created_at) AS last_contest_created,
  MAX(s.created_at) AS last_submission_created
FROM public.profiles p
LEFT JOIN public.contests c ON c.brand_id = p.id
LEFT JOIN public.submissions s ON s.creator_id = p.id
LEFT JOIN public.metrics_daily md ON md.submission_id = s.id
LEFT JOIN public.contest_winnings cw ON cw.creator_id = p.id;

-- Index unique requis pour REFRESH CONCURRENTLY (vue singleton)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_stats_summary_singleton 
  ON public.platform_stats_summary(total_contests);

-- Commentaires
COMMENT ON MATERIALIZED VIEW public.brand_dashboard_summary IS 'Résumé des statistiques par marque (dashboard optimisé)';
COMMENT ON MATERIALIZED VIEW public.creator_dashboard_summary IS 'Résumé des statistiques par créateur (dashboard optimisé)';
COMMENT ON MATERIALIZED VIEW public.platform_stats_summary IS 'Statistiques globales de la plateforme';

-- Fonction pour rafraîchir toutes les vues matérialisées analytics
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.platform_stats_summary;
$$;

COMMENT ON FUNCTION public.refresh_analytics_views() IS 'Rafraîchit toutes les vues matérialisées analytics';
-- ------------------------------
-- END 33_analytics_materialized.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 34_submission_limits.sql
-- ------------------------------
-- =====================================================
-- 34_submission_limits.sql
-- =====================================================
-- Limitations de soumission et améliorations modération
-- Idempotent : CREATE IF NOT EXISTS + ALTER TABLE IF EXISTS
-- =====================================================

-- Ajouter max_submissions_per_creator à contests si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'contests' 
    AND column_name = 'max_submissions_per_creator'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN max_submissions_per_creator integer DEFAULT 1;
    ALTER TABLE public.contests ADD CONSTRAINT contests_max_submissions_positive 
      CHECK (max_submissions_per_creator > 0);
  END IF;
END $$;

-- Ajouter moderated_by et moderation_notes à submissions si pas déjà présents
DO $$
BEGIN
  -- moderated_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'submissions' 
    AND column_name = 'moderated_by'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN moderated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  -- moderation_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'submissions' 
    AND column_name = 'moderation_notes'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN moderation_notes text;
  END IF;
END $$;

-- Ajouter calculated_at à metrics_daily si pas déjà présent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'metrics_daily' 
    AND column_name = 'calculated_at'
  ) THEN
    ALTER TABLE public.metrics_daily ADD COLUMN calculated_at timestamptz;
  END IF;
END $$;

-- Index sur max_submissions_per_creator
CREATE INDEX IF NOT EXISTS idx_contests_max_submissions ON public.contests(max_submissions_per_creator);

-- Index sur moderated_by
CREATE INDEX IF NOT EXISTS idx_submissions_moderated_by ON public.submissions(moderated_by) WHERE moderated_by IS NOT NULL;

-- Index sur calculated_at
CREATE INDEX IF NOT EXISTS idx_metrics_daily_calculated_at ON public.metrics_daily(calculated_at DESC) WHERE calculated_at IS NOT NULL;

-- Fonction pour vérifier si un créateur peut soumettre à un concours
CREATE OR REPLACE FUNCTION public.can_creator_submit(p_contest_id uuid, p_creator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contest RECORD;
  v_submission_count integer;
BEGIN
  -- Récupérer les infos du concours
  SELECT max_submissions_per_creator INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Vérifier le nombre de soumissions existantes
  SELECT COUNT(*) INTO v_submission_count
  FROM public.submissions
  WHERE contest_id = p_contest_id
    AND creator_id = p_creator_id
    AND status NOT IN ('rejected', 'removed');
  
  -- Vérifier si le créateur peut encore soumettre
  RETURN v_submission_count < COALESCE(v_contest.max_submissions_per_creator, 1);
END;
$$;

COMMENT ON FUNCTION public.can_creator_submit(uuid, uuid) IS 'Vérifie si un créateur peut soumettre à un concours (limite max_submissions_per_creator)';

-- Commentaires
COMMENT ON COLUMN public.contests.max_submissions_per_creator IS 'Nombre maximum de soumissions par créateur pour ce concours';
COMMENT ON COLUMN public.submissions.moderated_by IS 'Utilisateur ayant effectué la modération (admin ou marque)';
COMMENT ON COLUMN public.submissions.moderation_notes IS 'Notes de modération (raison détaillée)';
COMMENT ON COLUMN public.metrics_daily.calculated_at IS 'Date/heure de calcul de la métrique (pour vérifier si à jour)';
-- ------------------------------
-- END 34_submission_limits.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 35_weighted_views_calculation.sql
-- ------------------------------
-- =====================================================
-- 35_weighted_views_calculation.sql
-- =====================================================
-- Fonction de calcul du score pondéré et trigger automatique
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction calculate_weighted_views : calcule le score pondéré
CREATE OR REPLACE FUNCTION public.calculate_weighted_views(
  p_views integer,
  p_likes integer,
  p_comments integer,
  p_shares integer
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Formule : views + (likes * 2) + (comments * 3) + (shares * 5)
  -- Les partages ont le plus de poids car ils génèrent le plus d'engagement
  RETURN COALESCE(p_views, 0)::numeric + 
         (COALESCE(p_likes, 0)::numeric * 2) + 
         (COALESCE(p_comments, 0)::numeric * 3) + 
         (COALESCE(p_shares, 0)::numeric * 5);
END;
$$;

COMMENT ON FUNCTION public.calculate_weighted_views(integer, integer, integer, integer) IS 
  'Calcule le score pondéré: views + (likes * 2) + (comments * 3) + (shares * 5)';

-- Fonction update_weighted_views : trigger pour calculer automatiquement weighted_views
CREATE OR REPLACE FUNCTION public.update_weighted_views()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.weighted_views := public.calculate_weighted_views(
    NEW.views,
    NEW.likes,
    NEW.comments,
    NEW.shares
  );
  
  -- Mettre à jour calculated_at si c'est une nouvelle insertion
  IF TG_OP = 'INSERT' OR OLD.weighted_views IS NULL OR OLD.weighted_views != NEW.weighted_views THEN
    NEW.calculated_at := public.now_utc();
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_weighted_views() IS 'Trigger pour calculer automatiquement weighted_views et calculated_at';

-- Trigger pour metrics_daily
DROP TRIGGER IF EXISTS update_metrics_daily_weighted_views ON public.metrics_daily;
CREATE TRIGGER update_metrics_daily_weighted_views
  BEFORE INSERT OR UPDATE OF views, likes, comments, shares ON public.metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_weighted_views();

-- Fonction helper pour recalculer tous les weighted_views d'une soumission
CREATE OR REPLACE FUNCTION public.recalculate_submission_metrics(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.metrics_daily
  SET 
    weighted_views = public.calculate_weighted_views(views, likes, comments, shares),
    calculated_at = public.now_utc(),
    updated_at = public.now_utc()
  WHERE submission_id = p_submission_id;
END;
$$;

COMMENT ON FUNCTION public.recalculate_submission_metrics(uuid) IS 'Recalcule tous les weighted_views d''une soumission';

-- Fonction pour obtenir le score total d'un créateur dans un concours
CREATE OR REPLACE FUNCTION public.get_creator_contest_score(p_contest_id uuid, p_creator_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(md.weighted_views), 0)
  FROM public.submissions s
  INNER JOIN public.metrics_daily md ON md.submission_id = s.id
  WHERE s.contest_id = p_contest_id
    AND s.creator_id = p_creator_id
    AND s.status = 'approved';
$$;

COMMENT ON FUNCTION public.get_creator_contest_score(uuid, uuid) IS 'Retourne le score total pondéré d''un créateur dans un concours';
-- ------------------------------
-- END 35_weighted_views_calculation.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 32_automation_functions.sql
-- ------------------------------
-- =====================================================
-- 32_automation_functions.sql
-- =====================================================
-- Fonctions d'automatisation (cron jobs) pour maintenance
-- Idempotent : CREATE OR REPLACE
-- =====================================================

-- Fonction finalize_contest : finalise un concours et calcule les gains
CREATE OR REPLACE FUNCTION public.finalize_contest(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payouts RECORD;
  v_contest RECORD;
BEGIN
  -- Récupérer les infos du concours
  SELECT id, status, prize_pool_cents INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;
  
  IF v_contest.status != 'active' THEN
    RAISE EXCEPTION 'Contest must be active to be finalized. Current status: %', v_contest.status;
  END IF;
  
  -- Marquer le concours comme terminé
  UPDATE public.contests
  SET status = 'ended', updated_at = public.now_utc()
  WHERE id = p_contest_id;
  
  -- Calculer et stocker les gains
  FOR v_payouts IN
    SELECT * FROM public.compute_payouts(p_contest_id)
  LOOP
    INSERT INTO public.contest_winnings (
      contest_id,
      creator_id,
      rank,
      payout_cents,
      payout_percentage,
      calculated_at
    )
    VALUES (
      p_contest_id,
      v_payouts.creator_id,
      v_payouts.rank,
      v_payouts.payout_cents,
      v_payouts.payout_percentage,
      public.now_utc()
    )
    ON CONFLICT (contest_id, creator_id) DO UPDATE
    SET
      rank = EXCLUDED.rank,
      payout_cents = EXCLUDED.payout_cents,
      payout_percentage = EXCLUDED.payout_percentage,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = public.now_utc();
  END LOOP;
  
  -- Logger l'action
  INSERT INTO public.status_history (table_name, row_id, old_status, new_status, changed_by)
  VALUES ('contests', p_contest_id, 'active', 'ended', auth.uid());
END;
$$;

COMMENT ON FUNCTION public.finalize_contest(uuid) IS 'Finalise un concours actif, calcule et stocke les gains des gagnants';

-- Fonction archive_ended_contests : archive les concours terminés depuis plus de 30 jours
CREATE OR REPLACE FUNCTION public.archive_ended_contests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
  v_now timestamptz := public.now_utc();
BEGIN
  UPDATE public.contests
  SET status = 'archived', updated_at = v_now
  WHERE status = 'ended'
    AND end_at < v_now - INTERVAL '30 days';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Logger les archivages
  INSERT INTO public.status_history (table_name, row_id, old_status, new_status, created_at)
  SELECT 
    'contests',
    id,
    'ended',
    'archived',
    v_now
  FROM public.contests
  WHERE status = 'archived'
    AND updated_at = v_now;
  
  RETURN archived_count;
END;
$$;

COMMENT ON FUNCTION public.archive_ended_contests() IS 'Archive automatiquement les concours terminés depuis plus de 30 jours';

-- Fonction compute_daily_metrics : calcul des métriques quotidiennes (à appeler via cron)
-- Note: Cette fonction doit être complétée selon la logique d'ingestion depuis les APIs
CREATE OR REPLACE FUNCTION public.compute_daily_metrics(p_submission_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission RECORD;
  v_metrics_date date;
BEGIN
  v_metrics_date := CURRENT_DATE;
  
  -- Si submission_id est fourni, calculer pour cette soumission uniquement
  IF p_submission_id IS NOT NULL THEN
    SELECT * INTO v_submission
    FROM public.submissions
    WHERE id = p_submission_id AND status = 'approved';
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Submission not found or not approved: %', p_submission_id;
    END IF;
    
    -- Logique d'ingestion depuis les APIs plateformes
    -- À compléter selon les besoins (TikTok, Instagram, YouTube APIs)
    -- Pour l'instant, cette fonction est un placeholder
    
    RAISE NOTICE 'Metrics computation for submission % not yet implemented', p_submission_id;
  ELSE
    -- Calculer pour toutes les soumissions approuvées du jour
    -- À compléter selon les besoins
    RAISE NOTICE 'Bulk metrics computation not yet implemented';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.compute_daily_metrics(uuid) IS 'Calcule les métriques quotidiennes pour une soumission (à compléter avec logique d''ingestion APIs)';

-- Fonction refresh_all_materialized_views : rafraîchit toutes les vues matérialisées
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rafraîchir leaderboard_materialized
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'leaderboard_materialized') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_materialized;
  END IF;
  
  -- Rafraîchir brand_dashboard_summary (si existe)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'brand_dashboard_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_dashboard_summary;
  END IF;
  
  -- Rafraîchir creator_dashboard_summary (si existe)
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'creator_dashboard_summary') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.creator_dashboard_summary;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refresh_all_materialized_views() IS 'Rafraîchit toutes les vues matérialisées de la base';

-- Fonction cleanup_old_data : nettoie les données anciennes
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS TABLE (
  cleaned_audit_logs bigint,
  cleaned_event_log bigint,
  cleaned_status_history bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_count bigint;
  event_count bigint;
  status_count bigint;
BEGIN
  -- Nettoyer audit_logs de plus de 1 an
  DELETE FROM public.audit_logs 
  WHERE created_at < public.now_utc() - INTERVAL '1 year';
  GET DIAGNOSTICS audit_count = ROW_COUNT;
  
  -- Nettoyer event_log de plus de 6 mois
  DELETE FROM public.event_log 
  WHERE created_at < public.now_utc() - INTERVAL '6 months';
  GET DIAGNOSTICS event_count = ROW_COUNT;
  
  -- Nettoyer status_history de plus de 1 an
  DELETE FROM public.status_history 
  WHERE created_at < public.now_utc() - INTERVAL '1 year';
  GET DIAGNOSTICS status_count = ROW_COUNT;
  
  RETURN QUERY SELECT audit_count, event_count, status_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_data() IS 'Nettoie les données anciennes (audit_logs, event_log, status_history)';
-- ------------------------------
-- END 32_automation_functions.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 37_create_contest_complete.sql
-- ------------------------------
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
-- ------------------------------
-- END 37_create_contest_complete.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 11_rls_policies.sql
-- ------------------------------
-- =====================================================
-- 11_rls_policies.sql
-- =====================================================
-- Politiques RLS (Row Level Security) pour toutes les tables
-- Idempotent : DROP POLICY IF EXISTS + CREATE POLICY
-- =====================================================

-- =====================================================
-- PROFILES
-- =====================================================

-- Creator : CRUD sur son propre profil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- Admin : accès complet
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture profils actifs (supprimée pour éviter l'exposition email)
DROP POLICY IF EXISTS "profiles_public_read_active" ON public.profiles;
-- CREATE POLICY "profiles_public_read_active" ON public.profiles
--   FOR SELECT USING (is_active = true);

-- =====================================================
-- PROFILE_BRANDS
-- =====================================================

DROP POLICY IF EXISTS "profile_brands_select_own" ON public.profile_brands;
CREATE POLICY "profile_brands_select_own" ON public.profile_brands
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_insert_own" ON public.profile_brands;
CREATE POLICY "profile_brands_insert_own" ON public.profile_brands
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_update_own" ON public.profile_brands;
CREATE POLICY "profile_brands_update_own" ON public.profile_brands
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_delete_own" ON public.profile_brands;
CREATE POLICY "profile_brands_delete_own" ON public.profile_brands
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_admin_all" ON public.profile_brands;
CREATE POLICY "profile_brands_admin_all" ON public.profile_brands
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PROFILE_CREATORS
-- =====================================================

DROP POLICY IF EXISTS "profile_creators_select_own" ON public.profile_creators;
CREATE POLICY "profile_creators_select_own" ON public.profile_creators
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_insert_own" ON public.profile_creators;
CREATE POLICY "profile_creators_insert_own" ON public.profile_creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_update_own" ON public.profile_creators;
CREATE POLICY "profile_creators_update_own" ON public.profile_creators
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_delete_own" ON public.profile_creators;
CREATE POLICY "profile_creators_delete_own" ON public.profile_creators
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_admin_all" ON public.profile_creators;
CREATE POLICY "profile_creators_admin_all" ON public.profile_creators
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des profils créateurs
DROP POLICY IF EXISTS "profile_creators_public_read" ON public.profile_creators;
CREATE POLICY "profile_creators_public_read" ON public.profile_creators
  FOR SELECT USING (true);

-- =====================================================
-- CONTESTS
-- =====================================================

-- Brand : CRUD sur ses concours
DROP POLICY IF EXISTS "contests_brand_manage_own" ON public.contests;
CREATE POLICY "contests_brand_manage_own" ON public.contests
  FOR ALL USING (auth.uid() = brand_id)
  WITH CHECK (auth.uid() = brand_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "contests_admin_all" ON public.contests;
CREATE POLICY "contests_admin_all" ON public.contests
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement sur les concours actifs
DROP POLICY IF EXISTS "contests_public_read_active" ON public.contests;
CREATE POLICY "contests_public_read_active" ON public.contests
  FOR SELECT USING (status = 'active' AND start_at <= public.now_utc() AND end_at >= public.now_utc());

-- Creator : lecture pour participation
DROP POLICY IF EXISTS "contests_creator_read_for_participation" ON public.contests;
CREATE POLICY "contests_creator_read_for_participation" ON public.contests
  FOR SELECT USING (
    status IN ('active', 'ended') 
    AND start_at <= public.now_utc()
  );

-- =====================================================
-- CONTEST_TERMS
-- =====================================================

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_terms_public_read" ON public.contest_terms;
CREATE POLICY "contest_terms_public_read" ON public.contest_terms
  FOR SELECT USING (true);

-- Admin : gestion complète
DROP POLICY IF EXISTS "contest_terms_admin_all" ON public.contest_terms;
CREATE POLICY "contest_terms_admin_all" ON public.contest_terms
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CONTEST_ASSETS
-- =====================================================

-- Brand : gestion des assets de ses concours
DROP POLICY IF EXISTS "contest_assets_brand_manage" ON public.contest_assets;
CREATE POLICY "contest_assets_brand_manage" ON public.contest_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_assets_admin_all" ON public.contest_assets;
CREATE POLICY "contest_assets_admin_all" ON public.contest_assets
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des assets des concours actifs
DROP POLICY IF EXISTS "contest_assets_public_read_active" ON public.contest_assets;
CREATE POLICY "contest_assets_public_read_active" ON public.contest_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- SUBMISSIONS
-- =====================================================

-- Creator : CRUD sur ses propres soumissions
DROP POLICY IF EXISTS "submissions_creator_manage_own" ON public.submissions;
CREATE POLICY "submissions_creator_manage_own" ON public.submissions
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- INSERT: impose une acceptation de CGU pour la bonne version (si définie sur le concours)
DROP POLICY IF EXISTS "submissions_creator_insert_requires_terms" ON public.submissions;
CREATE POLICY "submissions_creator_insert_requires_terms" ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.contests c
        WHERE c.id = submissions.contest_id
          AND c.contest_terms_id IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.contest_terms_acceptances cta
        JOIN public.contests c ON c.id = submissions.contest_id
        WHERE cta.user_id = auth.uid()
          AND cta.contest_id = submissions.contest_id
          AND c.contest_terms_id IS NOT NULL
          AND cta.contest_terms_id = c.contest_terms_id
      )
    )
  );

-- Brand : lecture des soumissions liées à ses concours
DROP POLICY IF EXISTS "submissions_brand_read_own_contests" ON public.submissions;
CREATE POLICY "submissions_brand_read_own_contests" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = submissions.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "submissions_admin_all" ON public.submissions;
CREATE POLICY "submissions_admin_all" ON public.submissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des soumissions approuvées des concours actifs
DROP POLICY IF EXISTS "submissions_public_read_approved_active" ON public.submissions;
CREATE POLICY "submissions_public_read_approved_active" ON public.submissions
  FOR SELECT USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = submissions.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- METRICS_DAILY
-- =====================================================

-- Creator : lecture de ses métriques (via submission)
DROP POLICY IF EXISTS "metrics_daily_creator_read_own" ON public.metrics_daily;
CREATE POLICY "metrics_daily_creator_read_own" ON public.metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = metrics_daily.submission_id
      AND s.creator_id = auth.uid()
    )
  );

-- Brand : lecture des métriques des soumissions de ses concours
DROP POLICY IF EXISTS "metrics_daily_brand_read_own_contests" ON public.metrics_daily;
CREATE POLICY "metrics_daily_brand_read_own_contests" ON public.metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      INNER JOIN public.contests c ON c.id = s.contest_id
      WHERE s.id = metrics_daily.submission_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "metrics_daily_admin_all" ON public.metrics_daily;
CREATE POLICY "metrics_daily_admin_all" ON public.metrics_daily
  FOR ALL USING (public.is_admin(auth.uid()));

-- IMPORTANT : INSERT/UPDATE réservés au service role uniquement (pas de politique RLS pour INSERT/UPDATE)
-- Les métriques sont écrites par des Edge Functions ou cron jobs avec service_role

-- =====================================================
-- PAYMENTS_BRAND
-- =====================================================

-- Brand : CRUD sur ses paiements
DROP POLICY IF EXISTS "payments_brand_brand_manage_own" ON public.payments_brand;
CREATE POLICY "payments_brand_brand_manage_own" ON public.payments_brand
  FOR ALL USING (auth.uid() = brand_id)
  WITH CHECK (auth.uid() = brand_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "payments_brand_admin_all" ON public.payments_brand;
CREATE POLICY "payments_brand_admin_all" ON public.payments_brand
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CASHOUTS
-- =====================================================

-- Creator : CRUD sur ses propres cashouts
DROP POLICY IF EXISTS "cashouts_creator_manage_own" ON public.cashouts;
CREATE POLICY "cashouts_creator_manage_own" ON public.cashouts
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "cashouts_admin_all" ON public.cashouts;
CREATE POLICY "cashouts_admin_all" ON public.cashouts
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- WEBHOOKS_STRIPE
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "webhooks_stripe_admin_all" ON public.webhooks_stripe;
CREATE POLICY "webhooks_stripe_admin_all" ON public.webhooks_stripe
  FOR ALL USING (public.is_admin(auth.uid()));

-- IMPORTANT : INSERT réservé au service role pour les webhooks Stripe

-- =====================================================
-- MODERATION_QUEUE
-- =====================================================

-- Admin : accès complet
DROP POLICY IF EXISTS "moderation_queue_admin_all" ON public.moderation_queue;
CREATE POLICY "moderation_queue_admin_all" ON public.moderation_queue
  FOR ALL USING (public.is_admin(auth.uid()));

-- Brand : lecture seulement pour les soumissions de ses concours
DROP POLICY IF EXISTS "moderation_queue_brand_read_own_contests" ON public.moderation_queue;
CREATE POLICY "moderation_queue_brand_read_own_contests" ON public.moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      INNER JOIN public.contests c ON c.id = s.contest_id
      WHERE s.id = moderation_queue.submission_id
      AND c.brand_id = auth.uid()
    )
  );

-- Creator : lecture seulement de ses propres soumissions
DROP POLICY IF EXISTS "moderation_queue_creator_read_own" ON public.moderation_queue;
CREATE POLICY "moderation_queue_creator_read_own" ON public.moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = moderation_queue.submission_id
      AND s.creator_id = auth.uid()
    )
  );

-- =====================================================
-- MODERATION_RULES
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "moderation_rules_admin_all" ON public.moderation_rules;
CREATE POLICY "moderation_rules_admin_all" ON public.moderation_rules
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- AUDIT_LOGS
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all" ON public.audit_logs
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MESSAGES_THREADS
-- =====================================================

-- Brand et Creator : CRUD sur leurs threads
DROP POLICY IF EXISTS "messages_threads_participants_manage" ON public.messages_threads;
CREATE POLICY "messages_threads_participants_manage" ON public.messages_threads
  FOR ALL USING (auth.uid() = brand_id OR auth.uid() = creator_id)
  WITH CHECK (auth.uid() = brand_id OR auth.uid() = creator_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "messages_threads_admin_all" ON public.messages_threads;
CREATE POLICY "messages_threads_admin_all" ON public.messages_threads
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MESSAGES
-- =====================================================

-- Participants du thread : CRUD sur les messages de leurs threads
DROP POLICY IF EXISTS "messages_participants_manage" ON public.messages;
CREATE POLICY "messages_participants_manage" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.messages_threads mt
      WHERE mt.id = messages.thread_id
      AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages_threads mt
      WHERE mt.id = messages.thread_id
      AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
CREATE POLICY "messages_admin_all" ON public.messages
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- User : CRUD sur ses propres notifications
DROP POLICY IF EXISTS "notifications_user_manage_own" ON public.notifications;
CREATE POLICY "notifications_user_manage_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- ORGS
-- =====================================================

-- Membres de l'org + admin : gestion complète
DROP POLICY IF EXISTS "orgs_members_manage" ON public.orgs;
CREATE POLICY "orgs_members_manage" ON public.orgs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = orgs.id
      AND user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = orgs.id
      AND user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- ORG_MEMBERS
-- =====================================================

-- Membres de l'org + admin : lecture
DROP POLICY IF EXISTS "org_members_read_own_org" ON public.org_members;
CREATE POLICY "org_members_read_own_org" ON public.org_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Owner : gestion des membres
DROP POLICY IF EXISTS "org_members_owner_manage" ON public.org_members;
CREATE POLICY "org_members_owner_manage" ON public.org_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org = 'owner'
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org = 'owner'
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- PLATFORM_ACCOUNTS
-- =====================================================

-- Propriétaire : CRUD sur ses comptes
DROP POLICY IF EXISTS "platform_accounts_owner_manage" ON public.platform_accounts;
CREATE POLICY "platform_accounts_owner_manage" ON public.platform_accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "platform_accounts_admin_all" ON public.platform_accounts;
CREATE POLICY "platform_accounts_admin_all" ON public.platform_accounts
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PLATFORM_OAUTH_TOKENS
-- =====================================================

-- Propriétaire : lecture seulement
DROP POLICY IF EXISTS "platform_oauth_tokens_owner_read" ON public.platform_oauth_tokens;
CREATE POLICY "platform_oauth_tokens_owner_read" ON public.platform_oauth_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_accounts pa
      WHERE pa.id = platform_oauth_tokens.account_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- IMPORTANT : INSERT/UPDATE réservés au service_role uniquement
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- INGESTION_JOBS
-- =====================================================

-- Propriétaire du compte : lecture
DROP POLICY IF EXISTS "ingestion_jobs_owner_read" ON public.ingestion_jobs;
CREATE POLICY "ingestion_jobs_owner_read" ON public.ingestion_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_accounts pa
      WHERE pa.id = ingestion_jobs.account_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Service role : gestion complète
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- INGESTION_ERRORS
-- =====================================================

-- Propriétaire du compte (via job) : lecture
DROP POLICY IF EXISTS "ingestion_errors_owner_read" ON public.ingestion_errors;
CREATE POLICY "ingestion_errors_owner_read" ON public.ingestion_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs ij
      INNER JOIN public.platform_accounts pa ON pa.id = ij.account_id
      WHERE ij.id = ingestion_errors.job_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- NOTIFICATION_PREFERENCES
-- =====================================================

-- Propriétaire : CRUD
DROP POLICY IF EXISTS "notification_preferences_owner_manage" ON public.notification_preferences;
CREATE POLICY "notification_preferences_owner_manage" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "notification_preferences_admin_all" ON public.notification_preferences;
CREATE POLICY "notification_preferences_admin_all" ON public.notification_preferences
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PUSH_TOKENS
-- =====================================================

-- Propriétaire : CRUD
DROP POLICY IF EXISTS "push_tokens_owner_manage" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_manage" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "push_tokens_admin_all" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_all" ON public.push_tokens
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- INVOICES
-- =====================================================

-- Membres de l'org (rôles admin/finance) + admin : gestion
DROP POLICY IF EXISTS "invoices_org_members_manage" ON public.invoices;
CREATE POLICY "invoices_org_members_manage" ON public.invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org IN ('owner', 'admin', 'finance')
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org IN ('owner', 'admin', 'finance')
    )
    OR public.is_admin(auth.uid())
  );

-- Membres de l'org (lecture) : lecture
DROP POLICY IF EXISTS "invoices_org_members_read" ON public.invoices;
CREATE POLICY "invoices_org_members_read" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- TAX_EVIDENCE
-- =====================================================

-- Membres de l'org + admin : gestion
DROP POLICY IF EXISTS "tax_evidence_org_members_manage" ON public.tax_evidence;
CREATE POLICY "tax_evidence_org_members_manage" ON public.tax_evidence
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = tax_evidence.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = tax_evidence.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- KYC_CHECKS
-- =====================================================

-- Propriétaire : lecture
DROP POLICY IF EXISTS "kyc_checks_owner_read" ON public.kyc_checks;
CREATE POLICY "kyc_checks_owner_read" ON public.kyc_checks
  FOR SELECT USING (auth.uid() = user_id);

-- Admin : gestion complète
DROP POLICY IF EXISTS "kyc_checks_admin_all" ON public.kyc_checks;
CREATE POLICY "kyc_checks_admin_all" ON public.kyc_checks
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- RISK_FLAGS
-- =====================================================

-- Propriétaire : lecture
DROP POLICY IF EXISTS "risk_flags_owner_read" ON public.risk_flags;
CREATE POLICY "risk_flags_owner_read" ON public.risk_flags
  FOR SELECT USING (auth.uid() = user_id);

-- Admin : gestion complète
DROP POLICY IF EXISTS "risk_flags_admin_all" ON public.risk_flags;
CREATE POLICY "risk_flags_admin_all" ON public.risk_flags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- ASSETS
-- =====================================================

-- Propriétaire (owner_id) : CRUD
DROP POLICY IF EXISTS "assets_owner_manage" ON public.assets;
CREATE POLICY "assets_owner_manage" ON public.assets
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Membres de l'org : CRUD
DROP POLICY IF EXISTS "assets_org_members_manage" ON public.assets;
CREATE POLICY "assets_org_members_manage" ON public.assets
  FOR ALL USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = assets.org_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = assets.org_id
      AND om.user_id = auth.uid()
    )
  );

-- Public : lecture seulement si visibility='public'
DROP POLICY IF EXISTS "assets_public_read_public" ON public.assets;
CREATE POLICY "assets_public_read_public" ON public.assets
  FOR SELECT USING (visibility = 'public');

-- Admin : accès complet
DROP POLICY IF EXISTS "assets_admin_all" ON public.assets;
CREATE POLICY "assets_admin_all" ON public.assets
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MODERATION_ACTIONS
-- =====================================================

-- Admin only : accès complet
DROP POLICY IF EXISTS "moderation_actions_admin_all" ON public.moderation_actions;
CREATE POLICY "moderation_actions_admin_all" ON public.moderation_actions
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- WEBHOOK_ENDPOINTS
-- =====================================================

-- Membres de l'org + admin : gestion
DROP POLICY IF EXISTS "webhook_endpoints_org_members_manage" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints_org_members_manage" ON public.webhook_endpoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = webhook_endpoints.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = webhook_endpoints.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- WEBHOOK_DELIVERIES
-- =====================================================

-- Membres de l'org (via endpoint) + admin : lecture
DROP POLICY IF EXISTS "webhook_deliveries_org_members_read" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_org_members_read" ON public.webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints we
      INNER JOIN public.org_members om ON om.org_id = we.org_id
      WHERE we.id = webhook_deliveries.endpoint_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Service role : INSERT uniquement
-- Pas de politique publique pour INSERT

-- =====================================================
-- EVENT_LOG
-- =====================================================

-- User : lecture de ses propres événements
DROP POLICY IF EXISTS "event_log_user_read_own" ON public.event_log;
CREATE POLICY "event_log_user_read_own" ON public.event_log
  FOR SELECT USING (auth.uid() = user_id);

-- Membres de l'org : lecture des événements de l'org
DROP POLICY IF EXISTS "event_log_org_members_read" ON public.event_log;
CREATE POLICY "event_log_org_members_read" ON public.event_log
  FOR SELECT USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = event_log.org_id
      AND om.user_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "event_log_admin_all" ON public.event_log;
CREATE POLICY "event_log_admin_all" ON public.event_log
  FOR ALL USING (public.is_admin(auth.uid()));

-- Service role : INSERT uniquement
-- Pas de politique publique pour INSERT

-- =====================================================
-- CONTEST_PRIZES
-- =====================================================

-- Brand : gestion des prix de ses concours
DROP POLICY IF EXISTS "contest_prizes_brand_manage" ON public.contest_prizes;
CREATE POLICY "contest_prizes_brand_manage" ON public.contest_prizes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_prizes_admin_all" ON public.contest_prizes;
CREATE POLICY "contest_prizes_admin_all" ON public.contest_prizes
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement pour concours actifs
DROP POLICY IF EXISTS "contest_prizes_public_read_active" ON public.contest_prizes;
CREATE POLICY "contest_prizes_public_read_active" ON public.contest_prizes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- CONTEST_WINNINGS
-- =====================================================

-- Creator : lecture de ses propres gains
DROP POLICY IF EXISTS "contest_winnings_creator_read_own" ON public.contest_winnings;
CREATE POLICY "contest_winnings_creator_read_own" ON public.contest_winnings
  FOR SELECT USING (auth.uid() = creator_id);

-- Brand : lecture des gains de ses concours
DROP POLICY IF EXISTS "contest_winnings_brand_read_own_contests" ON public.contest_winnings;
CREATE POLICY "contest_winnings_brand_read_own_contests" ON public.contest_winnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_winnings.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_winnings_admin_all" ON public.contest_winnings;
CREATE POLICY "contest_winnings_admin_all" ON public.contest_winnings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Service role : INSERT/UPDATE pour calcul automatique
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- CONTEST_TERMS_ACCEPTANCES
-- =====================================================

-- User : lecture de ses propres acceptations
DROP POLICY IF EXISTS "contest_terms_acceptances_user_read_own" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_user_read_own" ON public.contest_terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- User : insertion de ses propres acceptations
DROP POLICY IF EXISTS "contest_terms_acceptances_user_insert_own" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_user_insert_own" ON public.contest_terms_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brand : lecture des acceptations de ses concours
DROP POLICY IF EXISTS "contest_terms_acceptances_brand_read_own_contests" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_brand_read_own_contests" ON public.contest_terms_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_terms_acceptances.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_terms_acceptances_admin_all" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_admin_all" ON public.contest_terms_acceptances
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- FOLLOWS
-- =====================================================

-- User : CRUD sur ses propres follows
DROP POLICY IF EXISTS "follows_user_manage" ON public.follows;
CREATE POLICY "follows_user_manage" ON public.follows
  FOR ALL USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- Public : lecture seulement (pour voir qui suit qui)
DROP POLICY IF EXISTS "follows_public_read" ON public.follows;
CREATE POLICY "follows_public_read" ON public.follows
  FOR SELECT USING (true);

-- =====================================================
-- CONTEST_FAVORITES
-- =====================================================

-- User : CRUD sur ses propres favoris
DROP POLICY IF EXISTS "contest_favorites_user_manage" ON public.contest_favorites;
CREATE POLICY "contest_favorites_user_manage" ON public.contest_favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CONTEST_TAGS
-- =====================================================

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_tags_public_read" ON public.contest_tags;
CREATE POLICY "contest_tags_public_read" ON public.contest_tags
  FOR SELECT USING (is_active = true);

-- Admin : gestion complète
DROP POLICY IF EXISTS "contest_tags_admin_all" ON public.contest_tags;
CREATE POLICY "contest_tags_admin_all" ON public.contest_tags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CONTEST_TAG_LINKS
-- =====================================================

-- Brand : gestion des tags de ses concours
DROP POLICY IF EXISTS "contest_tag_links_brand_manage" ON public.contest_tag_links;
CREATE POLICY "contest_tag_links_brand_manage" ON public.contest_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_tag_links.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_tag_links.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_tag_links_public_read" ON public.contest_tag_links;
CREATE POLICY "contest_tag_links_public_read" ON public.contest_tag_links
  FOR SELECT USING (true);

-- =====================================================
-- STATUS_HISTORY
-- =====================================================

-- User : lecture de l'historique de ses propres entités
DROP POLICY IF EXISTS "status_history_user_read_own" ON public.status_history;
CREATE POLICY "status_history_user_read_own" ON public.status_history
  FOR SELECT USING (
    (table_name = 'submissions' AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = status_history.row_id AND s.creator_id = auth.uid()
    ))
    OR (table_name = 'contests' AND EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = status_history.row_id AND c.brand_id = auth.uid()
    ))
    OR (table_name = 'cashouts' AND EXISTS (
      SELECT 1 FROM public.cashouts c
      WHERE c.id = status_history.row_id AND c.creator_id = auth.uid()
    ))
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "status_history_admin_all" ON public.status_history;
CREATE POLICY "status_history_admin_all" ON public.status_history
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- SUBMISSION_COMMENTS
-- =====================================================

-- Participants : CRUD sur les commentaires de leurs soumissions
DROP POLICY IF EXISTS "submission_comments_participants_manage" ON public.submission_comments;
CREATE POLICY "submission_comments_participants_manage" ON public.submission_comments
  FOR ALL USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_comments.submission_id
      AND (s.creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = s.contest_id AND c.brand_id = auth.uid()
      ))
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_comments.submission_id
      AND (s.creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = s.contest_id AND c.brand_id = auth.uid()
      ))
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "submission_comments_admin_all" ON public.submission_comments;
CREATE POLICY "submission_comments_admin_all" ON public.submission_comments
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- NOTIFICATION_TEMPLATES
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "notification_templates_admin_all" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_all" ON public.notification_templates
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS 'Créateur peut lire son propre profil';
COMMENT ON POLICY "contests_public_read_active" ON public.contests IS 'Public peut lire les concours actifs';
COMMENT ON POLICY "metrics_daily_creator_read_own" ON public.metrics_daily IS 'Créateur peut lire ses métriques';
COMMENT ON POLICY "orgs_members_manage" ON public.orgs IS 'Membres de l''org peuvent gérer leur organisation';
COMMENT ON POLICY "assets_public_read_public" ON public.assets IS 'Assets publics sont lisibles sans auth';
COMMENT ON POLICY "moderation_actions_admin_all" ON public.moderation_actions IS 'Historique modération: admin only';
-- ------------------------------
-- END 11_rls_policies.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 10_triggers.sql
-- ------------------------------
-- =====================================================
-- 10_triggers.sql
-- =====================================================
-- Triggers (update_updated_at, update_message_thread, audit_logs_insert)
-- Idempotent : CREATE OR REPLACE + DROP IF EXISTS
-- =====================================================

-- Fonction update_updated_at : met à jour automatiquement le champ updated_at
-- CORRECTION : utilise NEW.updated_at = now_utc() (pas auth.uid() = NOW())
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := public.now_utc();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at() IS 'Met à jour automatiquement le champ updated_at avec now_utc()';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %2$I.%1$I', r.table_name, r.table_schema);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %2$I.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      r.table_name, r.table_schema
    );
  END LOOP;
END $$;

-- Fonction update_message_thread : met à jour last_message, updated_at, unread_for_*
-- CORRECTION : utilise NEW.sender_id et NEW.thread_id (pas auth.uid())
CREATE OR REPLACE FUNCTION public.update_message_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread RECORD;
BEGIN
  -- Récupérer les infos du thread
  SELECT brand_id, creator_id INTO v_thread
  FROM public.messages_threads
  WHERE id = NEW.thread_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Mettre à jour le thread
  UPDATE public.messages_threads
  SET 
    last_message = LEFT(NEW.body, 100),
    updated_at = public.now_utc(),
    unread_for_brand = CASE 
      WHEN NEW.sender_id = v_thread.brand_id THEN unread_for_brand
      ELSE true
    END,
    unread_for_creator = CASE 
      WHEN NEW.sender_id = v_thread.creator_id THEN unread_for_creator
      ELSE true
    END
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_message_thread() IS 'Met à jour last_message, updated_at et unread_for_* selon le sender_id';

-- Trigger pour messages
DROP TRIGGER IF EXISTS update_message_thread_trigger ON public.messages;
CREATE TRIGGER update_message_thread_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_message_thread();

-- Fonction audit_logs_insert : log des actions sensibles
CREATE OR REPLACE FUNCTION public.audit_logs_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_pk uuid;
BEGIN
  -- Extraire la clé primaire (supposée être 'id' de type uuid)
  IF TG_OP = 'DELETE' THEN
    v_row_pk := OLD.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      v_row_pk,
      to_jsonb(OLD),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_row_pk := NEW.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      v_row_pk,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_row_pk := NEW.id;
    INSERT INTO public.audit_logs (actor_id, action, table_name, row_pk, old_values, new_values)
    VALUES (
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      v_row_pk,
      NULL,
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_logs_insert() IS 'Log automatique des actions INSERT/UPDATE/DELETE sur tables sensibles';

-- Appliquer le trigger audit_logs_insert sur les tables sensibles
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'contests',
      'submissions',
      'payments_brand',
      'cashouts',
      'contest_winnings'
    )
  LOOP
    -- Supprimer le trigger existant s'il existe
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s_trigger ON public.%I', r.tablename, r.tablename);
    
    -- Créer le trigger
    EXECUTE format('
      CREATE TRIGGER audit_%s_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_logs_insert()
    ', r.tablename, r.tablename);
  END LOOP;
END $$;
-- ------------------------------
-- END 10_triggers.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 12_public_profiles_view.sql
-- ------------------------------
-- =====================================================
-- 12_public_profiles_view.sql
-- =====================================================
-- Vue publique sans email pour exposition contrôlée des profils actifs
-- Utilise une fonction SECURITY DEFINER pour contourner RLS tout en limitant
-- strictement le jeu de colonnes et de lignes exposées.
-- Idempotent.
-- =====================================================

-- Function returning only safe, non-sensitive columns for active profiles
CREATE OR REPLACE FUNCTION public.public_profiles_safe()
RETURNS TABLE (
  id uuid,
  role user_role,
  display_name text,
  avatar_url text,
  country text
) AS $$
  SELECT p.id, p.role, p.display_name, p.avatar_url, p.country
  FROM public.profiles AS p
  WHERE p.is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- View exposed to clients (anon/authenticated)
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT * FROM public.public_profiles_safe();

-- Allow function execution for exposed roles
GRANT EXECUTE ON FUNCTION public.public_profiles_safe() TO anon, authenticated;

-- Harden base table exposure for anon (defense-in-depth)
REVOKE ALL ON TABLE public.profiles FROM anon;

-- Grant safe read on the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS 'Vue publique des profils actifs (sans email)';
-- ------------------------------
-- END 12_public_profiles_view.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 12_storage_policies.sql
-- ------------------------------
-- =====================================================
-- 12_storage_policies.sql (corrigé)
-- =====================================================
-- Buckets Storage et politiques d'accès
-- Idempotent : DROP POLICY IF EXISTS + CREATE POLICY
-- =====================================================

-- S'assurer que RLS est activé sur storage.objects (requiert d'être propriétaire)
DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable RLS on storage.objects: %', SQLERRM;
  END;
END $$;

-- Helper: check owner and return early if not owner (per block)
-- Bucket : avatars
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip avatars policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  -- Supprimer si existe, puis créer
  DROP POLICY IF EXISTS "avatars_upload_own" ON storage.objects;
  CREATE POLICY "avatars_upload_own" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

  DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
  CREATE POLICY "avatars_read_public" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'avatars');

  DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
  CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

  DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
  CREATE POLICY "avatars_delete_own" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'avatars policies: %', SQLERRM;
END $$;

-- Bucket : contest_assets
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip contest_assets policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "contest_assets_upload_brand" ON storage.objects;
  CREATE POLICY "contest_assets_upload_brand" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "contest_assets_read_public" ON storage.objects;
  CREATE POLICY "contest_assets_read_public" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'contest_assets');

  DROP POLICY IF EXISTS "contest_assets_update_brand" ON storage.objects;
  CREATE POLICY "contest_assets_update_brand" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "contest_assets_delete_brand" ON storage.objects;
  CREATE POLICY "contest_assets_delete_brand" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'contest_assets'
      AND EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id::text = split_part(name, '/', 1)
        AND c.brand_id = (SELECT auth.uid())::uuid
      )
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'contest_assets policies: %', SQLERRM;
END $$;

-- Bucket : ugc_videos
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip ugc_videos policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "ugc_videos_upload_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_upload_creator" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_read_approved" ON storage.objects;
  CREATE POLICY "ugc_videos_read_approved" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.status = 'approved'
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_update_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_update_creator" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );

  DROP POLICY IF EXISTS "ugc_videos_delete_creator" ON storage.objects;
  CREATE POLICY "ugc_videos_delete_creator" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ugc_videos'
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id::text = (storage.foldername(name))[1]
        AND s.creator_id = (SELECT auth.uid())::uuid
      )
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ugc_videos policies: %', SQLERRM;
END $$;

-- Bucket : invoices
DO $$
DECLARE
  v_owner text;
BEGIN
  SELECT c.relowner::regrole::text INTO v_owner
  FROM pg_class c
  WHERE c.relname = 'objects' AND c.relnamespace = 'storage'::regnamespace;

  IF v_owner IS DISTINCT FROM current_user THEN
    RAISE NOTICE 'Skip invoices policies: current_user % is not owner of storage.objects (%). Run as % or via service_role.', current_user, v_owner, v_owner;
    RETURN;
  END IF;

  -- Policy d'INSERT pour service role uniquement (génération automatique)
  DROP POLICY IF EXISTS "invoices_insert_service_role" ON storage.objects;
  CREATE POLICY "invoices_insert_service_role" ON storage.objects
    FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'invoices');

  -- Policy de lecture : les marques peuvent lire leurs propres factures
  -- Structure: {brand_id}/invoices/{filename}
  DROP POLICY IF EXISTS "invoices_read_own" ON storage.objects;
  CREATE POLICY "invoices_read_own" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'invoices'
      AND (
        -- Structure: {brand_id}/invoices/{filename}
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        -- Ou via payments_brand (fallback pour compatibilité)
        OR EXISTS (
          SELECT 1 FROM public.payments_brand pb
          WHERE pb.brand_id = (SELECT auth.uid())::uuid
          AND pb.metadata->>'invoice_pdf_url' LIKE '%' || name || '%'
        )
      )
    );

  DROP POLICY IF EXISTS "invoices_admin_all" ON storage.objects;
  CREATE POLICY "invoices_admin_all" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'invoices'
      AND public.is_admin((SELECT auth.uid())::uuid)
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'invoices policies: %', SQLERRM;
END $$;

-- Commentaires (créez-les uniquement si la policy existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='avatars_upload_own') THEN
    COMMENT ON POLICY "avatars_upload_own" ON storage.objects IS 'Users can upload their own avatars';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='contest_assets_read_public') THEN
    COMMENT ON POLICY "contest_assets_read_public" ON storage.objects IS 'Contest assets are publicly readable';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='ugc_videos_read_approved') THEN
    COMMENT ON POLICY "ugc_videos_read_approved" ON storage.objects IS 'UGC videos are publicly readable if submission is approved';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND polname='invoices_read_own') THEN
    COMMENT ON POLICY "invoices_read_own" ON storage.objects IS 'Users can read their own invoices';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add comments on policies: %', SQLERRM;
END $$;
-- ------------------------------
-- END 12_storage_policies.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 12a_create_contest_assets_bucket.sql
-- ------------------------------
-- =====================================================
-- 12a_create_contest_assets_bucket.sql
-- =====================================================
-- Création idempotente du bucket 'contest_assets' pour stocker les assets des concours
-- (images, vidéos, PDFs, logos produits, etc.)
-- =====================================================

-- 1) Vérifier que la table storage.buckets existe avant d'essayer d'insérer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'buckets'
      AND n.nspname = 'storage'
  ) THEN
    -- 2) Insérer ou mettre à jour le bucket
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'contest_assets',
        'contest_assets',
        false,                 -- private (access controlled by storage.objects RLS policies)
        209715200,            -- 200 MB (limite mentionnée dans l'UI)
        ARRAY[
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/webm',
          'video/quicktime',
          'application/pdf'
        ]::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

      RAISE NOTICE 'Bucket contest_assets créé ou mis à jour.';
    EXCEPTION WHEN others THEN
      -- Attraper les erreurs d'autorisation ou autres et les relayer proprement
      RAISE NOTICE 'Échec de l''insertion/mise à jour du bucket contest_assets : %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La table storage.buckets n''existe pas ; aucune action effectuée.';
  END IF;
END;
$$ LANGUAGE plpgsql;
-- ------------------------------
-- END 12a_create_contest_assets_bucket.sql
-- ------------------------------


-- ------------------------------
-- BEGIN 12b_create_invoices_bucket.sql
-- ------------------------------
-- =====================================================
-- 12b_create_invoices_bucket.sql (corrigé)
-- =====================================================
-- Création idempotente du bucket 'invoices' pour stocker les factures PDF
-- Remarque : n'exécutez COMMENT ON TABLE que si vous êtes propriétaire/superuser.
-- =====================================================

-- 1) Vérifier que la table storage.buckets existe avant d'essayer d'insérer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'buckets'
      AND n.nspname = 'storage'
  ) THEN
    -- 2) Insérer ou mettre à jour le bucket
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'invoices',
        'invoices',
        false,                 -- privé
        10485760,              -- 10 MB
        ARRAY['application/pdf']::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

      RAISE NOTICE 'Bucket invoices créé ou mis à jour.';
    EXCEPTION WHEN others THEN
      -- Attraper les erreurs d'autorisation ou autres et les relayer proprement
      RAISE NOTICE 'Échec de l''insertion/mise à jour du bucket invoices : %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La table storage.buckets n''existe pas ; aucune action effectuée.';
  END IF;
END;
$$ LANGUAGE plpgsql;
-- ------------------------------
-- END 12b_create_invoices_bucket.sql
-- ------------------------------


-- =====================================================
-- PATCHES (baseline safety + consistency)
-- =====================================================

-- Ensure platform_settings has the maintenance flag (admin_read_only)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('admin_read_only', 'false'::jsonb, 'Admin read-only mode (maintenance)')
ON CONFLICT (key) DO NOTHING;

-- cashout_reviews: RLS was enabled but no policies existed in the repo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='cashout_reviews') THEN
    ALTER TABLE public.cashout_reviews ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "cashout_reviews_admin_all" ON public.cashout_reviews;
    CREATE POLICY "cashout_reviews_admin_all" ON public.cashout_reviews
      FOR ALL
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Admin KPI materialized views (fixed version of 52_admin_kpi_materialized.sql)
DO $$ BEGIN
  -- admin_kpis_daily
  CREATE MATERIALIZED VIEW IF NOT EXISTS public.admin_kpis_daily AS
  SELECT
    d::date AS kpi_date,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.role='brand'   AND p.created_at::date = d::date)::bigint AS new_brands,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.role='creator' AND p.created_at::date = d::date)::bigint AS new_creators,
    (SELECT COUNT(*) FROM public.contests c WHERE c.created_at::date = d::date)::bigint AS new_contests,
    (SELECT COUNT(*) FROM public.submissions s WHERE s.created_at::date = d::date)::bigint AS new_submissions,
    (SELECT COUNT(*) FROM public.submissions s WHERE s.status='approved' AND s.created_at::date = d::date)::bigint AS approved_submissions,
    (SELECT COUNT(*) FROM public.cashouts co WHERE co.created_at::date = d::date)::bigint AS new_cashouts,
    (SELECT COALESCE(SUM(co.amount_cents),0) FROM public.cashouts co WHERE co.status='paid' AND co.created_at::date = d::date)::bigint AS paid_cashouts_cents,
    (SELECT COUNT(*) FROM public.moderation_queue mq WHERE mq.status='pending')::bigint AS pending_moderation_items,
    (SELECT COUNT(*) FROM public.support_tickets st WHERE st.status IN ('open','pending'))::bigint AS open_support_tickets
  FROM generate_series(current_date - interval '90 days', current_date, interval '1 day') AS d
  ORDER BY kpi_date DESC;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_kpis_daily_date ON public.admin_kpis_daily(kpi_date);

DO $$ BEGIN
  -- webhook_deliveries_daily_stats
  CREATE MATERIALIZED VIEW IF NOT EXISTS public.webhook_deliveries_daily_stats AS
  SELECT
    created_at::date AS stat_date,
    COUNT(*)::bigint AS total_deliveries,
    COUNT(*) FILTER (WHERE status='success')::bigint AS successful_deliveries,
    COUNT(*) FILTER (WHERE status='failed')::bigint AS failed_deliveries,
    COUNT(*) FILTER (WHERE status='pending')::bigint AS pending_deliveries,
    COUNT(DISTINCT endpoint_id)::bigint AS unique_endpoints
  FROM public.webhook_deliveries
  WHERE created_at >= current_date - interval '90 days'
  GROUP BY created_at::date
  ORDER BY stat_date DESC;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_daily_stats_date ON public.webhook_deliveries_daily_stats(stat_date);

DO $$ BEGIN
  -- moderation_queue_stats
  CREATE MATERIALIZED VIEW IF NOT EXISTS public.moderation_queue_stats AS
  SELECT
    status,
    COUNT(*)::bigint AS count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(reviewed_at, CURRENT_TIMESTAMP) - created_at)) / 3600) AS avg_hours_to_review,
    MAX(EXTRACT(EPOCH FROM (COALESCE(reviewed_at, CURRENT_TIMESTAMP) - created_at)) / 3600) AS max_hours_to_review,
    COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL AND EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600 > 24)::bigint AS overdue_count
  FROM public.moderation_queue
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY status;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_moderation_queue_stats_status_unique ON public.moderation_queue_stats(status);

CREATE OR REPLACE FUNCTION public.refresh_admin_kpi_views()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_kpis_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.webhook_deliveries_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.moderation_queue_stats;
$$;

-- Admin search indexes (fixed version of 53_admin_indexes_search.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm ON public.profiles USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON public.profiles USING gin(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contests_title_trgm ON public.contests USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cashouts_status_created ON public.cashouts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_route_created_by_created_at ON public.admin_saved_views(route, created_by, created_at DESC);

-- SECURITY: revoke execution of high-risk SECURITY DEFINER functions from PUBLIC
DO $$
BEGIN
  -- maintenance/cron style functions should be server-only
  BEGIN REVOKE ALL ON FUNCTION public.finalize_contest(uuid) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.archive_ended_contests() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.compute_daily_metrics(uuid) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.refresh_all_materialized_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.refresh_leaderboard() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.refresh_analytics_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.refresh_admin_kpi_views() FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  -- admin RPCs should be server-only unless you add explicit checks
  BEGIN REVOKE ALL ON FUNCTION public.admin_publish_contest(uuid, uuid, text, public.reason_code_enum, text, text) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN REVOKE ALL ON FUNCTION public.admin_end_contest(uuid, uuid, text, public.reason_code_enum, text, text) FROM PUBLIC; EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;
GRANT EXECUTE ON FUNCTION public.finalize_contest(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_ended_contests() TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_daily_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_materialized_views() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_views() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_admin_kpi_views() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_contest(uuid, uuid, text, public.reason_code_enum, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_end_contest(uuid, uuid, text, public.reason_code_enum, text, text) TO service_role;


-- =====================================================
-- MIGRATIONS (appended)
-- =====================================================


-- ------------------------------
-- BEGIN migrations/001_p0_security_definer_lockdown.sql
-- ------------------------------
begin;

-- =====================================================
-- P0: SECURITY DEFINER lockdown
-- - Revoke EXECUTE from PUBLIC for all SECURITY DEFINER functions in public schema
-- - Grant EXECUTE to service_role by default
-- - Re-grant only the minimal allowlist to anon/authenticated (helpers used in RLS + explicitly public-safe)
-- =====================================================

do $$
declare
  r record;
begin
  -- Blanket revoke/grant for all SECURITY DEFINER functions in public schema.
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format('revoke all on function %I.%I(%s) from public', r.schema_name, r.function_name, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.schema_name, r.function_name, r.args);
  end loop;
end
$$;

-- -----------------------------------------------------
-- Allowlist: functions used in RLS / explicitly public-safe
-- (grant to roles, but NOT to PUBLIC)
-- -----------------------------------------------------

-- Core helpers used by policies
grant execute on function public.now_utc() to anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.get_user_role(uuid) to authenticated;
grant execute on function public.is_creator(uuid) to authenticated;
grant execute on function public.is_brand(uuid) to authenticated;

-- Org helper used by policies
do $$
begin
  if exists (select 1 from pg_proc where pronamespace='public'::regnamespace and proname='is_org_member') then
    grant execute on function public.is_org_member(uuid, uuid) to authenticated;
  end if;
end
$$;

-- Admin RBAC bootstrap helpers used by RLS policies
do $$
begin
  if exists (select 1 from pg_proc where pronamespace='public'::regnamespace and proname='admin_staff_is_bootstrap') then
    grant execute on function public.admin_staff_is_bootstrap() to authenticated;
  end if;
  if exists (select 1 from pg_proc where pronamespace='public'::regnamespace and proname='is_admin_super') then
    grant execute on function public.is_admin_super(uuid) to authenticated;
  end if;
end
$$;

-- Public safe exposure (explicitly intended to be callable by clients)
do $$
begin
  if exists (select 1 from pg_proc where pronamespace='public'::regnamespace and proname='public_profiles_safe') then
    grant execute on function public.public_profiles_safe() to anon, authenticated;
  end if;
end
$$;

commit;
-- ------------------------------
-- END migrations/001_p0_security_definer_lockdown.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/002_p0_storage_policies.sql
-- ------------------------------
begin;

-- =====================================================
-- P0: Storage policies (secure default)
-- - contest_assets bucket is PRIVATE (public=false)
-- - storage.objects RLS enabled
-- - policies are explicit; anon has NO read by default
-- =====================================================

do $$
declare
  v_owner text;
begin
  -- Many environments require running this as the owner of storage.objects (typically `postgres`).
  -- If we're not the owner, skip instead of failing the whole migration.
  select c.relowner::regrole::text into v_owner
  from pg_class c
  where c.relname = 'objects' and c.relnamespace = 'storage'::regnamespace;

  if v_owner is null then
    raise notice 'Skip storage policies: storage.objects does not exist.';
    return;
  end if;

  if v_owner is distinct from current_user then
    raise notice 'Skip storage policies: current_user % is not owner of storage.objects (%). Run this migration as % (or via Supabase SQL editor as postgres).',
      current_user, v_owner, v_owner;
    return;
  end if;

  -- Ensure contest_assets is private (defense-in-depth)
  if exists (select 1 from pg_tables where schemaname='storage' and tablename='buckets') then
    update storage.buckets
    set public = false
    where id = 'contest_assets';
  end if;

  -- Ensure RLS on storage.objects (owner-only)
  alter table storage.objects enable row level security;

  -- -----------------------------
  -- avatars (private by default)
  -- Path convention: {user_id}/{filename}
  -- -----------------------------
  drop policy if exists "avatars_read_public" on storage.objects;
  drop policy if exists "avatars_upload_own" on storage.objects;
  create policy "avatars_upload_own" on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "avatars_read_own" on storage.objects;
  create policy "avatars_read_own" on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "avatars_update_own" on storage.objects;
  create policy "avatars_update_own" on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "avatars_delete_own" on storage.objects;
  create policy "avatars_delete_own" on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  -- -----------------------------
  -- contest_assets (PRIVATE)
  -- Path convention: {contest_id}/assets/{uuid}_{filename}
  -- -----------------------------
  drop policy if exists "contest_assets_read_public" on storage.objects;
  drop policy if exists "contest_assets_upload_brand" on storage.objects;
  create policy "contest_assets_upload_brand" on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'contest_assets'
      and (
        exists (
          select 1
          from public.contests c
          where c.id::text = split_part(name, '/', 1)
            and c.brand_id = (select auth.uid())::uuid
        )
        or public.is_admin((select auth.uid())::uuid)
      )
    );

  drop policy if exists "contest_assets_read_authenticated" on storage.objects;
  create policy "contest_assets_read_authenticated" on storage.objects
    for select
    to authenticated
    using (bucket_id = 'contest_assets');

  drop policy if exists "contest_assets_update_brand" on storage.objects;
  create policy "contest_assets_update_brand" on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'contest_assets'
      and (
        exists (
          select 1
          from public.contests c
          where c.id::text = split_part(name, '/', 1)
            and c.brand_id = (select auth.uid())::uuid
        )
        or public.is_admin((select auth.uid())::uuid)
      )
    );

  drop policy if exists "contest_assets_delete_brand" on storage.objects;
  create policy "contest_assets_delete_brand" on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'contest_assets'
      and (
        exists (
          select 1
          from public.contests c
          where c.id::text = split_part(name, '/', 1)
            and c.brand_id = (select auth.uid())::uuid
        )
        or public.is_admin((select auth.uid())::uuid)
      )
    );

  -- -----------------------------
  -- ugc_videos (private; only creator can upload/update/delete, and read if approved)
  -- Path convention: {submission_id}/{filename}
  -- -----------------------------
  drop policy if exists "ugc_videos_upload_creator" on storage.objects;
  create policy "ugc_videos_upload_creator" on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'ugc_videos'
      and exists (
        select 1
        from public.submissions s
        where s.id::text = (storage.foldername(name))[1]
          and s.creator_id = (select auth.uid())::uuid
      )
    );

  drop policy if exists "ugc_videos_read_approved" on storage.objects;
  create policy "ugc_videos_read_approved" on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'ugc_videos'
      and exists (
        select 1
        from public.submissions s
        where s.id::text = (storage.foldername(name))[1]
          and s.status = 'approved'
      )
    );

  drop policy if exists "ugc_videos_update_creator" on storage.objects;
  create policy "ugc_videos_update_creator" on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'ugc_videos'
      and exists (
        select 1
        from public.submissions s
        where s.id::text = (storage.foldername(name))[1]
          and s.creator_id = (select auth.uid())::uuid
      )
    );

  drop policy if exists "ugc_videos_delete_creator" on storage.objects;
  create policy "ugc_videos_delete_creator" on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'ugc_videos'
      and exists (
        select 1
        from public.submissions s
        where s.id::text = (storage.foldername(name))[1]
          and s.creator_id = (select auth.uid())::uuid
      )
    );

  -- -----------------------------
  -- invoices (private; server writes; read per-path)
  -- Path convention: {brand_id}/invoices/{filename}
  -- -----------------------------
  drop policy if exists "invoices_insert_service_role" on storage.objects;
  create policy "invoices_insert_service_role" on storage.objects
    for insert
    to service_role
    with check (bucket_id = 'invoices');

  drop policy if exists "invoices_read_own" on storage.objects;
  create policy "invoices_read_own" on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'invoices'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "invoices_admin_all" on storage.objects;
  create policy "invoices_admin_all" on storage.objects
    for all
    to authenticated
    using (
      bucket_id = 'invoices'
      and public.is_admin((select auth.uid())::uuid)
    )
    with check (
      bucket_id = 'invoices'
      and public.is_admin((select auth.uid())::uuid)
    );
end
$$;

commit;
-- ------------------------------
-- END migrations/002_p0_storage_policies.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/003_p0_cashout_reviews_policies.sql
-- ------------------------------
begin;

-- =====================================================
-- P0: cashout_reviews had RLS enabled but no policies.
-- Secure default: admin-only.
-- =====================================================

do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='cashout_reviews') then
    alter table public.cashout_reviews enable row level security;

    drop policy if exists "cashout_reviews_admin_all" on public.cashout_reviews;
    create policy "cashout_reviews_admin_all" on public.cashout_reviews
      for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end
$$;

commit;
-- ------------------------------
-- END migrations/003_p0_cashout_reviews_policies.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/010_p1_brand_moderation.sql
-- ------------------------------
begin;

-- =====================================================
-- P1: Brand moderation (prod-ready)
-- - Add moderation columns on submissions (idempotent)
-- - Add RPC `public.moderate_submission(...)` callable by authenticated (NOT PUBLIC)
-- - Add trigger guard to prevent creators from changing status or immutable fields directly
-- =====================================================

-- Add columns if missing
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='submissions') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='submissions' and column_name='moderated_at'
    ) then
      alter table public.submissions add column moderated_at timestamptz;
    end if;
  end if;
end
$$;

-- RPC: brand/admin moderation (safe, guarded)
create or replace function public.moderate_submission(
  p_submission_id uuid,
  p_new_status submission_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission record;
  v_brand_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_new_status not in ('approved', 'rejected', 'removed') then
    raise exception 'Invalid moderation target status: %', p_new_status;
  end if;

  select s.id, s.contest_id, s.creator_id, s.status, c.brand_id
  into v_submission
  from public.submissions s
  join public.contests c on c.id = s.contest_id
  where s.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found: %', p_submission_id;
  end if;

  v_brand_id := v_submission.brand_id;

  if not (public.is_admin(auth.uid()) or v_brand_id = auth.uid()) then
    raise exception 'Not allowed to moderate this submission';
  end if;

  update public.submissions
  set
    status = p_new_status,
    moderated_by = auth.uid(),
    moderated_at = public.now_utc(),
    moderation_notes = p_reason,
    rejection_reason = case when p_new_status = 'rejected' then p_reason else null end,
    approved_at = case when p_new_status = 'approved' then public.now_utc() else null end,
    updated_at = public.now_utc()
  where id = p_submission_id;
end;
$$;

comment on function public.moderate_submission(uuid, submission_status, text)
is 'Brand/admin moderation of a submission (guarded by ownership/admin checks).';

-- Lockdown: do not allow PUBLIC execute
revoke all on function public.moderate_submission(uuid, submission_status, text) from public;
grant execute on function public.moderate_submission(uuid, submission_status, text) to authenticated;

-- Trigger guard: prevent direct mutation of sensitive columns by creators / non-brand
create or replace function public.submissions_guard_updates()
returns trigger
language plpgsql
as $$
declare
  v_is_admin boolean := false;
  v_is_brand_owner boolean := false;
begin
  -- Always block changes to immutable identity fields (even for admin; change via explicit migration only)
  if new.contest_id is distinct from old.contest_id then
    raise exception 'contest_id is immutable';
  end if;
  if new.creator_id is distinct from old.creator_id then
    raise exception 'creator_id is immutable';
  end if;
  if new.platform is distinct from old.platform then
    raise exception 'platform is immutable';
  end if;

  -- Status changes: only admin or contest owner brand
  if new.status is distinct from old.status then
    v_is_admin := public.is_admin(auth.uid());

    select exists (
      select 1 from public.contests c
      where c.id = old.contest_id
        and c.brand_id = auth.uid()
    ) into v_is_brand_owner;

    if not (v_is_admin or v_is_brand_owner) then
      raise exception 'Only brand owner or admin can change submission status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_submissions_guard_updates on public.submissions;
create trigger trg_submissions_guard_updates
before update on public.submissions
for each row
execute function public.submissions_guard_updates();

commit;
-- ------------------------------
-- END migrations/010_p1_brand_moderation.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/011_p1_cashout_integrity.sql
-- ------------------------------
begin;

-- =====================================================
-- P1: Cashout integrity (server-only)
-- - View: creator_available_balance
-- - RPC: request_cashout_service(...) executable ONLY by service_role
-- - Allocation RPC: allocate_cashout_to_winnings(...) to mark winnings as paid (prevents double withdrawals)
-- =====================================================

-- View: available balance = unpaid winnings - open cashouts (requested/processing)
create or replace view public.creator_available_balance as
select
  p.id as creator_id,
  coalesce(w.unpaid_winnings_cents, 0)::bigint as unpaid_winnings_cents,
  coalesce(c.open_cashouts_cents, 0)::bigint as open_cashouts_cents,
  greatest(coalesce(w.unpaid_winnings_cents, 0) - coalesce(c.open_cashouts_cents, 0), 0)::bigint as available_balance_cents
from public.profiles p
left join (
  select
    creator_id,
    sum(payout_cents)::bigint as unpaid_winnings_cents
  from public.contest_winnings
  where paid_at is null
  group by creator_id
) w on w.creator_id = p.id
left join (
  select
    creator_id,
    sum(amount_cents)::bigint as open_cashouts_cents
  from public.cashouts
  where status in ('requested', 'processing')
  group by creator_id
) c on c.creator_id = p.id
where p.role = 'creator';

comment on view public.creator_available_balance is 'Computed available balance for creators (unpaid winnings - open cashouts).';

-- Allocate a paid cashout to winnings (oldest-first) so winnings get paid_at + cashout_id.
create or replace function public.allocate_cashout_to_winnings(p_cashout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashout record;
  v_remaining bigint;
  v_w record;
begin
  select id, creator_id, amount_cents, status
  into v_cashout
  from public.cashouts
  where id = p_cashout_id
  for update;

  if not found then
    raise exception 'Cashout not found: %', p_cashout_id;
  end if;

  if v_cashout.status <> 'paid' then
    raise exception 'Cashout must be paid before allocation. Current status: %', v_cashout.status;
  end if;

  v_remaining := v_cashout.amount_cents::bigint;

  for v_w in
    select id, payout_cents
    from public.contest_winnings
    where creator_id = v_cashout.creator_id
      and paid_at is null
    order by calculated_at asc
    for update
  loop
    exit when v_remaining <= 0;

    if v_w.payout_cents::bigint <= v_remaining then
      update public.contest_winnings
      set paid_at = public.now_utc(),
          cashout_id = v_cashout.id,
          updated_at = public.now_utc()
      where id = v_w.id;

      v_remaining := v_remaining - v_w.payout_cents::bigint;
    end if;
  end loop;
end;
$$;

comment on function public.allocate_cashout_to_winnings(uuid)
is 'Allocates a PAID cashout to unpaid winnings (oldest-first) to prevent double withdrawals.';

-- Server-only cashout request (Edge Function / backend)
create or replace function public.request_cashout_service(
  p_creator_id uuid,
  p_amount_cents integer,
  p_currency text default 'EUR'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available bigint;
  v_cashout_id uuid;
begin
  if p_creator_id is null then
    raise exception 'creator_id is required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_cents must be > 0';
  end if;

  -- Basic eligibility checks
  if not exists (
    select 1 from public.profiles p
    where p.id = p_creator_id
      and p.role = 'creator'
      and p.is_active = true
  ) then
    raise exception 'Creator not eligible (missing profile / not active / wrong role)';
  end if;

  -- KYC must be verified (secure default)
  if not exists (
    select 1 from public.kyc_checks k
    where k.user_id = p_creator_id
      and k.status = 'verified'
  ) then
    raise exception 'KYC not verified';
  end if;

  -- No unresolved high/critical risk flags
  if exists (
    select 1 from public.risk_flags rf
    where rf.user_id = p_creator_id
      and rf.resolved_at is null
      and rf.severity in ('high', 'critical')
  ) then
    raise exception 'Cashout blocked due to unresolved risk flags';
  end if;

  select available_balance_cents
  into v_available
  from public.creator_available_balance
  where creator_id = p_creator_id;

  v_available := coalesce(v_available, 0);

  if p_amount_cents::bigint > v_available then
    raise exception 'Insufficient balance: requested %, available %', p_amount_cents, v_available;
  end if;

  insert into public.cashouts (
    creator_id,
    amount_cents,
    currency,
    status,
    metadata,
    requested_at,
    created_at,
    updated_at
  ) values (
    p_creator_id,
    p_amount_cents,
    coalesce(nullif(btrim(p_currency), ''), 'EUR'),
    'requested',
    jsonb_build_object('requested_via', 'request_cashout_service'),
    public.now_utc(),
    public.now_utc(),
    public.now_utc()
  )
  returning id into v_cashout_id;

  return v_cashout_id;
end;
$$;

comment on function public.request_cashout_service(uuid, integer, text)
is 'Service-role only: creates a cashout request after checking available balance + KYC + risk flags.';

-- Lockdown: service_role only
revoke all on function public.request_cashout_service(uuid, integer, text) from public;
revoke all on function public.request_cashout_service(uuid, integer, text) from anon;
revoke all on function public.request_cashout_service(uuid, integer, text) from authenticated;
grant execute on function public.request_cashout_service(uuid, integer, text) to service_role;

revoke all on function public.allocate_cashout_to_winnings(uuid) from public;
revoke all on function public.allocate_cashout_to_winnings(uuid) from anon;
revoke all on function public.allocate_cashout_to_winnings(uuid) from authenticated;
grant execute on function public.allocate_cashout_to_winnings(uuid) to service_role;

commit;
-- ------------------------------
-- END migrations/011_p1_cashout_integrity.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/020_p1_admin_workflows.sql
-- ------------------------------
begin;

-- =====================================================
-- P1: Admin workflows (prod-ready)
-- - Bans / suspensions: user_blocks table (admin-only)
-- - Cashout review + transitions: admin_review_cashout / admin_mark_cashout_paid
--   (service_role only, to be called from backend/Edge Functions)
-- =====================================================

-- -----------------------------
-- user_blocks (bans/suspensions)
-- -----------------------------
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('suspended', 'banned')),
  reason text,
  reason_code public.reason_code_enum,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_blocks_user_id on public.user_blocks(user_id, created_at desc);
create index if not exists idx_user_blocks_status on public.user_blocks(status, created_at desc);
create index if not exists idx_user_blocks_active on public.user_blocks(user_id, ends_at) where ends_at is null;

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_admin_all" on public.user_blocks;
create policy "user_blocks_admin_all" on public.user_blocks
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

comment on table public.user_blocks is 'Admin-only bans/suspensions. Use ends_at for temporary blocks.';

-- View: effective status for UI
create or replace view public.user_effective_status as
select
  p.id as user_id,
  p.role,
  p.is_active,
  max(ub.status) filter (where ub.ends_at is null or ub.ends_at > now()) as active_block_status,
  max(ub.ends_at) filter (where ub.ends_at is null or ub.ends_at > now()) as active_block_until
from public.profiles p
left join public.user_blocks ub on ub.user_id = p.id
group by p.id, p.role, p.is_active;

comment on view public.user_effective_status is 'Computed user status (profiles.is_active + current blocks).';

-- -----------------------------
-- Cashout review transitions
-- -----------------------------

-- Review decision: writes cashout_reviews + updates cashouts.review_state (+ status progression)
create or replace function public.admin_review_cashout(
  p_cashout_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashout record;
begin
  if p_cashout_id is null or p_actor_id is null then
    raise exception 'cashout_id and actor_id are required';
  end if;

  if p_decision not in ('approve','reject') then
    raise exception 'decision must be approve|reject';
  end if;

  -- Ensure actor is admin
  if not public.is_admin(p_actor_id) then
    raise exception 'actor is not admin';
  end if;

  select * into v_cashout
  from public.cashouts
  where id = p_cashout_id
  for update;

  if not found then
    raise exception 'Cashout not found: %', p_cashout_id;
  end if;

  insert into public.cashout_reviews (cashout_id, admin_id, decision, reason)
  values (p_cashout_id, p_actor_id, p_decision, p_reason)
  on conflict (cashout_id, admin_id) do update
  set decision = excluded.decision,
      reason = excluded.reason,
      created_at = now();

  if p_decision = 'approve' then
    update public.cashouts
    set
      review_state = 'approved',
      status = case when v_cashout.status = 'requested' then 'processing' else v_cashout.status end,
      updated_at = public.now_utc(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('reviewed_by', p_actor_id, 'reviewed_at', public.now_utc())
    where id = p_cashout_id;
  else
    update public.cashouts
    set
      review_state = 'rejected',
      status = 'canceled',
      updated_at = public.now_utc(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('reviewed_by', p_actor_id, 'reviewed_at', public.now_utc(), 'rejection_reason', p_reason)
    where id = p_cashout_id;
  end if;
end;
$$;

comment on function public.admin_review_cashout(uuid, uuid, text, text)
is 'Service-role only: records admin cashout review and updates cashout state.';

-- Mark cashout paid and allocate winnings to prevent double withdrawals
create or replace function public.admin_mark_cashout_paid(
  p_cashout_id uuid,
  p_actor_id uuid,
  p_stripe_transfer_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashout record;
begin
  if p_cashout_id is null or p_actor_id is null then
    raise exception 'cashout_id and actor_id are required';
  end if;
  if not public.is_admin(p_actor_id) then
    raise exception 'actor is not admin';
  end if;

  select * into v_cashout
  from public.cashouts
  where id = p_cashout_id
  for update;

  if not found then
    raise exception 'Cashout not found: %', p_cashout_id;
  end if;

  update public.cashouts
  set
    status = 'paid',
    processed_at = public.now_utc(),
    stripe_transfer_id = coalesce(p_stripe_transfer_id, stripe_transfer_id),
    updated_at = public.now_utc(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('paid_by', p_actor_id, 'paid_at', public.now_utc())
  where id = p_cashout_id;

  -- Allocate to winnings (oldest-first)
  perform public.allocate_cashout_to_winnings(p_cashout_id);
end;
$$;

comment on function public.admin_mark_cashout_paid(uuid, uuid, text)
is 'Service-role only: marks cashout as paid and allocates it to winnings.';

-- Lockdown: service_role only
revoke all on function public.admin_review_cashout(uuid, uuid, text, text) from public;
revoke all on function public.admin_review_cashout(uuid, uuid, text, text) from anon;
revoke all on function public.admin_review_cashout(uuid, uuid, text, text) from authenticated;
grant execute on function public.admin_review_cashout(uuid, uuid, text, text) to service_role;

revoke all on function public.admin_mark_cashout_paid(uuid, uuid, text) from public;
revoke all on function public.admin_mark_cashout_paid(uuid, uuid, text) from anon;
revoke all on function public.admin_mark_cashout_paid(uuid, uuid, text) from authenticated;
grant execute on function public.admin_mark_cashout_paid(uuid, uuid, text) to service_role;

commit;
-- ------------------------------
-- END migrations/020_p1_admin_workflows.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/021_p1_analytics_safe.sql
-- ------------------------------
begin;

-- =====================================================
-- P1: Analytics correctness (materialized views are rewritten to avoid join multiplication)
-- Rebuild:
-- - public.brand_dashboard_summary
-- - public.creator_dashboard_summary
-- - public.platform_stats_summary
-- =====================================================

-- brand_dashboard_summary (safe: aggregate separately then join)
drop materialized view if exists public.brand_dashboard_summary;
create materialized view public.brand_dashboard_summary as
with contests_agg as (
  select
    c.brand_id,
    count(*) filter (where c.status = 'active')::bigint as active_contests,
    count(*) filter (where c.status = 'ended')::bigint as ended_contests,
    count(*) filter (where c.status = 'draft')::bigint as draft_contests,
    sum(c.prize_pool_cents)::bigint as total_prize_pool_cents,
    sum(c.budget_cents)::bigint as total_budget_cents,
    max(c.updated_at) as last_contest_updated
  from public.contests c
  group by c.brand_id
),
submissions_agg as (
  select
    c.brand_id,
    count(distinct s.id)::bigint as total_submissions,
    count(distinct s.creator_id)::bigint as total_creators
  from public.submissions s
  join public.contests c on c.id = s.contest_id
  group by c.brand_id
),
metrics_agg as (
  select
    c.brand_id,
    coalesce(sum(md.views), 0)::bigint as total_views,
    coalesce(sum(md.likes), 0)::bigint as total_likes,
    coalesce(sum(md.comments), 0)::bigint as total_comments,
    coalesce(sum(md.shares), 0)::bigint as total_shares
  from public.metrics_daily md
  join public.submissions s on s.id = md.submission_id
  join public.contests c on c.id = s.contest_id
  group by c.brand_id
)
select
  coalesce(ca.brand_id, sa.brand_id, ma.brand_id) as brand_id,
  coalesce(ca.active_contests, 0) as active_contests,
  coalesce(ca.ended_contests, 0) as ended_contests,
  coalesce(ca.draft_contests, 0) as draft_contests,
  coalesce(ca.total_prize_pool_cents, 0) as total_prize_pool_cents,
  coalesce(ca.total_budget_cents, 0) as total_budget_cents,
  coalesce(sa.total_submissions, 0) as total_submissions,
  coalesce(sa.total_creators, 0) as total_creators,
  coalesce(ma.total_views, 0) as total_views,
  coalesce(ma.total_likes, 0) as total_likes,
  coalesce(ma.total_comments, 0) as total_comments,
  coalesce(ma.total_shares, 0) as total_shares,
  ca.last_contest_updated
from contests_agg ca
full join submissions_agg sa on sa.brand_id = ca.brand_id
full join metrics_agg ma on ma.brand_id = coalesce(ca.brand_id, sa.brand_id);

create unique index if not exists idx_brand_dashboard_summary_brand_id
  on public.brand_dashboard_summary(brand_id);

comment on materialized view public.brand_dashboard_summary is 'Safe brand dashboard KPIs (no join multiplication).';

-- creator_dashboard_summary (safe)
drop materialized view if exists public.creator_dashboard_summary;
create materialized view public.creator_dashboard_summary as
with submissions_agg as (
  select
    s.creator_id,
    count(distinct s.contest_id)::bigint as contests_participated,
    count(*)::bigint as total_submissions,
    count(*) filter (where s.status = 'approved')::bigint as approved_submissions,
    count(*) filter (where s.status = 'pending')::bigint as pending_submissions,
    count(*) filter (where s.status = 'rejected')::bigint as rejected_submissions,
    max(s.updated_at) as last_submission_updated
  from public.submissions s
  group by s.creator_id
),
metrics_agg as (
  select
    s.creator_id,
    coalesce(sum(md.views), 0)::bigint as total_views,
    coalesce(sum(md.likes), 0)::bigint as total_likes,
    coalesce(sum(md.comments), 0)::bigint as total_comments,
    coalesce(sum(md.shares), 0)::bigint as total_shares
  from public.metrics_daily md
  join public.submissions s on s.id = md.submission_id
  group by s.creator_id
),
earnings_agg as (
  select
    cw.creator_id,
    coalesce(sum(cw.payout_cents), 0)::bigint as total_earnings_cents,
    count(distinct cw.contest_id) filter (where cw.payout_cents > 0)::bigint as contests_won
  from public.contest_winnings cw
  group by cw.creator_id
)
select
  coalesce(sa.creator_id, ma.creator_id, ea.creator_id) as creator_id,
  coalesce(sa.contests_participated, 0) as contests_participated,
  coalesce(sa.total_submissions, 0) as total_submissions,
  coalesce(sa.approved_submissions, 0) as approved_submissions,
  coalesce(sa.pending_submissions, 0) as pending_submissions,
  coalesce(sa.rejected_submissions, 0) as rejected_submissions,
  coalesce(ma.total_views, 0) as total_views,
  coalesce(ma.total_likes, 0) as total_likes,
  coalesce(ma.total_comments, 0) as total_comments,
  coalesce(ma.total_shares, 0) as total_shares,
  coalesce(ea.total_earnings_cents, 0) as total_earnings_cents,
  coalesce(ea.contests_won, 0) as contests_won,
  sa.last_submission_updated
from submissions_agg sa
full join metrics_agg ma on ma.creator_id = sa.creator_id
full join earnings_agg ea on ea.creator_id = coalesce(sa.creator_id, ma.creator_id);

create unique index if not exists idx_creator_dashboard_summary_creator_id
  on public.creator_dashboard_summary(creator_id);

create index if not exists idx_creator_dashboard_summary_earnings
  on public.creator_dashboard_summary(total_earnings_cents desc);

comment on materialized view public.creator_dashboard_summary is 'Safe creator dashboard KPIs (no join multiplication).';

-- platform_stats_summary (safe singleton)
drop materialized view if exists public.platform_stats_summary;
create materialized view public.platform_stats_summary as
with profiles_agg as (
  select
    count(*) filter (where role='brand')::bigint as total_brands,
    count(*) filter (where role='creator')::bigint as total_creators
  from public.profiles
),
contests_agg as (
  select
    count(*)::bigint as total_contests,
    coalesce(sum(prize_pool_cents),0)::bigint as total_prize_pool_cents,
    max(created_at) as last_contest_created
  from public.contests
),
submissions_agg as (
  select
    count(*)::bigint as total_submissions,
    count(*) filter (where status='approved')::bigint as approved_submissions,
    max(created_at) as last_submission_created
  from public.submissions
),
paid_agg as (
  select coalesce(sum(payout_cents),0)::bigint as total_paid_cents
  from public.contest_winnings
  where paid_at is not null
),
metrics_agg as (
  select
    coalesce(sum(views),0)::bigint as total_views,
    coalesce(sum(likes),0)::bigint as total_likes
  from public.metrics_daily
)
select
  pa.total_brands,
  pa.total_creators,
  ca.total_contests,
  sa.total_submissions,
  sa.approved_submissions,
  ca.total_prize_pool_cents,
  pda.total_paid_cents,
  ma.total_views,
  ma.total_likes,
  ca.last_contest_created,
  sa.last_submission_created
from profiles_agg pa
cross join contests_agg ca
cross join submissions_agg sa
cross join paid_agg pda
cross join metrics_agg ma;

-- Unique index required for REFRESH CONCURRENTLY on singleton matview
create unique index if not exists idx_platform_stats_summary_singleton
  on public.platform_stats_summary ((1));

comment on materialized view public.platform_stats_summary is 'Safe platform KPIs (singleton).';

commit;
-- ------------------------------
-- END migrations/021_p1_analytics_safe.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/022_p1_platform_settings_cleanup.sql
-- ------------------------------
begin;

-- =====================================================
-- P1: platform_settings schema normalization (single source of truth)
-- Goal: ensure platform_settings matches the baseline/admin schema and remove drift columns from legacy script.
-- =====================================================

do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='platform_settings') then
    -- Ensure value column default exists
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='platform_settings' and column_name='value'
    ) then
      alter table public.platform_settings alter column value set default '{}'::jsonb;
    end if;

    -- Ensure created_at exists (baseline/admin schema)
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='platform_settings' and column_name='created_at'
    ) then
      alter table public.platform_settings add column created_at timestamptz not null default now();
    end if;

    -- Ensure updated_at exists
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='platform_settings' and column_name='updated_at'
    ) then
      alter table public.platform_settings add column updated_at timestamptz not null default now();
    end if;

    -- Drop legacy columns if present (from obsolete 00_platform_settings_readonly.sql)
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='platform_settings' and column_name='updated_by'
    ) then
      alter table public.platform_settings drop column updated_by;
    end if;
  end if;
end
$$;

-- Ensure the maintenance flag exists
insert into public.platform_settings (key, value, description)
values ('admin_read_only', 'false'::jsonb, 'Admin read-only mode (maintenance)')
on conflict (key) do nothing;

commit;
-- ------------------------------
-- END migrations/022_p1_platform_settings_cleanup.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/023_p2_privacy_policies.sql
-- ------------------------------
begin;

-- =====================================================
-- P2: Privacy hardening
-- - Remove permissive public reads on sensitive tables
-- - Replace with explicit public-safe views (limited columns, limited rows)
-- =====================================================

-- 1) profile_creators: remove public read policy if exists (was USING(true))
drop policy if exists "profile_creators_public_read" on public.profile_creators;

-- Public-safe view for creator discovery (no email, only active profiles)
create or replace view public.public_creators as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  p.country,
  pc.handle,
  pc.primary_platform,
  pc.followers,
  pc.avg_views
from public.profiles p
join public.profile_creators pc on pc.user_id = p.id
where p.is_active = true
  and p.role = 'creator';

revoke all on table public.public_creators from public;
grant select on table public.public_creators to anon, authenticated;

comment on view public.public_creators is 'Public-safe creator discovery view (no email, active creators only).';

-- 2) follows: restrict reads to own relationships (no full public graph)
drop policy if exists "follows_public_read" on public.follows;

drop policy if exists "follows_user_read_own" on public.follows;
create policy "follows_user_read_own" on public.follows
  for select
  using (auth.uid() = follower_id or auth.uid() = followee_id);

-- 3) Optional: prevent public read of raw creator profile details table by revoking table privileges (defense-in-depth)
revoke all on table public.profile_creators from anon;

commit;
-- ------------------------------
-- END migrations/023_p2_privacy_policies.sql
-- ------------------------------


-- ------------------------------
-- BEGIN migrations/030_p2_indexes.sql
-- ------------------------------
begin;

-- =====================================================
-- P2: Indexes (performance)
-- Add missing composite indexes (idempotent).
-- =====================================================

-- submissions: frequent filters
create index if not exists idx_submissions_contest_creator_status_created
  on public.submissions(contest_id, creator_id, status, created_at desc);

create index if not exists idx_submissions_contest_status_created
  on public.submissions(contest_id, status, created_at desc);

create index if not exists idx_submissions_creator_status_created
  on public.submissions(creator_id, status, created_at desc);

-- contests: brand dashboards / admin filters
create index if not exists idx_contests_brand_status_created
  on public.contests(brand_id, status, created_at desc);

-- cashouts: finance / wallet
create index if not exists idx_cashouts_creator_status_created
  on public.cashouts(creator_id, status, created_at desc);

create index if not exists idx_cashouts_status_created
  on public.cashouts(status, created_at desc);

-- contest_winnings: balance computation + allocation (oldest-first)
create index if not exists idx_contest_winnings_creator_unpaid
  on public.contest_winnings(creator_id, calculated_at asc)
  where paid_at is null;

create index if not exists idx_contest_winnings_creator_paid_at
  on public.contest_winnings(creator_id, paid_at desc)
  where paid_at is not null;

-- risk_flags: cashout gating
create index if not exists idx_risk_flags_user_unresolved
  on public.risk_flags(user_id, severity, created_at desc)
  where resolved_at is null;

-- kyc_checks: eligibility
create index if not exists idx_kyc_checks_user_status
  on public.kyc_checks(user_id, status);

commit;
-- ------------------------------
-- END migrations/030_p2_indexes.sql
-- ------------------------------

