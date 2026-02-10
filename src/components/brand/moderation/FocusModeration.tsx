'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import type { Platform } from '@/lib/validators/platforms';
import { formatDate } from '@/lib/formatters';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  Pause,
  Play,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';

const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

export interface FocusModerationSubmission {
  id: string;
  external_url: string;
  platform: Platform;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  creator_id: string;
  creator_name: string | null;
  views: number;
  likes: number;
}

interface FocusModerationProps {
  open: boolean;
  onClose: () => void;
  contestId: string;
  submissions: FocusModerationSubmission[];
}

const DEFAULT_REJECTION_REASON =
  "La vidéo ne respecte pas les consignes (format, durée ou thème).";

export function FocusModeration({
  open,
  onClose,
  contestId: _contestId,
  submissions,
}: FocusModerationProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();

  const initialQueue = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions],
  );

  const [queue, setQueue] = useState<FocusModerationSubmission[]>(initialQueue);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Resynchronise la file quand la modale s'ouvre ou quand les soumissions changent
  useEffect(() => {
    if (open) {
      setQueue(initialQueue);
      setIsPlaying(true);
    }
  }, [open, initialQueue]);

  const current = queue[0];
  const next = queue[1];
  const total = initialQueue.length;
  const processed = total - queue.length;
  const progress = total > 0 ? (processed / total) * 100 : 0;

  const closeAndRefreshIfNeeded = useCallback(() => {
    onClose();
    if (hasChanges) {
      // Rafraîchir la page des soumissions après la fermeture
      router.refresh();
    }
  }, [hasChanges, onClose, router]);

  const moderateInBackground = useCallback(
    async (submission: FocusModerationSubmission, status: 'approved' | 'rejected') => {
      try {
        const body: { status: 'approved' | 'rejected'; reason?: string } = { status };
        if (status === 'rejected') {
          body.reason = DEFAULT_REJECTION_REASON;
        }

        const response = await fetch(`/api/submissions/${submission.id}/moderate`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken || '',
          },
          body: JSON.stringify(body),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Erreur lors de la modération');
        }

        toast({
          type: 'success',
          title: 'Modération effectuée',
          message:
            status === 'approved'
              ? 'La vidéo a été approuvée.'
              : 'La vidéo a été refusée.',
        });
      } catch (error) {
        console.error('Focus moderation error:', error);
        toast({
          type: 'error',
          title: 'Oups, échec de validation',
          message:
            error instanceof Error
              ? error.message
              : 'Impossible de modérer la soumission. Réessaie plus tard.',
        });
      }
    },
    [csrfToken, toast],
  );

  const advanceQueue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const handleModerateQuick = useCallback(
    (status: 'approved' | 'rejected') => {
      if (!current) return;
      const submission = current;

      // UI optimiste : avance immédiatement
      advanceQueue();
      setHasChanges(true);

      // Laisser la vidéo suivante se lancer sans attendre l'API
      void moderateInBackground(submission, status);
    },
    [advanceQueue, current, moderateInBackground],
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tag = target.tagName;
      const isTypingElement =
        tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
      if (isTypingElement) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowRight') {
        event.preventDefault();
        handleModerateQuick('approved');
        return;
      }

      if (event.key === 'r' || event.key === 'R' || event.key === 'ArrowLeft') {
        event.preventDefault();
        handleModerateQuick('rejected');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleModerateQuick, togglePlay]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeAndRefreshIfNeeded()}>
      <DialogContent className="max-w-5xl w-full border-border/60 bg-black text-white p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-4 pb-2 border-b border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              <DialogTitle className="text-lg">
                Focus Mode · Modération haute vitesse
              </DialogTitle>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1">
                <Badge variant="outline" className="border-white/30 text-white px-1.5 py-0.5 text-[10px]">
                  A
                </Badge>
                / →
                <span className="hidden sm:inline">Approuver</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge variant="outline" className="border-white/30 text-white px-1.5 py-0.5 text-[10px]">
                  R
                </Badge>
                / ←
                <span className="hidden sm:inline">Refuser</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Badge variant="outline" className="border-white/30 text-white px-1.5 py-0.5 text-[10px]">
                  Space
                </Badge>
                <span className="hidden sm:inline">Pause / Play</span>
              </span>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Modère les vidéos en plein écran avec des raccourcis clavier.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <Progress value={progress} className="h-1 bg-white/10 [&>div]:bg-primary" />
          <div className="mt-2 flex items-center justify-between text-xs text-white/60">
            <span>
              {processed} / {total} vidéo{total > 1 ? 's' : ''} traitée
              {processed > 1 ? 's' : ''}
            </span>
            {current && (
              <span>
                Soumise le {formatDate(current.submitted_at)} ·{' '}
                {current.platform.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[2fr,1.2fr] gap-4 p-6 pt-4">
          {/* Player principal */}
          <Card className="bg-black border-white/10 shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-[9/16] md:aspect-video bg-black">
                {current ? (
                  <>
                    <ReactPlayer
                      key={current.id}
                      url={current.external_url}
                      playing={isPlaying}
                      controls
                      width="100%"
                      height="100%"
                      muted
                      playsinline
                      config={{
                        youtube: { playerVars: { rel: 0, modestbranding: 1 } },
                      }}
                      className="react-player"
                    />
                    {/* Préchargement de la vidéo suivante */}
                    {next && (
                      <div className="pointer-events-none absolute inset-0 opacity-0">
                        <ReactPlayer
                          url={next.external_url}
                          playing={false}
                          width="100%"
                          height="100%"
                          muted
                          playsinline
                        />
                      </div>
                    )}
                    <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs">
                        <PlatformBadge platform={current.platform} />
                        <span className="text-white/80 line-clamp-1 max-w-[220px]">
                          {current.external_url}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-black/70 border-white/30 text-white hover:bg-white/10"
                        onClick={togglePlay}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/70">
                    <Film className="h-10 w-10 text-white/40" />
                    <p className="text-sm font-medium">
                      Plus aucune vidéo en attente pour ce lot.
                    </p>
                    <p className="text-xs text-white/50 max-w-xs">
                      Ferme le Focus Mode pour recharger la liste depuis le dashboard ou
                      reviens plus tard quand de nouvelles vidéos arriveront.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Panneau d'infos & actions */}
          <Card className="bg-zinc-950 border-white/10 text-white flex flex-col">
            <CardHeader className="pb-3">
              {current ? (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/40">
                      Créateur
                    </p>
                    <p className="text-base font-semibold">
                      {current.creator_name || 'Créateur anonyme'}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      Soumis le {formatDate(current.submitted_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-white/30 bg-white/5 text-[11px] font-normal"
                  >
                    {processed + 1} / {total}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white/80">
                    Rien à modérer pour l&apos;instant
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              {current && (
                <>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-white/50">Vues</p>
                        <p className="mt-1 text-lg font-semibold">
                          {current.views.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-white/50">Likes</p>
                        <p className="mt-1 text-lg font-semibold">
                          {current.likes.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={current.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-primary-foreground hover:border-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="truncate text-xs text-primary">
                        Ouvrir sur la plateforme
                      </span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                    </a>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">
                      Raccourcis
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                        <Badge
                          variant="outline"
                          className="border-white/30 text-white px-1 py-0.5 text-[10px]"
                        >
                          A
                        </Badge>
                        / →
                        <span className="font-medium text-emerald-400">Approuver</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                        <Badge
                          variant="outline"
                          className="border-white/30 text-white px-1 py-0.5 text-[10px]"
                        >
                          R
                        </Badge>
                        / ←
                        <span className="font-medium text-rose-400">Refuser</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                        <Badge
                          variant="outline"
                          className="border-white/30 text-white px-1 py-0.5 text-[10px]"
                        >
                          Space
                        </Badge>
                        <span className="font-medium text-sky-300">Pause / Play</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      size="lg"
                      disabled={!current}
                      onClick={() => handleModerateQuick('approved')}
                      className="w-full bg-emerald-500 text-white hover:bg-emerald-400 transition-all duration-150 hover:scale-[1.02]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approuver · A / →
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={!current}
                      onClick={() => handleModerateQuick('rejected')}
                      className="w-full border-rose-500/60 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-all duration-150 hover:scale-[1.02]"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Refuser (raison par défaut) · R / ←
                    </Button>
                  </div>
                </>
              )}

              {!current && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-white/70">
                  <ThumbsUp className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm font-medium">
                    Bravo, tu as terminé ce lot de vidéos.
                  </p>
                  <p className="text-xs text-white/50 max-w-xs">
                    Ferme le Focus Mode pour recharger une nouvelle série ou revenir au
                    dashboard.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-black/90">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={closeAndRefreshIfNeeded}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
          <div className="text-[11px] text-white/50">
            Focus Mode traite un lot de 20 vidéos en attente à la fois.
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FocusModerationLauncherProps {
  contestId: string;
  submissions: FocusModerationSubmission[];
  initialOpen?: boolean;
}

export function FocusModerationLauncher({
  contestId,
  submissions,
  initialOpen = false,
}: FocusModerationLauncherProps) {
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
    }
  }, [initialOpen]);

  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === 'pending').length,
    [submissions],
  );

  const disabled = pendingCount === 0;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="whitespace-nowrap"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Film className="mr-2 h-4 w-4" />
        Lancer le Focus Mode
        {pendingCount > 0 && (
          <span className="ml-2 rounded-full bg-primary-foreground/10 px-2 py-0.5 text-xs">
            {pendingCount}
          </span>
        )}
      </Button>

      <FocusModeration
        open={open}
        onClose={() => setOpen(false)}
        contestId={contestId}
        submissions={submissions}
      />
    </>
  );
}

