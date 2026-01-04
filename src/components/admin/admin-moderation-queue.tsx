'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AdminTable } from '@/components/admin/admin-table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatDateTime } from '@/lib/formatters';

type QueueItem = {
  id: string;
  submission_id: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  locked_by_me: boolean;
  reviewer: { id: string; display_name: string | null; email: string } | null;
  submission: {
    id: string;
    contest_id: string;
    creator_id: string;
    external_url: string;
    title: string | null;
    thumbnail_url: string | null;
    status: string;
    submitted_at: string;
    contest: { id: string; title: string } | null;
    creator: { id: string; display_name: string | null; email: string } | null;
  } | null;
  metrics: { views: number; likes: number; comments: number; shares: number };
};

interface AdminModerationQueueProps {
  items: QueueItem[];
  canWrite?: boolean;
}

function statusVariant(status: string): BadgeProps['variant'] {
  if (status === 'pending') return 'pending';
  if (status === 'processing') return 'warning';
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'default';
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

export function AdminModerationQueue({ items, canWrite = true }: AdminModerationQueueProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const runAction = async (id: string, action: 'claim' | 'release') => {
    if (!canWrite) {
      toast({
        type: 'warning',
        title: 'Lecture seule',
        message: 'Actions de modération désactivées pour votre compte.',
      });
      return;
    }

    setLoadingId(id);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/moderation/queue/${id}/${action}`, {
        method: 'POST',
        headers: { 'x-csrf': token },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "L'action a échoué.");
      }
      toast({
        type: 'success',
        title: 'OK',
        message: action === 'claim' ? 'Élément assigné.' : 'Élément libéré.',
      });
      router.refresh();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : "L'action a échoué.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <AdminTable>
      <thead className="text-left text-xs uppercase text-muted-foreground">
        <tr>
          <th>Statut</th>
          <th>Aperçu</th>
          <th>Soumission</th>
          <th>Concours</th>
          <th>Créateur</th>
          <th>Metrics</th>
          <th>Reviewer</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.length === 0 ? (
          <tr>
            <td colSpan={8} className="py-10 text-center text-muted-foreground">
              Aucun élément en file.
            </td>
          </tr>
        ) : (
          items.map((item) => (
            <tr key={item.id}>
              <td>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                <div className="text-xs text-muted-foreground mt-1">Ajouté {formatDateTime(item.created_at)}</div>
              </td>
              <td>
                {item.submission?.thumbnail_url ? (
                  <img
                    src={item.submission.thumbnail_url}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-24 rounded-lg border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center">
                    Aucun aperçu
                  </div>
                )}
              </td>
              <td>
                <div className="font-medium">{item.submission?.title || 'Sans titre'}</div>
                {item.submission?.external_url ? (
                  <a
                    href={item.submission.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    Ouvrir le lien
                  </a>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  Soumis {item.submission ? formatDateTime(item.submission.submitted_at) : '-'}
                </div>
              </td>
              <td>
                <div className="font-medium">{item.submission?.contest?.title || 'Inconnu'}</div>
                {item.submission?.contest_id ? (
                  <Link
                    href={`/app/admin/submissions?contest_id=${item.submission.contest_id}`}
                    className="text-xs text-primary underline"
                  >
                    Voir les soumissions
                  </Link>
                ) : null}
              </td>
              <td>
                <div className="font-medium">
                  {item.submission?.creator?.display_name ||
                    item.submission?.creator?.email ||
                    item.submission?.creator_id ||
                    'Inconnu'}
                </div>
                {item.submission?.creator_id ? (
                  <div className="text-xs text-muted-foreground">{item.submission.creator_id}</div>
                ) : null}
              </td>
              <td className="text-xs">
                <div>Vues : {item.metrics.views.toLocaleString()}</div>
                <div>Likes : {item.metrics.likes.toLocaleString()}</div>
                <div>Commentaires : {item.metrics.comments.toLocaleString()}</div>
                <div>Partages : {item.metrics.shares.toLocaleString()}</div>
              </td>
              <td className="text-xs">
                {item.reviewer ? (
                  <div>
                    <div className="font-medium">{item.reviewer.display_name || item.reviewer.email}</div>
                    <div className="text-muted-foreground">{item.reviewer.id}</div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Non assigné</span>
                )}
                {item.reviewed_at ? (
                  <div className="text-muted-foreground mt-1">{formatDateTime(item.reviewed_at)}</div>
                ) : null}
              </td>
              <td>
                <div className="flex flex-col gap-2">
                  {item.status === 'pending' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => runAction(item.id, 'claim')}
                      disabled={!canWrite || loadingId === item.id}
                    >
                      {loadingId === item.id ? 'Assignation...' : 'Assigner'}
                    </Button>
                  ) : null}
                  {item.status === 'processing' && item.locked_by_me ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => runAction(item.id, 'release')}
                      disabled={!canWrite || loadingId === item.id}
                    >
                      {loadingId === item.id ? 'Libération...' : 'Libérer'}
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </AdminTable>
  );
}

