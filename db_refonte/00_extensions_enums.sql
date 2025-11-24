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
