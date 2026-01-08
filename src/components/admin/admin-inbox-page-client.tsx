'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, ClipboardList, Inbox, Users } from 'lucide-react';

import { AdminActionPanel } from '@/components/admin/admin-action-panel';
import { AdminEntityDrawer } from '@/components/admin/admin-entity-drawer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTable } from '@/components/admin/admin-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminInbox } from '@/components/admin/admin-inbox-provider';
import { useToastContext } from '@/hooks/use-toast-context';
import { formatDateTime } from '@/lib/formatters';
import { getCsrfToken } from '@/lib/csrf-client';

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
  due_at: string | null;
  sla_hours: number | null;
  sla_status: 'overdue' | 'warning' | 'ok' | null;
};

function priorityBadge(priority: OpsTaskItem['priority']) {
  if (priority === 'urgent') return <Badge variant="danger">urgent</Badge>;
  if (priority === 'high') return <Badge variant="warning">high</Badge>;
  if (priority === 'medium') return <Badge variant="info">medium</Badge>;
  return <Badge variant="secondary">low</Badge>;
}

function statusBadge(status: string) {
  if (status === 'in_progress') return <Badge variant="info">in progress</Badge>;
  if (status === 'blocked') return <Badge variant="warning">blocked</Badge>;
  return <Badge variant="secondary">open</Badge>;
}

function ageLabel(hours: number | null) {
  if (hours === null) return '-';
  if (hours < 1) return '< 1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem ? `${days}d ${rem}h` : `${days}d`;
}

