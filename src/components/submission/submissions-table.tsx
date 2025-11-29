/*
Source: Component SubmissionsTable
Purpose: Tableau des soumissions avec stats et filtres (desktop) + cartes responsives (mobile)
*/
'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Platform } from '@/lib/validators/platforms';
import { PlatformBadge } from '@/components/creator/platform-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';

export interface SubmissionData {
  id: string;
  contest_id: string;
  contest_title: string;
  platform: Platform;
  external_url: string;
  caption: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
  views?: number | null;
  likes?: number | null;
}

interface SubmissionsTableProps {
  submissions: SubmissionData[];
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'default' },
  approved: { label: 'En compétition', variant: 'success' },
  rejected: { label: 'Refusée', variant: 'danger' },
  removed: { label: 'Retirée', variant: 'warning' },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  const { toast } = useToastContext();

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        type: 'success',
        title: 'Lien copié',
        message: 'Le lien de ta vidéo a été copié dans le presse-papiers.',
      });
    } catch {
      toast({
        type: 'error',
        title: 'Impossible de copier',
        message: 'Copie le lien manuellement depuis la ligne de soumission.',
      });
    }
  };

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune soumission pour le moment.</p>
          <Link
            href="/app/creator/contests"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Découvrir les concours
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes soumissions ({submissions.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Vue mobile : cartes timeline */}
        <div className="space-y-3 md:hidden" aria-label="Liste de mes soumissions">
          {submissions.map((submission) => {
            const statusInfo = STATUS_LABELS[submission.status] || {
              label: submission.status,
              variant: 'default' as const,
            };
            const hasStats = submission.views != null || submission.likes != null;

            return (
              <div
                key={submission.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/app/creator/contests/${submission.contest_id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors text-sm"
                    >
                      {submission.contest_title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <PlatformBadge platform={submission.platform} />
                      <span>{formatDate(submission.submitted_at)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={submission.external_url} target="_blank" rel="noopener noreferrer">
                          Voir la vidéo
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/app/creator/contests/${submission.contest_id}`}>
                          Ouvrir le concours
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void handleCopyLink(submission.external_url);
                        }}
                      >
                        Copier le lien
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  {submission.rejection_reason && (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {submission.rejection_reason}
                    </span>
                  )}
                </div>

                {hasStats && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Vues :{' '}
                      <span className="font-medium">
                        {submission.views != null
                          ? submission.views.toLocaleString('fr-FR')
                          : '—'}
                      </span>
                    </span>
                    <span>
                      Likes :{' '}
                      <span className="font-medium">
                        {submission.likes != null
                          ? submission.likes.toLocaleString('fr-FR')
                          : '—'}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vue desktop : tableau */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Concours
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Plateforme
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Stats
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const statusInfo = STATUS_LABELS[submission.status] || {
                  label: submission.status,
                  variant: 'default' as const,
                };

                return (
                  <tr
                    key={submission.id}
                    className="border-b border-border/60 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/creator/contests/${submission.contest_id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {submission.contest_title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PlatformBadge platform={submission.platform} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div>
                        Vues :{' '}
                        {submission.views != null
                          ? submission.views.toLocaleString('fr-FR')
                          : '—'}
                      </div>
                      <div>
                        Likes :{' '}
                        {submission.likes != null
                          ? submission.likes.toLocaleString('fr-FR')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {submission.rejection_reason && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {submission.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(submission.submitted_at)}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={submission.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Voir la vidéo
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/app/creator/contests/${submission.contest_id}`}>
                              Ouvrir le concours
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              void handleCopyLink(submission.external_url);
                            }}
                          >
                            Copier le lien
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

