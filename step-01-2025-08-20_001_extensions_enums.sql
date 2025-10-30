-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types and enums
CREATE TYPE contest_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');
CREATE TYPE cashout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE visibility_enum AS ENUM ('public', 'private', 'invite_only');
CREATE TYPE payout_model_enum AS ENUM ('standard', 'performance_based', 'fixed');
CREATE TYPE network_enum AS ENUM ('tiktok', 'instagram', 'youtube', 'twitter', 'linkedin');
CREATE TYPE user_role AS ENUM ('creator', 'brand', 'admin');

-- Create audit action enum
CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'login', 'logout', 
  'contest_create', 'contest_update', 'contest_delete',
  'submission_create', 'submission_approve', 'submission_reject',
  'submission_automod', 'payment_create', 'payment_complete', 'payment_fail',
  'cashout_request', 'cashout_complete', 'cashout_fail'
);
