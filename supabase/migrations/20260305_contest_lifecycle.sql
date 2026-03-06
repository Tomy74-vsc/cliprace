-- Migration: Contest lifecycle — nouveaux statuts + colonnes dates
--
-- À faire en 2 requêtes SÉPARÉES (Supabase SQL Editor) :
-- 1) Sélectionner et exécuter UNIQUEMENT les 2 lignes ALTER TYPE ci-dessous → Run.
-- 2) Nouvelle requête : sélectionner et exécuter tout le bloc "EXÉCUTION 2" → Run.
-- Les nouvelles valeurs d'enum doivent être committées avant d'être utilisées dans les index.

-- ========== EXÉCUTION 1 (run this only, then run execution 2 in a new query) ==========
ALTER TYPE contest_status ADD VALUE IF NOT EXISTS 'pending_live';
ALTER TYPE contest_status ADD VALUE IF NOT EXISTS 'reviewing';

-- ========== EXÉCUTION 2 : Nouvelle requête, après succès de l’exécution 1. ==========
ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS live_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contests_status_live_at
  ON contests (status, live_at)
  WHERE status = 'pending_live';

CREATE INDEX IF NOT EXISTS idx_contests_status_reviewing_at
  ON contests (status, reviewing_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_contests_status_ends_at
  ON contests (status, ends_at)
  WHERE status = 'reviewing';

