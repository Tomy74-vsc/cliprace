/*
Source: Creator notifications center (Phase 2)
*/
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { MarkNotificationsReadButton } from '@/components/notifications/mark-notifications-read-button';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 20;

interface NotificationsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function CreatorNotificationsPage({ searchParams }: NotificationsPageProps) {
  const { user } = await getSession();
  if (!user) {
    notFound();
  }

  const statusFilter = searchParams.status === 'unread' ? 'unread' : 'all';
  const typeFilter = typeof searchParams.type === 'string' ? searchParams.type : 'all';
  const currentPageRaw = Number(searchParams.page);
  const page = Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1;

  const { notifications, total } = await fetchNotifications({
    userId: user.id,
    status: statusFilter,
    type: typeFilter,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="display-2">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Toutes vos notifications système, modération et messages.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
        <FilterLink label="Toutes" active={statusFilter === 'all'} href={buildLink({ status: undefined, type: typeFilter !== 'all' ? typeFilter : undefined })} />
        <FilterLink label="Non lues" active={statusFilter === 'unread'} href={buildLink({ status: 'unread', type: typeFilter !== 'all' ? typeFilter : undefined })} />
        <span className="text-xs text-muted-foreground mx-2">|</span>
        <FilterLink label="Tous les types" active={typeFilter === 'all'} href={buildLink({ type: undefined, status: statusFilter === 'unread' ? 'unread' : undefined })} />
        <FilterLink label="Messages" active={typeFilter === 'message_new'} href={buildLink({ type: 'message_new', status: statusFilter === 'unread' ? 'unread' : undefined })} />
        <FilterLink label="Soumissions" active={typeFilter === 'submission_moderated'} href={buildLink({ type: 'submission_moderated', status: statusFilter === 'unread' ? 'unread' : undefined })} />
        <FilterLink label="Paiements" active={typeFilter === 'payout'} href={buildLink({ type: 'payout', status: statusFilter === 'unread' ? 'unread' : undefined })} />
        <div className="ml-auto">
          <MarkNotificationsReadButton disabled={unreadIds.length === 0} notificationIds={unreadIds} />
        </div>
      </div>

      <section aria-live="polite">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-sm text-muted-foreground">
            {statusFilter === 'unread'
              ? 'Vous êtes à jour, aucune notification non lue.'
              : 'Aucune notification pour le moment.'}
          </div>
        ) : (
          <ul role="list" className="space-y-4">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                role="listitem"
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{notificationTypeLabel(notification.type)}</Badge>
                    {!notification.read && (
                      <Badge variant="secondary" className="uppercase text-[10px]">
                        Nouveau
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(notification.created_at))}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {notification.actionUrl && (
                    <Link
                      href={notification.actionUrl}
                      className="text-sm font-medium text-[#635BFF] hover:underline"
                    >
                      Ouvrir
                    </Link>
                  )}
                  {!notification.read && (
                    <MarkNotificationsReadButton notificationIds={[notification.id]} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6"
          aria-label="Pagination notifications"
        >
          <PaginationLink targetPage={page - 1} disabled={page <= 1} searchParams={searchParams}>
            Précédent
          </PaginationLink>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <PaginationLink targetPage={page + 1} disabled={page >= totalPages} searchParams={searchParams}>
            Suivant
          </PaginationLink>
        </nav>
      )}
    </main>
  );
}

function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'message_new':
      return 'Message';
    case 'submission_moderated':
      return 'Soumission';
    case 'payout':
      return 'Paiement';
    default:
      return 'Notification';
  }
}

function buildLink(params: { status?: string; type?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.type) search.set('type', params.type);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `?${query}` : '';
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  const target = href && href.length > 0 ? href : '.';
  return (
    <Link
      href={target}
      className={`text-sm font-medium px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-[#635BFF]/10 border-[#635BFF]/30 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      aria-current={active ? 'true' : undefined}
    >
      {label}
    </Link>
  );
}

function PaginationLink({
  targetPage,
  disabled,
  children,
  searchParams,
}: {
  targetPage: number;
  disabled: boolean;
  children: React.ReactNode;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams(
    Object.entries(searchParams)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string])
  );
  if (targetPage > 1) params.set('page', String(targetPage));
  else params.delete('page');
  const target = params.toString() ? `?${params.toString()}` : '.';

  return (
    <Link
      href={target}
      aria-disabled={disabled}
      className={`text-sm font-medium ${
        disabled ? 'text-muted-foreground pointer-events-none' : 'text-[#635BFF]'
      }`}
    >
      {children}
    </Link>
  );
}

async function fetchNotifications({
  userId,
  status,
  type,
  page,
}: {
  userId: string;
  status: 'all' | 'unread';
  type: string;
  page: number;
}) {
  const supabase = getSupabaseSSR();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('notifications')
    .select('id, type, content, read, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status === 'unread') {
    query = query.eq('read', false);
  }

  if (type !== 'all') {
    query = query.eq('type', type);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('Error loading notifications:', error);
    return { notifications: [], total: 0 };
  }

  const notifications = (data || []).map((row) => {
    const content = (row.content as Record<string, string>) || {};
    return {
      id: row.id,
      type: row.type,
      read: row.read,
      created_at: row.created_at,
      title: content.title || notificationTypeLabel(row.type),
      message: content.message || 'Nouvelle notification',
      actionUrl: content.action_url,
    };
  });

  return { notifications, total: count || 0 };
}
