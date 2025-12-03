'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { formatDate } from '@/lib/formatters';
import { CheckCircle2, XCircle, Eye, ExternalLink, MessageSquare, ThumbsUp } from 'lucide-react';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import type { Platform } from '@/lib/validators/platforms';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SubmissionData {
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

interface SubmissionsReviewViewProps {
  submissions: SubmissionData[];
  contestId: string;
}

// Raisons de refus prédéfinies
const REJECTION_REASONS = [
  {
    id: 'instructions',
    label: 'La vidéo ne respecte pas les consignes (format, durée ou thème).',
  },
  {
    id: 'quality',
    label: 'La qualité n\'est pas suffisante (image ou son).',
  },
  {
    id: 'branding',
    label: 'La marque est mal mise en avant.',
  },
  {
    id: 'other',
    label: 'Autre (préciser)',
  },
] as const;

export function SubmissionsReviewView({ submissions, contestId: _contestId }: SubmissionsReviewViewProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();

  // Filtrer uniquement les soumissions en attente
  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [moderationStatus, setModerationStatus] = useState<'approved' | 'rejected' | null>(null);
  const [rejectionReasonType, setRejectionReasonType] = useState<string>('');
  const [rejectionReasonCustom, setRejectionReasonCustom] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSubmission = pendingSubmissions[currentIndex];
  const totalPending = pendingSubmissions.length;
  const reviewedCount = currentIndex;
  const progress = totalPending > 0 ? (reviewedCount / totalPending) * 100 : 0;

  const handleModerate = async (status: 'approved' | 'rejected') => {
    if (!currentSubmission) return;

    // Pour le refus, déterminer la raison
    let reason: string | undefined = undefined;
    if (status === 'rejected') {
      if (rejectionReasonType === 'other') {
        if (!rejectionReasonCustom.trim()) {
          toast({
            type: 'error',
            title: 'Raison requise',
            message: 'Veuillez préciser la raison du refus.',
          });
          return;
        }
        reason = rejectionReasonCustom.trim();
      } else {
        const selectedReason = REJECTION_REASONS.find((r) => r.id === rejectionReasonType);
        reason = selectedReason?.label || '';
      }
    }

    setIsSubmitting(true);
    setModerationStatus(status);

    try {
      const response = await fetch(`/api/submissions/${currentSubmission.id}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          status,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Erreur lors de la modération');
      }

      toast({
        type: 'success',
        title: 'Modération effectuée',
        message: `La soumission a été ${status === 'approved' ? 'approuvée' : 'refusée'}.`,
      });

      // Passer à la soumission suivante
      if (currentIndex < totalPending - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // Toutes les soumissions ont été modérées
        setCurrentIndex(0);
      }

      // Reset modal
      setModerationStatus(null);
      setRejectionReasonType('');
      setRejectionReasonCustom('');

      // Refresh pour mettre à jour les données
      router.refresh();
    } catch (error) {
      console.error('Moderation error:', error);
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de modérer la soumission.',
      });
    } finally {
      setIsSubmitting(false);
      setModerationStatus(null);
    }
  };

  const openModerationDialog = (status: 'approved' | 'rejected') => {
    setModerationStatus(status);
    setRejectionReasonType('');
    setRejectionReasonCustom('');
  };

  // Si aucune soumission en attente
  if (totalPending === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="space-y-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-xl font-semibold">Toutes les vidéos ont été examinées</h3>
            <p className="text-muted-foreground">
              Revenez plus tard quand de nouvelles vidéos arriveront.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Barre de progression */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Vérification de la vidéo #{reviewedCount + 1} / {totalPending}
              </span>
              <span className="text-muted-foreground">
                {reviewedCount} vidéo{reviewedCount > 1 ? 's' : ''} examinée{reviewedCount > 1 ? 's' : ''}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Carte de la soumission */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={undefined} alt={currentSubmission.creator_name || 'Créateur'} />
                <AvatarFallback>
                  {(currentSubmission.creator_name || 'C').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">{currentSubmission.creator_name || 'Créateur anonyme'}</h3>
                <p className="text-sm text-muted-foreground">
                  Soumis le {formatDate(currentSubmission.submitted_at)}
                </p>
              </div>
            </div>
            <PlatformBadge platform={currentSubmission.platform} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats essentielles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vues</p>
                <p className="text-lg font-semibold">{currentSubmission.views.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <ThumbsUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Likes</p>
                <p className="text-lg font-semibold">{currentSubmission.likes.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Lien vidéo */}
          <div className="space-y-2">
            <Label>Lien de la vidéo</Label>
            <a
              href={currentSubmission.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm text-primary group-hover:underline truncate flex-1">
                {currentSubmission.external_url}
              </span>
            </a>
          </div>

          {/* Bouton contacter */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full"
          >
            <Link href={`/app/brand/messages?creator=${currentSubmission.creator_id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Contacter le créateur
            </Link>
          </Button>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              size="lg"
              variant="destructive"
              className="flex-1 bg-destructive hover:bg-destructive/90 transition-all duration-200 hover:scale-105"
              onClick={() => openModerationDialog('rejected')}
              disabled={isSubmitting}
            >
              <XCircle className="h-5 w-5 mr-2" />
              Refuser
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1 bg-success hover:bg-success/90 transition-all duration-200 hover:scale-105"
              onClick={() => handleModerate('approved')}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Accepter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de refus avec raisons pré-remplies */}
      <Dialog
        open={moderationStatus === 'rejected'}
        onOpenChange={(open) => {
          if (!open) {
            setModerationStatus(null);
            setRejectionReasonType('');
            setRejectionReasonCustom('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la soumission</DialogTitle>
            <DialogDescription>
              Indique la raison du refus. Le créateur sera notifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Raison du refus</Label>
              <RadioGroup
                value={rejectionReasonType}
                onValueChange={setRejectionReasonType}
              >
                {REJECTION_REASONS.map((reason) => (
                  <div key={reason.id} className="flex items-start space-x-2">
                    <RadioGroupItem value={reason.id} id={reason.id} className="mt-1" />
                    <Label
                      htmlFor={reason.id}
                      className="font-normal cursor-pointer flex-1 leading-tight"
                    >
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {rejectionReasonType === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="custom-reason">Précisez la raison *</Label>
                <Textarea
                  id="custom-reason"
                  value={rejectionReasonCustom}
                  onChange={(e) => setRejectionReasonCustom(e.target.value)}
                  placeholder="Ex: Hashtags manquants, contenu non conforme, lien invalide..."
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {rejectionReasonCustom.length}/500 caractères
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Cette raison pourra être affichée au créateur pour comprendre pourquoi sa vidéo est refusée.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setModerationStatus(null);
                setRejectionReasonType('');
                setRejectionReasonCustom('');
              }}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={() => handleModerate('rejected')}
              disabled={
                isSubmitting ||
                !rejectionReasonType ||
                (rejectionReasonType === 'other' && !rejectionReasonCustom.trim())
              }
              variant="destructive"
            >
              {isSubmitting ? 'En cours...' : 'Refuser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

