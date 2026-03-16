-- Migration: ajout colonnes freeze ranking sur contests
-- Requis pour GAP-03 : freeze ranking snapshot au moment de l'activation via webhook Stripe

ALTER TABLE public.contests 
  ADD COLUMN IF NOT EXISTS ranking_formula_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ranking_weights_snapshot jsonb NOT NULL DEFAULT '{"w_platform":1.0,"w_like":0.5,"w_comment":0.3,"w_share":0.4}'::jsonb,
  ADD COLUMN IF NOT EXISTS ranking_frozen_at timestamptz;

COMMENT ON COLUMN public.contests.ranking_formula_version IS 'Version de la formule de ranking au moment du freeze';
COMMENT ON COLUMN public.contests.ranking_weights_snapshot IS 'Snapshot immuable des poids au moment activation';
COMMENT ON COLUMN public.contests.ranking_frozen_at IS 'Timestamp du freeze — null si pas encore activé';

