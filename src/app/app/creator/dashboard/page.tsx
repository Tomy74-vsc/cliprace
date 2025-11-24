/*
Page: Creator dashboard
Objectifs: stats rapides, prochain concours, notifications rÃ©centes.
*/
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { StatCard } from '@/components/creator/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/creator/empty-state';
import { formatCurrency } from '@/lib/formatters';
import { Trophy, Clock } from 'lucide-react';
import { track } from '@/lib/analytics';

export default async function CreatorDashboard() {
  const { user } = await getSession();
  if (!user) return null;

  track('view_dashboard', { role: 'creator' });

  const data = await fetchDashboardData(user.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Salut {user.display_name || 'crÃ©ateur'} ðŸ‘‹</h1>
          <p className="text-muted-foreground">RÃ©sumÃ© de ton activitÃ© ClipRace.</p>
        </div>
        <Button asChild>
          <Link href="/app/creator/contests">DÃ©couvrir les concours</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Participations" value={String(data.stats.submissions_count)} hint="Total" />
        <StatCard label="En compÃ©tition" value={String(data.stats.approved_submissions)} hint="Soumissions actives" />
        <StatCard
          label="Gains cumulÃ©s"
          value={formatCurrency(data.stats.balance_cents, 'EUR')}
          hint="Solde estimÃ©"
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prochain concours</CardTitle>
          </CardHeader>
          <CardContent>
            {data.next_contest ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold">{data.next_contest.title}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="h-4 w-4 text-primary" />
                  {formatCurrency(data.next_contest.prize_pool_cents, data.next_contest.currency)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Se termine le {new Date(data.next_contest.end_at).toLocaleDateString('fr-FR')}
                </div>
                <Button asChild size="sm">
                  <Link href={`/app/creator/contests/${data.next_contest.id}`}>Voir le concours</Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                title="Aucun concours en cours"
                description="DÃ©couvre les opportunitÃ©s disponibles."
                action={{ label: 'Voir les concours', href: '/app/creator/contests' }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Notifications</CardTitle>
              {data.stats.unread_notifications > 0 && (
                <Badge variant="danger">{data.stats.unread_notifications} non lues</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notifications.length === 0 ? (
              <EmptyState title="Rien de nouveau" description="Tu seras alertÃ© dÃ¨s quâ€™il y aura du mouvement." />
            ) : (
              <ul className="divide-y divide-border">
                {data.notifications.map((notification) => (
                  <li key={notification.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{notificationTitle(notification.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.content?.message || 'Nouvelle action disponible.'}
                      </p>
                    </div>
                    {!notification.read && <Badge variant="info" className="flex items-center gap-1"><Bell className="h-3 w-3" />Nouveau</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

interface DashboardData {
  stats: {
    submissions_count: number;
    approved_submissions: number;
    balance_cents: number;
    unread_notifications: number;
  };
  next_contest: {
    id: string;
    title: string;
    prize_pool_cents: number;
    end_at: string;
    currency: string;
  } | null;
  notifications: {
    id: string;
    type: string;
    content: Record<string, string>;
    read: boolean;
    created_at: string;
  }[];
}

async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const supabase = getSupabaseSSR();
  const now = new Date().toISOString();

  const { data: submissions } = await supabase.from('submissions').select('status').eq('creator_id', userId);
  const submissions_count = submissions?.length || 0;
  const approved_submissions = submissions?.filter((s) => s.status === 'approved').length || 0;

  const { data: winnings } = await supabase.from('contest_winnings').select('payout_cents, paid_at').eq('creator_id', userId);
  const { data: cashouts } = await supabase.from('cashouts').select('amount_cents, status').eq('creator_id', userId);
  const unpaid = (winnings || []).filter((w) => !w.paid_at).reduce((sum, w) => sum + w.payout_cents, 0);
  const pendingCashouts =
    cashouts?.filter((c) => ['requested', 'processing'].includes(c.status)).reduce((sum, c) => sum + c.amount_cents, 0) || 0;

  const balance_cents = Math.max(0, unpaid - pendingCashouts);

  const { data: nextContest } = await supabase
    .from('contests')
    .select('id, title, prize_pool_cents, currency, end_at')
    .eq('status', 'active')
    .gte('end_at', now)
    .order('end_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, content, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const unread_notifications = notifications?.filter((n) => !n.read).length || 0;

  return {
    stats: {
      submissions_count,
      approved_submissions,
      balance_cents,
      unread_notifications,
    },
    next_contest: nextContest
      ? {
          id: nextContest.id,
          title: nextContest.title,
          prize_pool_cents: nextContest.prize_pool_cents,
          currency: nextContest.currency || 'EUR',
          end_at: nextContest.end_at,
        }
      : null,
    notifications: notifications || [],
  };
}

function notificationTitle(type: string) {
  switch (type) {
    case 'submission_approved':
      return 'Ta participation est acceptÃ©e';
    case 'submission_rejected':
      return 'Ta participation est refusÃ©e';
    case 'contest_ending_soon':
      return 'Concours bientÃ´t terminÃ©';
    case 'cashout_completed':
      return 'Retrait effectuÃ©';
    default:
      return 'Notification';
  }
}


