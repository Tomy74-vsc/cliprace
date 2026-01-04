import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { redirect } from 'next/navigation';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { AdminFilters } from '@/components/admin/admin-filters';
import { AdminModerationQueue } from '@/components/admin/admin-moderation-queue';
import { AdminModerationRules } from '@/components/admin/admin-moderation-rules';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminHelpTooltip } from '@/components/admin/admin-help-tooltip';
import { Button } from '@/components/ui/button';
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

type QueueResponse = {
  items: QueueItem[];
  pagination: { total: number; page: number; limit: number };
};

type Rule = {
  id: string;
  name: string;
  description: string | null;
  rule_type: 'content' | 'spam' | 'duplicate' | 'domain' | 'flood';
  config: Record<string, unknown>;
  status?: 'draft' | 'published';
  version?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RulesResponse = { items: Rule[] };

type HistoryItem = {
  id: number;
  target_table: string;
  target_id: string;
  action: string;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
  actor: { id: string; display_name: string | null; email: string } | null;
};

type HistoryResponse = {
  items: HistoryItem[];
  pagination: { total: number; page: number; limit: number };
};

export default async function AdminModerationPage({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('moderation.read');
    canWrite = hasAdminPermission(access, 'moderation.write');
  } catch {
    redirect('/forbidden');
  }

  const status = typeof searchParams.status === 'string' ? searchParams.status : '';
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const limit = 20;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const [queueRes, rulesRes, historyRes] = await Promise.all([
    fetchAdminApi(`/api/admin/moderation/queue?${params.toString()}`, {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/moderation/rules', {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/moderation/history?limit=20&page=1', {
      cache: 'no-store',
    }),
  ]);

  const queueData: QueueResponse = queueRes.ok
    ? await queueRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit } };
  const rulesData: RulesResponse = rulesRes.ok ? await rulesRes.json() : { items: [] };
  const historyData: HistoryResponse = historyRes.ok
    ? await historyRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 20 } };

  const totalPages = Math.max(1, Math.ceil(queueData.pagination.total / queueData.pagination.limit));
  const prevHref = `/app/admin/moderation?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.max(1, page - 1)),
  }).toString()}`;
  const nextHref = `/app/admin/moderation?${new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(Math.min(totalPages, page + 1)),
  }).toString()}`;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="display-2">Moderation</h1>
        <p className="text-muted-foreground text-sm">Queue, rules, and moderation history.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Queue</h2>
            <AdminHelpTooltip
              label="Aide sur la queue de modération"
              content={
                <div className="space-y-1">
                  <div className="font-medium">Workflow</div>
                  <div>
                    Clique \u201cAssigner\u201d pour te r\u00e9server un item, puis prends une
                    d\u00e9cision. Les actions sont journalis\u00e9es.
                  </div>
                </div>
              }
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {queueData.pagination.total} items
          </div>
        </div>
        <form>
          <AdminFilters>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="status">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status || ''}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary">
                Filtrer
              </Button>
            </div>
          </AdminFilters>
        </form>
        <AdminModerationQueue items={queueData.items} canWrite={canWrite} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {queueData.pagination.page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page <= 1 ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Précédent</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={prevHref}>Précédent</Link>
              </Button>
            )}
            {page >= totalPages ? (
              <span className="px-4 py-2 text-xs text-muted-foreground">Suivant</span>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={nextHref}>Suivant</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Rules</h2>
            <AdminHelpTooltip
              label="Aide sur les règles de modération"
              content={
                <div className="space-y-1">
                  <div className="font-medium">R\u00e8gles</div>
                  <div>
                    Une r\u00e8gle active s\u2019applique automatiquement. Teste d\u2019abord en
                    lecture (ou en environnement de test) et documente le pourquoi.
                  </div>
                  <div>JSON invalide \u2192 la sauvegarde est refus\u00e9e.</div>
                </div>
              }
            />
          </div>
        </div>
        <AdminModerationRules rules={rulesData.items} canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">History</h2>
        <AdminTable>
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {historyData.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun historique de modération
                </td>
              </tr>
            ) : (
              historyData.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-4">
                    <div className="font-medium">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.target_table}</div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{item.target_id}</td>
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {item.actor?.display_name || item.actor?.email || item.actor_id || 'system'}
                    </div>
                    <div className="text-xs text-muted-foreground">{item.actor_id || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{item.reason || '-'}</td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {formatDateTime(item.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </div>
    </section>
  );
}