function slaBadge(slaStatus: OpsTaskItem['sla_status'], slaHours: number | null) {
  if (slaStatus === null) return null;
  if (slaStatus === 'overdue') {
    return <Badge variant="danger">overdue {slaHours !== null && slaHours < 0 ? `(${Math.abs(Math.floor(slaHours / 24))}d)` : ''}</Badge>;
  }
  if (slaStatus === 'warning') {
    return <Badge variant="warning">SLA &lt; 24h</Badge>;
  }
  return <Badge variant="success">SLA ok</Badge>;
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
  const [selectedTask, setSelectedTask] = useState<OpsTaskItem | null>(null);
  const [playbook, setPlaybook] = useState<UnsafeAny | null>(null);
  const [loadingPlaybook, setLoadingPlaybook] = useState(false);

  const signals = summary?.signals?.items ?? [];
  const updatedAt = summary?.generated_at ?? null;
  const opsTotal = summary?.ops?.total ?? opsItems.length;
  const signalsTotal = summary?.signals?.total ?? signals.length;
  const unassignedCount = useMemo(
    () => opsItems.filter((item) => !item.owner_label).length,
    [opsItems]
  );
  const overdueCount = useMemo(
    () => opsItems.filter((item) => item.sla_status === 'overdue').length,
    [opsItems]
  );
  const urgentCount = useMemo(
    () => opsItems.filter((item) => item.priority === 'urgent').length,
    [opsItems]
  );

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
    if (!res.ok) throw new Error("Unable to assign task.");
  };

  const markDone = async (taskId: string) => {
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ status: 'done' }),
    });
    if (!res.ok) throw new Error('Unable to close task.');
  };

  const comment = async (taskId: string, message: string) => {
    const token = await getCsrfToken();
    const res = await fetch(`/api/admin/tasks/${taskId}/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf': token },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Unable to add comment.");
  };

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Inbox"
        description={
          summary
            ? `${summary.ops.total} items to triage | ${summary.signals.total} signals`
            : "Admin triage: tasks + signals."
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
              Refresh
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/dashboard">Dashboard</Link>
            </Button>
          </>
        }
        badges={
          updatedAt ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Updated: {formatDateTime(updatedAt)}</Badge>
              <Badge variant="secondary">Auto refresh: 30s</Badge>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Ops queue
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{opsTotal.toLocaleString()}</div>
            <Badge variant={urgentCount > 0 ? 'danger' : 'secondary'}>Urgent {urgentCount}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Unassigned
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{unassignedCount.toLocaleString()}</div>
            <Button size="sm" variant="secondary" onClick={() => setParam('scope', 'unassigned')}>
              View
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              SLA overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{overdueCount.toLocaleString()}</div>
            <Badge variant={overdueCount > 0 ? 'danger' : 'secondary'}>{overdueCount > 0 ? 'Action' : 'Ok'}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{signalsTotal.toLocaleString()}</div>
            <Button size="sm" variant="ghost" onClick={() => setParam('kind', 'signals')}>
              Open
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs value={kind} onValueChange={(v) => setParam('kind', v === 'signals' ? 'signals' : 'ops')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ops" className="flex items-center justify-between gap-2">
            <span>To do</span>
            <Badge variant="secondary">{opsTotal.toLocaleString()}</Badge>
          </TabsTrigger>
          <TabsTrigger value="signals" className="flex items-center justify-between gap-2">
            <span>Signals</span>
            <Badge variant="secondary">{signalsTotal.toLocaleString()}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ops" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="flex items-center gap-2">
                <Button variant={scope === 'team' ? 'secondary' : 'ghost'} size="sm" onClick={() => setParam('scope', 'team')}>
                  Team
                </Button>
                <Button variant={scope === 'mine' ? 'secondary' : 'ghost'} size="sm" onClick={() => setParam('scope', 'mine')}>
                  My work
                </Button>
                <Button
                  variant={scope === 'unassigned' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setParam('scope', 'unassigned')}
                >
                  Unassigned
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">Unassigned {unassignedCount}</Badge>
                <Badge variant="secondary">Overdue {overdueCount}</Badge>
                <Badge variant="secondary">Urgent {urgentCount}</Badge>
                <span>{opsItems.length.toLocaleString()} items</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Ops tasks
                <Badge variant="secondary">{opsItems.length.toLocaleString()} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
          <AdminTable>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Priority</th>
                <th>Task</th>
                <th>Owner</th>
                <th>Count</th>
                <th>SLA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingOps ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : opsItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nothing to triage right now.
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
                          <div className="text-xs text-muted-foreground">assigned</div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">unassigned</div>
                      )}
                    </td>
                    <td>
                      <Badge variant="danger">{item.count > 99 ? '99+' : item.count}</Badge>
                    </td>
                    <td className="text-sm">
                      {item.sla_status ? (
                        <div className="space-y-1">
                          {slaBadge(item.sla_status, item.sla_hours)}
                          {item.due_at ? (
                            <div className="text-xs text-muted-foreground">
                              Due: {formatDateTime(item.due_at)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          {ageLabel(item.age_hours)}
                          {item.oldest_at ? <div className="text-xs">{formatDateTime(item.oldest_at)}</div> : null}
                        </div>
                      )}
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
                                toast({ type: 'success', title: 'OK', message: 'Assigned to you.' });
                                await refresh();
                                await loadOps();
                                router.refresh();
                              } catch (e) {
                                toast({
                                  type: 'error',
                                  title: 'Erreur',
                                  message: e instanceof Error ? e.message : "Action failed.",
                                });
                              }
                            }}
                          >
                            Assign to me
                          </Button>
                        ) : null}

                        {item.can_write ? (
                          <>
                            <AdminActionPanel
                              trigger={
                                <Button size="sm" variant="secondary">
                                  Comment
                                </Button>
                              }
                              title="Add comment"
                              description="Visible to the admin team."
                              confirmLabel="Add"
                              requiresReason
                              reasonLabel="Comment"
                              reasonPlaceholder="Example: I retried the webhook and I am monitoring."
                              onConfirm={async ({ reason }) => {
                                await comment(item.id, reason);
                                toast({ type: 'success', title: 'OK', message: 'Comment added.' });
                              }}
                            />

                            <AdminActionPanel
                              trigger={
                                <Button size="sm" variant="ghost">
                                  Done
                                </Button>
                              }
                              title="Close task"
                              description="Marks the task as done in the inbox."
                              confirmLabel="Close"
                              confirmVariant="primary"
                              onConfirm={async () => {
                                await markDone(item.id);
                                toast({ type: 'success', title: 'OK', message: 'Task completed.' });
                                await refresh();
                                await loadOps();
                                router.refresh();
                              }}
                            />
                          </>
                        ) : null}

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedTask(item);
                            // Load playbook
                            setLoadingPlaybook(true);
                            fetch(`/api/admin/playbooks/${item.task_type}`)
                              .then((res) => res.json())
                              .then((data) => {
                                setPlaybook(data.playbook);
                              })
                              .catch(() => setPlaybook(null))
                              .finally(() => setLoadingPlaybook(false));
                          }}
                        >
                          Details
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={item.href}>Open</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminTable>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Signals
                <Badge variant="secondary">{signalsTotal.toLocaleString()} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
          <AdminTable>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th>Severity</th>
                <th>Signal</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-muted-foreground">
                    No signals.
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
                        <Link href={sig.href}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AdminTable>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task drawer and playbook */}
      {selectedTask && (
        <AdminEntityDrawer
          open={!!selectedTask}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTask(null);
              setPlaybook(null);
            }
          }}
          entityType="user"
          entityId={selectedTask.id}
        />
      )}

      {/* Playbook drawer */}
      {selectedTask && (
        <div className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full border-l border-border bg-background/95 backdrop-blur-xl shadow-2xl">
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Playbook
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTask(null);
                    setPlaybook(null);
                  }}
                >
                  Close
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Type: {selectedTask.task_type}</span>
                <span>Count: {selectedTask.count > 99 ? '99+' : selectedTask.count}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Task snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-base font-semibold">{selectedTask.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedTask.description || selectedTask.task_type}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {priorityBadge(selectedTask.priority)}
                    {statusBadge(selectedTask.status)}
                    {slaBadge(selectedTask.sla_status, selectedTask.sla_hours)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                    <span>Oldest: {selectedTask.oldest_at ? formatDateTime(selectedTask.oldest_at) : '-'}</span>
                    <span>Age: {ageLabel(selectedTask.age_hours)}</span>
                  </div>
                </CardContent>
              </Card>

              {loadingPlaybook ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : playbook ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{playbook.title}</CardTitle>
                    {playbook.summary && (
                      <p className="text-sm text-muted-foreground">{playbook.summary}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {playbook.body_md ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm">{playbook.body_md}</pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No content available.</p>
                    )}
                    {Array.isArray(playbook.tags) && playbook.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {playbook.tags.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-sm text-muted-foreground">No playbook available for this task type.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}














