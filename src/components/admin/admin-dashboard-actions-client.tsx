'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ClipboardList, RefreshCcw } from 'lucide-react';

import { AdminTable } from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatDateTime } from '@/lib/formatters';

type DashboardTask = {
  type: string;
  id: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  subtitle: string;
  meta: string;
  created_at: string | null;
  owner: string | null;
  owner_is_me: boolean;
  cta: { kind: string; label: string; href: string };
  href: string;
};

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

function priorityBadge(priority: DashboardTask['priority']) {
  if (priority === 'urgent') return <Badge variant="danger">urgent</Badge>;
  if (priority === 'high') return <Badge variant="warning">élevée</Badge>;
  if (priority === 'medium') return <Badge variant="info">moyenne</Badge>;
  return <Badge variant="secondary">basse</Badge>;
}

export function AdminDashboardActionsClient({ items }: { items: DashboardTask[] }) {
  const router = useRouter();
  const { toast } = useToastContext();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [view, setView] = useState<'team' | 'mine'>('team');

  const filtered = useMemo(() => {
    if (view === 'mine') return items.filter((i) => i.owner_is_me);
    return items;
  }, [items, view]);

  const hasItems = filtered.length > 0;
  const top = useMemo(() => filtered.slice(0, 10), [filtered]);

  const runAssignToMe = async (task: DashboardTask) => {
    if (!task.id) return;

    setLoadingId(task.id);
    try {
      const token = await getCsrfToken();

      if (task.type === 'admin.task') {
        const res = await fetch(`/api/admin/tasks/${task.id}/assign-to-me`, {
          method: 'POST',
          headers: { 'x-csrf': token },
        });
        if (!res.ok) throw new Error("Impossible d'assigner la tâche.");
      } else if (task.type === 'support.ticket') {
        const res = await fetch(`/api/admin/support/tickets/${task.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-csrf': token },
          body: JSON.stringify({ assign_to_me: true }),
        });
        if (!res.ok) throw new Error('Impossible d’assigner le ticket.');
      } else if (task.type === 'crm.lead') {
        const res = await fetch(`/api/admin/crm/leads/${task.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'x-csrf': token },
          body: JSON.stringify({ assign_to_me: true }),
        });
        if (!res.ok) throw new Error('Impossible d’assigner le lead.');
      } else if (task.type === 'moderation.queue') {
        const res = await fetch(`/api/admin/moderation/queue/${task.id}/claim`, {
          method: 'POST',
          headers: { 'x-csrf': token },
        });
        if (!res.ok) throw new Error('Impossible de claim cet élément.');
      }

      toast({ type: 'success', title: 'OK', message: 'Assigné à vous.' });
      router.refresh();
    } catch (e) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: e instanceof Error ? e.message : "L’action a échoué.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">À faire maintenant</div>
            <div className="text-sm text-muted-foreground">Top 10 priorisé (avec actions rapides)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'team' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('team')}
          >
            Équipe
          </Button>
          <Button
            variant={view === 'mine' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('mine')}
          >
            Mon travail
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
            <RefreshCcw className="h-4 w-4" />
            Rafraîchir
          </Button>
        </div>
      </div>

      <AdminTable>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th>Priorité</th>
            <th>Tâche</th>
            <th>Quand</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {!hasItems ? (
            <tr>
              <td colSpan={4} className="py-10 text-center text-muted-foreground">
                Rien à traiter pour le moment.
              </td>
            </tr>
          ) : (
            top.map((task) => (
              <tr key={`${task.type}:${task.id ?? task.href}`}>
                <td>{priorityBadge(task.priority)}</td>
                <td>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-muted-foreground">{task.subtitle}</div>
                  <div className="text-xs text-muted-foreground">{task.meta}</div>
                </td>
                <td className="text-sm text-muted-foreground">
                  {task.created_at ? formatDateTime(task.created_at) : '-'}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {task.cta.kind === 'assign_to_me' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={loadingId === task.id}
                        onClick={() => runAssignToMe(task)}
                      >
                        {task.cta.label}
                      </Button>
                    ) : task.cta.kind === 'claim' ? (
                      task.owner_is_me ? (
                        <Badge variant="success">assigné à vous</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={loadingId === task.id}
                          onClick={() => runAssignToMe(task)}
                        >
                          {task.cta.label}
                        </Button>
                      )
                    ) : (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={task.cta.href}>{task.cta.label}</Link>
                      </Button>
                    )}

                    <Button asChild size="sm" variant="ghost">
                      <Link href={task.href}>Ouvrir</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
