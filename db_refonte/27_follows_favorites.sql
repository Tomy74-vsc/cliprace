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
