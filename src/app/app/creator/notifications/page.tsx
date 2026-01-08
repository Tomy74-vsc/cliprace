import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseSSR } from "@/lib/supabase/ssr";
import { MarkNotificationsReadButton } from "@/components/notifications/mark-notifications-read-button";
import {
  NotificationItem,
  type NotificationRow,
  type NotificationType,
} from "@/components/notifications/notification-item";
import { TrackOnView } from "@/components/analytics/track-once";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/creator/empty-state";

const PAGE_SIZE = 20;

interface NotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CreatorNotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const { user } = await getSession();
  if (!user) {
    notFound();
  }

  const params = await searchParams;

  const statusParam = params.status;
  const statusFilter: "all" | "unread" =
    statusParam === "unread" ? "unread" : "all";

  const rawType = typeof params.type === "string" ? params.type : "default";
  const allowedTypes: NotificationType[] = [
    "message_new",
    "submission_moderated",
    "payout",
    "default",
  ];
  const typeFilter: NotificationType = (allowedTypes as string[]).includes(rawType)
    ? (rawType as NotificationType)
    : "default";

  const currentPageRaw = Number(params.page);
  const page =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0
      ? Math.floor(currentPageRaw)
      : 1;

  const { notifications, total, unreadTotal } = await fetchNotifications({
    userId: user.id,
    status: statusFilter,
    type: typeFilter,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <TrackOnView
        event="view_notifications"
        payload={{
          total,
          page,
          status: statusFilter,
          type: typeFilter,
          unread_count: unreadIds.length,
        }}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="display-2">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Centre d&apos;alertes : paiements, soumissions, messages.
            </p>
          </div>
          <MarkNotificationsReadButton
            disabled={unreadIds.length === 0}
            notificationIds={unreadIds}
          />
        </div>
      </div>

      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-background/80 backdrop-blur">
        <FilterLink
          label="Toutes"
          active={statusFilter === "all" && typeFilter === "default"}
          href={buildLink({ status: undefined, type: undefined })}
        />
        <FilterLink
          label={`Non lues (${unreadTotal})`}
          active={statusFilter === "unread"}
          href={buildLink({ status: "unread", type: undefined })}
        />
        <FilterLink
          label="Paiements"
          active={typeFilter === "payout"}
          href={buildLink({
            type: "payout",
            status: statusFilter === "unread" ? "unread" : undefined,
          })}
        />
        <FilterLink
          label="Soumissions"
          active={typeFilter === "submission_moderated"}
          href={buildLink({
            type: "submission_moderated",
            status: statusFilter === "unread" ? "unread" : undefined,
          })}
        />
        <FilterLink
          label="Messages"
          active={typeFilter === "message_new"}
          href={buildLink({
            type: "message_new",
            status: statusFilter === "unread" ? "unread" : undefined,
          })}
        />
        <div className="ml-auto flex items-center gap-2">
          <MarkNotificationsReadButton
            disabled={unreadIds.length === 0}
            notificationIds={unreadIds}
          />
        </div>
      </div>

      <section aria-live="polite">
        {notifications.length === 0 ? (
          <EmptyState
            type="notifications"
            title={
              statusFilter === "unread"
                ? "Tu es à jour"
                : "Aucune notification pour le moment"
            }
            description={
              statusFilter === "unread"
                ? "Aucune notification non lue. Reviens après ta prochaine participation ou paiement."
                : "Tu recevras ici les alertes importantes sur tes participations, messages et gains."
            }
            action={{
              label: "Personnaliser mes alertes",
              href: "/app/creator/settings",
              variant: "secondary",
            }}
          />
        ) : (
          <div className="space-y-4">
            {groupByDay(notifications).map(({ day, items }) => (
              <Card key={day} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-muted-foreground">{day}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {items.length} notification{items.length > 1 ? "s" : ""}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-6"
          aria-label="Pagination notifications"
        >
          <PaginationLink
            targetPage={page - 1}
            disabled={page <= 1}
            searchParams={params}
          >
            Précédent
          </PaginationLink>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <PaginationLink
            targetPage={page + 1}
            disabled={page >= totalPages}
            searchParams={params}
          >
            Suivant
          </PaginationLink>
        </nav>
      )}
    </main>
  );
}

function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "message_new":
      return "Message";
    case "submission_moderated":
      return "Soumission";
    case "payout":
      return "Paiement";
    default:
      return "Notification";
  }
}

function buildLink(params: { status?: string; type?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `?${query}` : "";
}

function FilterLink({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  const target = href && href.length > 0 ? href : ".";
  return (
    <Link
      href={target}
      className={`text-sm font-medium px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-[#635BFF]/10 border-[#635BFF]/30 text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      aria-current={active ? "true" : undefined}
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
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string]),
  );
  if (targetPage > 1) params.set("page", String(targetPage));
  else params.delete("page");
  const target = params.toString() ? `?${params.toString()}` : ".";

  return (
    <Link
      href={target}
      aria-disabled={disabled}
      className={`text-sm font-medium ${
        disabled ? "text-muted-foreground pointer-events-none" : "text-[#635BFF]"
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
  status: "all" | "unread";
  type: NotificationType;
  page: number;
}) {
  const supabase = await getSupabaseSSR();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("notifications")
    .select("id, type, content, read, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "unread") {
    query = query.eq("read", false);
  }

  if (type && type !== "default") {
    query = query.eq("type", type);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("Error loading notifications:", error);
    return { notifications: [] as NotificationRow[], total: 0, unreadTotal: 0 };
  }

  const notifications: NotificationRow[] = (data || []).map((row) => {
    const content = (row.content as Record<string, string>) || {};
    const rowType = (row.type as NotificationType) || "default";
    return {
      id: row.id as string,
      type: rowType,
      read: row.read as boolean,
      created_at: row.created_at as string,
      title: content.title || notificationTypeLabel(rowType),
      message: content.message || "Nouvelle notification",
      actionUrl: content.action_url,
      avatarUrl: content.avatar_url || content.brand_avatar_url || content.sender_avatar_url,
    };
  });

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return { notifications, total: count || 0, unreadTotal: unreadCount || 0 };
}

function groupByDay(items: NotificationRow[]) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const groups = new Map<string, NotificationRow[]>();
  items.forEach((item) => {
    const day = formatter.format(new Date(item.created_at));
    const existing = groups.get(day);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(day, [item]);
    }
  });

  return Array.from(groups.entries()).map(([day, groupedItems]) => ({
    day,
    items: groupedItems,
  }));
}
