import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { fetchContestLeaderboard, type LeaderboardEntry } from '@/lib/queries/contest-leaderboard';
import { EmptyState } from '@/components/creator/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { TrackOnView } from '@/components/analytics/track-once';
import { Progress } from '@/components/ui/progress';
import { Info } from 'lucide-react';

export const revalidate = 45;

type Mode = 'views' | 'score';

interface ContestLeaderboardPageProps {
  params: { id: string };
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContestLeaderboardPage({ params, searchParams }: ContestLeaderboardPageProps) {
  const { user } = await getSession();
  const supabase = await getSupabaseSSR();

  const paramsObj = await searchParams;

  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, title, prize_pool_cents, currency, status')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('Contest leaderboard fetch error', error);
  }

  if (!contest) {
    notFound();
  }

  const modeParam = typeof paramsObj.mode === 'string' ? paramsObj.mode : 'views';
  const mode: Mode = modeParam === 'score' ? 'score' : 'views';

  const leaderboard = await fetchContestLeaderboard(contest.id, 50);
  const myEntry = user ? leaderboard.find((l) => l.creator_id === user.id) : undefined;
  const top1 = leaderboard[0];

  const now = new Date();
  const lastUpdated = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const baseUrl = `/app/creator/contests/${contest.id}/leaderboard`;
  const viewsHref = `${baseUrl}?mode=views`;
  const scoreHref = `${baseUrl}?mode=score`;
  const refreshHref = `${baseUrl}?mode=${mode}&ts=${now.getTime()}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <TrackOnView
        event="view_leaderboard_page"
        payload={{
          contest_id: contest.id,
          entries: leaderboard.length,
          mode,
        }}
      />

      <div className="flex flex-col gap-2">
        <Link
          href={`/app/creator/contests/${contest.id}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Retour au concours
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold">Classement</h1>
            <p className="text-muted-foreground text-sm">
              Classement des créateurs pour « {contest.title} » – Prize pool{' '}
              {formatCurrency(contest.prize_pool_cents, contest.currency || 'EUR')}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="text-xs text-muted-foreground">Dernière mise à jour {lastUpdated}</div>
            <Button asChild variant="ghost" size="sm">
              <Link href={refreshHref}>Rafraîchir</Link>
            </Button>
            {myEntry && <Badge variant="success">Mon rang : #{myEntry.rank}</Badge>}
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Classement par :</span>
            <div className="inline-flex rounded-full border border-border bg-card p-0.5">
              <Link
                href={viewsHref}
                className={`px-3 py-1 rounded-full transition text-xs font-medium ${
                  mode === 'views' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Vues
              </Link>
              <Link
                href={scoreHref}
                className={`px-3 py-1 rounded-full transition text-xs font-medium ${
                  mode === 'score' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Score pondéré
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5" />
            <p>
              <span className="font-medium">Vues :</span> nombre total de vues brute sur la vidéo de participation.{' '}
              <span className="font-medium">Score pondéré :</span> vues ajustées en fonction du réseau et de la qualité
              du trafic (période, engagement, fraude). C&apos;est ce score qui est utilisé pour départager les
              ex‑aequo.
            </p>
          </div>
        </div>

        {myEntry && top1 && (
          <div className="rounded-xl border border-border p-3 bg-card/60">
            <div className="flex items-center justify-between text-sm">
              <span>Progression vs #1 (score pondéré)</span>
              <span className="font-medium">#{myEntry.rank}</span>
            </div>
            <Progress value={computeProgress(myEntry, top1)} className="mt-2" />
          </div>
        )}
      </div>

      {leaderboard.length === 0 ? (
        <EmptyState
          title="Leaderboard vide pour l'instant"
          description="Aucune participation visible pour ce concours. Revenez après les premières validations."
          action={{ label: 'Voir le concours', href: `/app/creator/contests/${contest.id}`, variant: 'secondary' }}
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {leaderboard.slice(0, 3).map((entry, index) => (
              <Card
                key={`${entry.creator_id}-${entry.rank}`}
                className={`relative overflow-hidden ${
                  index === 0 ? 'border-primary/60 shadow-lg shadow-primary/20' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/10 opacity-60" />
                <CardContent className="relative space-y-2 py-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="success">#{entry.rank}</Badge>
                    {user?.id === entry.creator_id && <Badge variant="info">Moi</Badge>}
                  </div>
                  <div className="text-lg font-semibold">{entry.creator_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Vues{' '}
                    <span className={mode === 'views' ? 'font-semibold text-foreground' : ''}>
                      {entry.total_views?.toLocaleString('fr-FR') ?? '-'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Score pondéré{' '}
                    <span className={mode === 'score' ? 'font-semibold text-foreground' : ''}>
                      {entry.total_weighted_views?.toLocaleString('fr-FR') ?? '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Top participants</CardTitle>
              <Button asChild size="sm" variant="secondary">
                <Link href={`/app/creator/contests/${contest.id}`}>Voir le concours</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Rang</th>
                      <th className="px-3 py-2 font-medium">Créateur</th>
                      <th
                        className={`px-3 py-2 font-medium ${
                          mode === 'views' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        Vues
                      </th>
                      <th
                        className={`px-3 py-2 font-medium ${
                          mode === 'score' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        Score pondéré
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry) => {
                      const isMe = user?.id === entry.creator_id;
                      return (
                        <tr
                          key={`${entry.creator_id}-${entry.rank}`}
                          className={`border-b border-border/60 last:border-0 hover:bg-muted/50 transition ${
                            isMe ? 'bg-primary/5' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <Badge variant={entry.rank <= 3 ? 'success' : 'default'}>#{entry.rank}</Badge>
                            {isMe && (
                              <Badge variant="info" className="ml-2">
                                Mon rang
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-foreground">{entry.creator_name}</td>
                          <td
                            className={`px-3 py-2 ${
                              mode === 'views' ? 'text-foreground font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            {entry.total_views?.toLocaleString('fr-FR')}
                          </td>
                          <td
                            className={`px-3 py-2 ${
                              mode === 'score' ? 'text-foreground font-medium' : 'text-muted-foreground'
                            }`}
                          >
                            {entry.total_weighted_views?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function computeProgress(me: LeaderboardEntry | undefined, top: LeaderboardEntry | undefined) {
  if (!top?.total_weighted_views || !me?.total_weighted_views) return 0;
  const ratio = (me.total_weighted_views / top.total_weighted_views) * 100;
  return Math.min(100, Math.max(0, ratio));
}
