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
