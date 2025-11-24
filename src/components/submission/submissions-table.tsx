/*
Source: Component SubmissionsTable
Purpose: Tableau des soumissions avec statuts et filtres
*/
'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Platform } from '@/lib/validators/platforms';

export interface SubmissionData {
  id: string;
  contest_id: string;
  contest_title: string;
  platform: Platform;
  external_url: string;
  caption: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'won';
  rejection_reason: string | null;
  submitted_at: string;
  approved_at: string | null;
}

interface SubmissionsTableProps {
  submissions: SubmissionData[];
}

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'En attente', variant: 'default' },
  approved: { label: 'En compétition', variant: 'success' },
  rejected: { label: 'Refusée', variant: 'danger' },
  won: { label: 'Gagnante', variant: 'success' },
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
  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune soumission pour le moment.</p>
          <Link href="/app/creator/contests" className="mt-4 inline-block text-sm text-primary hover:underline">
            Découvrir les concours →
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Concours</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Plateforme</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => {
                const statusInfo = STATUS_LABELS[submission.status] || {
                  label: submission.status,
                  variant: 'default' as const,
                };

                return (
                  <tr key={submission.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/creator/contests/${submission.contest_id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {submission.contest_title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{PLATFORM_LABELS[submission.platform]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {submission.rejection_reason && (
                        <p className="mt-1 text-xs text-muted-foreground">{submission.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(submission.submitted_at)}</td>
                    <td className="px-4 py-3">
                      <a
                        href={submission.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Voir la vidéo →
                      </a>
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
