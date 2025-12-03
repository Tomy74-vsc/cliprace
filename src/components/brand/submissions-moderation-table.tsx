'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { formatDate } from '@/lib/formatters';
import {
  CheckCircle2,
  XCircle,
  Eye,
  ExternalLink,
  MessageSquare,
  CheckSquare2,
  Square,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

interface SubmissionsModerationTableProps {
  submissions: SubmissionData[];
  contestId: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  approved: { label: 'Approuvée', variant: 'success' },
  rejected: { label: 'Refusée', variant: 'danger' },
};

export function SubmissionsModerationTable({
  submissions,
  contestId: _contestId,
}: SubmissionsModerationTableProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [moderationStatus, setModerationStatus] = useState<'approved' | 'rejected' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionReasonType, setRejectionReasonType] = useState<string>('');
  const [rejectionReasonCustom, setRejectionReasonCustom] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModerating, setIsBatchModerating] = useState(false);
  const [batchRejectionReason, setBatchRejectionReason] = useState('');
  const [batchRejectionReasonType, setBatchRejectionReasonType] = useState<string>('');
  const [batchRejectionReasonCustom, setBatchRejectionReasonCustom] = useState('');
  const [batchModerationStatus, setBatchModerationStatus] = useState<'approved' | 'rejected' | null>(null);

  // Filtrer uniquement les soumissions en attente pour la sélection
  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );

  const selectedCount = selectedIds.size;
  const allPendingSelected = pendingSubmissions.length > 0 && selectedIds.size === pendingSubmissions.length;

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

  const handleModerate = async () => {
    if (!moderatingId || !moderationStatus) return;

    // Pour le refus, déterminer la raison
    let reason: string | undefined = undefined;
    if (moderationStatus === 'rejected') {
      if (rejectionReasonType === 'other') {
        reason = rejectionReasonCustom.trim() || undefined;
      } else {
        const selectedReason = REJECTION_REASONS.find((r) => r.id === rejectionReasonType);
        reason = selectedReason?.label || rejectionReason || undefined;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/submissions/${moderatingId}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          status: moderationStatus,
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
        message: `La soumission a été ${moderationStatus === 'approved' ? 'approuvée' : 'refusée'}.`,
      });

      // Reset et refresh
      setModeratingId(null);
      setModerationStatus(null);
      setRejectionReason('');
      setRejectionReasonType('');
      setRejectionReasonCustom('');
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
    }
  };

  const openModerationDialog = (submissionId: string, status: 'approved' | 'rejected') => {
    setModeratingId(submissionId);
    setModerationStatus(status);
    setRejectionReason('');
    setRejectionReasonType('');
    setRejectionReasonCustom('');
  };

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingSubmissions.map((s) => s.id)));
    }
  };

  const toggleSelect = (submissionId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId);
    } else {
      newSelected.add(submissionId);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchModerate = async () => {
    if (selectedIds.size === 0 || !batchModerationStatus) return;

    setIsBatchModerating(true);
    try {
      // Pour le refus en lot, déterminer la raison
      let batchReason: string | undefined = undefined;
      if (batchModerationStatus === 'rejected') {
        if (batchRejectionReasonType === 'other') {
          batchReason = batchRejectionReasonCustom.trim() || undefined;
        } else {
          const selectedReason = REJECTION_REASONS.find((r) => r.id === batchRejectionReasonType);
          batchReason = selectedReason?.label || batchRejectionReason || undefined;
        }
      }

      const response = await fetch('/api/submissions/batch-moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          submission_ids: Array.from(selectedIds),
          status: batchModerationStatus,
          reason: batchReason,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Erreur lors de la modération en lot');
      }

      toast({
        type: 'success',
        title: 'Modération en lot effectuée',
        message: `${result.moderated_count} soumission${result.moderated_count > 1 ? 's' : ''} ${batchModerationStatus === 'approved' ? 'approuvée(s)' : 'refusée(s)'}.`,
      });

      // Reset et refresh
      setSelectedIds(new Set());
      setBatchModerationStatus(null);
      setBatchRejectionReason('');
      setBatchRejectionReasonType('');
      setBatchRejectionReasonCustom('');
      router.refresh();
    } catch (error) {
      console.error('Batch moderation error:', error);
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Impossible de modérer les soumissions.',
      });
    } finally {
      setIsBatchModerating(false);
    }
  };

  const openBatchModerationDialog = (status: 'approved' | 'rejected') => {
    setBatchModerationStatus(status);
    setBatchRejectionReason('');
    setBatchRejectionReasonType('');
    setBatchRejectionReasonCustom('');
  };

  return (
    <>
      {/* Barre d'actions en lot */}
      {selectedCount > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedCount} soumission{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs"
                >
                  Tout désélectionner
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openBatchModerationDialog('approved')}
                  className="bg-success hover:bg-success/90 transition-all duration-200 hover:scale-105"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />
                  Approuver ({selectedCount})
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openBatchModerationDialog('rejected')}
                  className="border-destructive text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-105"
                >
                  <XCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />
                  Refuser ({selectedCount})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    {pendingSubmissions.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex items-center justify-center"
                        aria-label={allPendingSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                      >
                        {allPendingSelected ? (
                          <CheckSquare2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Créateur</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Plateforme</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Lien vidéo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Métriques</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const statusInfo = STATUS_LABELS[submission.status] || {
                    label: submission.status,
                    variant: 'default' as const,
                  };

                  const isSelected = selectedIds.has(submission.id);
                  const canSelect = submission.status === 'pending';

                  return (
                    <tr
                      key={submission.id}
                      className={`border-b border-border/60 transition-all duration-150 ${
                        isSelected
                          ? 'bg-primary/5 border-primary/20'
                          : 'hover:bg-muted/40 hover:border-primary/10'
                      }`}
                    >
                      <td className="px-4 py-3">
                        {canSelect && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(submission.id)}
                            aria-label={`Sélectionner la soumission de ${submission.creator_name || 'créateur anonyme'}`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{submission.creator_name || 'Créateur anonyme'}</p>
                          <Link
                            href={`/app/brand/messages?creator=${submission.creator_id}`}
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors duration-150"
                          >
                            <MessageSquare className="h-3 w-3 transition-transform duration-150 group-hover:scale-110" />
                            Contacter
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PlatformBadge platform={submission.platform} />
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={submission.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1 max-w-xs truncate transition-all duration-150 hover:text-primary/80 group"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          <span className="truncate">{submission.external_url}</span>
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                            <span>{submission.views.toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {submission.likes.toLocaleString()} likes
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {submission.rejection_reason && (
                          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                            {submission.rejection_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(submission.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        {submission.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => openModerationDialog(submission.id, 'approved')}
                              className="bg-success hover:bg-success/90 transition-all duration-200 hover:scale-105"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openModerationDialog(submission.id, 'rejected')}
                              className="border-destructive text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-105"
                            >
                              <XCircle className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:scale-110" />
                              Refuser
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {submission.approved_at ? `Approuvée le ${formatDate(submission.approved_at)}` : 'Modérée'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de modération en lot */}
      <Dialog
        open={batchModerationStatus !== null}
        onOpenChange={(open) => !open && setBatchModerationStatus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {batchModerationStatus === 'approved'
                ? `Approuver ${selectedCount} soumission${selectedCount > 1 ? 's' : ''}`
                : `Refuser ${selectedCount} soumission${selectedCount > 1 ? 's' : ''}`}
            </DialogTitle>
            <DialogDescription>
              {batchModerationStatus === 'approved'
                ? `Les ${selectedCount} soumission${selectedCount > 1 ? 's' : ''} sélectionnée${selectedCount > 1 ? 's' : ''} seront approuvée${selectedCount > 1 ? 's' : ''} et entreront dans le classement du concours.`
                : `Indique la raison du refus. Les ${selectedCount} créateur${selectedCount > 1 ? 's' : ''} seront notifié${selectedCount > 1 ? 's' : ''}.`}
            </DialogDescription>
          </DialogHeader>
          {batchModerationStatus === 'rejected' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Raison du refus</Label>
                <RadioGroup
                  value={batchRejectionReasonType}
                  onValueChange={setBatchRejectionReasonType}
                >
                  {REJECTION_REASONS.map((reason) => (
                    <div key={reason.id} className="flex items-start space-x-2">
                      <RadioGroupItem value={reason.id} id={`batch-${reason.id}`} className="mt-1" />
                      <Label
                        htmlFor={`batch-${reason.id}`}
                        className="font-normal cursor-pointer flex-1 leading-tight"
                      >
                        {reason.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {batchRejectionReasonType === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="batch-custom-reason">Précisez la raison *</Label>
                  <Textarea
                    id="batch-custom-reason"
                    value={batchRejectionReasonCustom}
                    onChange={(e) => setBatchRejectionReasonCustom(e.target.value)}
                    placeholder="Ex: Hashtags manquants, contenu non conforme, lien invalide..."
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    {batchRejectionReasonCustom.length}/500 caractères
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Cette raison sera envoyée à tous les créateurs concernés.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setBatchModerationStatus(null);
                setBatchRejectionReason('');
              }}
              disabled={isBatchModerating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleBatchModerate}
              disabled={
                isBatchModerating ||
                (batchModerationStatus === 'rejected' && (!batchRejectionReasonType || (batchRejectionReasonType === 'other' && !batchRejectionReasonCustom.trim())))
              }
              variant={batchModerationStatus === 'approved' ? 'primary' : 'destructive'}
            >
              {isBatchModerating
                ? 'En cours...'
                : batchModerationStatus === 'approved'
                  ? `Approuver ${selectedCount} soumission${selectedCount > 1 ? 's' : ''}`
                  : `Refuser ${selectedCount} soumission${selectedCount > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de modération individuelle */}
      <Dialog open={moderatingId !== null} onOpenChange={(open) => !open && setModeratingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationStatus === 'approved' ? 'Approuver la soumission' : 'Refuser la soumission'}
            </DialogTitle>
            <DialogDescription>
              {moderationStatus === 'approved'
                ? 'Cette soumission sera approuvée et entrera dans le classement du concours.'
                : 'Indique la raison du refus. Le créateur sera notifié.'}
            </DialogDescription>
          </DialogHeader>
          {moderationStatus === 'rejected' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Raison du refus</Label>
                <RadioGroup
                  value={rejectionReasonType}
                  onValueChange={setRejectionReasonType}
                >
                  {REJECTION_REASONS.map((reason) => (
                    <div key={reason.id} className="flex items-start space-x-2">
                      <RadioGroupItem value={reason.id} id={`individual-${reason.id}`} className="mt-1" />
                      <Label
                        htmlFor={`individual-${reason.id}`}
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
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setModeratingId(null);
                setModerationStatus(null);
                setRejectionReason('');
              }}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleModerate}
              disabled={
                isSubmitting ||
                (moderationStatus === 'rejected' && (!rejectionReasonType || (rejectionReasonType === 'other' && !rejectionReasonCustom.trim())))
              }
              variant={moderationStatus === 'approved' ? 'primary' : 'destructive'}
            >
              {isSubmitting ? 'En cours...' : moderationStatus === 'approved' ? 'Approuver' : 'Refuser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

