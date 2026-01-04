'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';

import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminInbox } from '@/components/admin/admin-inbox-provider';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatDateTime } from '@/lib/formatters';

type OpsTaskItem = {
  id: string;
  task_type: string;
  title: string;
  description: string | null;
  href: string;
  count: number;
  oldest_at: string | null;
  age_hours: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  owner: string | null;
  owner_label: string | null;
  can_assign_to_me: boolean;
  can_write: boolean;
};

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

function priorityBadge(priority: OpsTaskItem['priority']) {
  if (priority === 'urgent') return <Badge variant="danger">urgent</Badge>;
  if (priority === 'high') return <Badge variant="warning">élevée</Badge>;
  if (priority === 'medium') return <Badge variant="info">moyenne</Badge>;
  return <Badge variant="secondary">basse</Badge>;
}

function statusBadge(status: string) {
  if (status === 'in_progress') return <Badge variant="info">en cours</Badge>;
  if (status === 'blocked') return <Badge variant="warning">bloquée</Badge>;
  return <Badge variant="secondary">ouverte</Badge>;
}

function ageLabel(hours: number | null) {
  if (hours === null) return '-';
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem ? `${days}j ${rem}h` : `${days}j`;
}

export function AdminInboxPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const kind = (searchParams.get('kind') === 'signals' ? 'signals' : 'ops') as 'ops' | 'signals';
  const scope = (searchParams.get('scope') === 'mine'
    ? 'mine'
    : searchParams.get('scope') === 'unassigned'
      ? 'unassigned'
      : 'team') as 'team' | 'mine' | 'unassigned';

  const { summary, refresh, loading } = useAdminInbox();
  const { toast } = useToastContext();

  const [opsItems, setOpsItems] = useState<OpsTaskItem[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  const signals = summary?.signals?.items ?? [];
  const updatedAt = summary?.generated_at ?? null;

  const loadOps = useMemo(
    () => async () => {
      setLoadingOps(true);
      try {
        const res = await fetch(`/api/admin/inbox/items?kind=ops&scope=${encodeURIComponent(scope)}`, { cache: 'no-store' });
        const data = await res.json();
        setOpsItems(Array.isArray(data?.items) ? data.items : []);
      } finally {
        setLoadingOps(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    if (kind !== 'ops') return;
    void loadOps();
  }, [kind, loadOps]);

  useEffect(() => {
    if (kind !== 'ops') return;
    const id = window.setInterval(() => {
      void loadOps();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [kind, loadOps]);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/app/admin/inbox?${params.toString()}`);
  };

  const assignToMe = async (taskId: string) => {
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/tasks/${taskId}/assign-to-me`, { method: 'POST', headers: { 'x-csrf': token } });
    if (!res.ok) throw new Error("Impossible d'assigner la tâche.");
  };

  const markDone = async (taskId: string) => {
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ status: 'done' }),
    });
    if (!res.ok) throw new Error('Impossible de terminer la tâche.');
  };

  const comment = async (taskId: string, message: string) => {
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/tasks/${taskId}/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Impossible d'ajouter le commentaire.");
  };

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="À traiter"
        description={
          summary
            ? `${summary.ops.total} élément(s) à traiter · ${summary.signals.total} signal(aux)`
            : 'Centre de tri admin : tâches + signaux.'
        }
        icon={<Inbox className="h-5 w-5" />}
        actions={
          <>
            <Button
              variant="secondary"
              loading={loading}
              onClick={async () => {
                await refresh();
                if (kind === 'ops') await loadOps();
              }}
            >
              Rafraîchir
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/dashboard">Dashboard</Link>
            </Button>
          </>
        }
        badges={updatedAt ? <Badge variant="secondary">Maj : {formatDateTime(updatedAt)}</Badge> : null}
      />

      <Tabs value={kind} onValueChange={(v) => setParam('kind', v === 'signals' ? 'signals' : 'ops')}>
        <TabsList>
          <TabsTrigger value="ops">À faire</TabsTrigger>
          <TabsTrigger value="signals">Signaux</TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant={scope === 'team' ? 'secondary' : 'ghost'} size="sm" onClick={() => setParam('scope', 'team')}>
                Équipe
              </Button>
              <Button variant={scope === 'mine' ? 'secondary' : 'ghost'} size="sm" onClick={() => setParam('scope', 'mine')}>
                Mon travail
              </Button>
              <Button
                variant={scope === 'unassigned' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setParam('scope', 'unassigned')}
              >
                Non assigné
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">{opsItems.length.toLocaleString()} élément(s)</div>
          </div>

          <AdminTable>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Priorité</th>
                <th>Tâche</th>
                <th>Assignation</th>
                <th>Volume</th>
                <th>SLA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingOps ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : opsItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Rien à traiter pour le moment.
                  </td>
                </tr>
              ) : (
                opsItems.map((item) => (
                  <tr key={item.id}>
                    <td className="space-y-1">
                      {priorityBadge(item.priority)}
                      {statusBadge(item.status)}
                    </td>
                    <td>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.description || item.task_type}</div>
                    </td>
                    <td className="text-sm">
                      {item.owner_label ? (
                        <div>
                          <div className="font-medium">{item.owner_label}</div>
                          <div className="text-xs text-muted-foreground">assigné</div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">non assigné</div>
                      )}
                    </td>
                    <td>
                      <Badge variant="danger">{item.count > 99 ? '99+' : item.count}</Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {ageLabel(item.age_hours)}
                      {item.oldest_at ? <div className="text-xs">{formatDateTime(item.oldest_at)}</div> : null}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {item.can_assign_to_me ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={async () => {
                              try {
                                await assignToMe(item.id);
                                toast({ type: 'success', title: 'OK', message: 'Assigné à vous.' });
                                await refresh();
                                await loadOps();
                                router.refresh();
                              } catch (e) {
                                toast({
                                  type: 'error',
                                  title: 'Erreur',
                                  message: e instanceof Error ? e.message : "L'action a échoué.",
                                });
                              }
                            }}
                          >
                            Assigner à moi
                          </Button>
                        ) : null}

                        {item.can_write ? (
                          <>
                            <AdminActionPanel
                              trigger={
                                <Button size="sm" variant="secondary">
                                  Commenter
                                </Button>
                              }
                              title="Ajouter un commentaire"
                              description="Visible par l’équipe admin."
                              confirmLabel="Ajouter"
                              requiresReason
                              reasonLabel="Commentaire"
                              reasonPlaceholder="Ex : J’ai relancé le webhook et je surveille."
                              onConfirm={async ({ reason }) => {
                                await comment(item.id, reason);
                                toast({ type: 'success', title: 'OK', message: 'Commentaire ajouté.' });
                              }}
                            />

                            <AdminActionPanel
                              trigger={
                                <Button size="sm" variant="ghost">
                                  Terminer
                                </Button>
                              }
                              title="Terminer la tâche"
                              description="Marque la tâche comme faite dans l’inbox."
                              confirmLabel="Terminer"
                              confirmVariant="primary"
                              onConfirm={async () => {
                                await markDone(item.id);
                                toast({ type: 'success', title: 'OK', message: 'Tâche terminée.' });
                                await refresh();
                                await loadOps();
                                router.refresh();
                              }}
                            />
                          </>
                        ) : null}

                        <Button asChild size="sm" variant="secondary">
                          <Link href={item.href}>Ouvrir</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminTable>
        </TabsContent>

        <TabsContent value="signals">
          <AdminTable>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Sévérité</th>
                <th>Signal</th>
                <th>Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-muted-foreground">
                    Aucun signal.
                  </td>
                </tr>
              ) : (
                signals.map((sig) => (
                  <tr key={sig.key}>
                    <td>
                      <Badge variant={sig.severity === 'danger' ? 'danger' : sig.severity === 'warning' ? 'warning' : 'info'}>
                        {sig.severity}
                      </Badge>
                    </td>
                    <td>
                      <div className="font-medium">{sig.title}</div>
                      <div className="text-xs text-muted-foreground">{sig.message}</div>
                    </td>
                    <td>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={sig.href}>Voir</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminTable>
        </TabsContent>
      </Tabs>
    </section>
  );
}

