import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/creator/empty-state';
import { ProgressSteps, type ProgressStep } from '@/components/creator/progress-steps';
import { formatCurrency } from '@/lib/formatters';
import { Clock, Trophy, PlayCircle, CheckCircle2, Crown, Film, ListOrdered } from 'lucide-react';
import type { Platform } from '@/lib/validators/platforms';

interface ContestDetail {
  id: string;
  title: string;
  brief_md?: string | null;
  description?: string | null;
  cover_url?: string | null;
  prize_pool_cents: number;
  currency: string;
  end_at: string;
  networks: Platform[];
  status: string;
  brand?: { display_name?: string | null; avatar_url?: string | null } | null;
  prizes?: { rank: number; amount_cents: number }[] | null;
}

export default async function ContestDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseSSR();
  const { data: contest, error } = await supabase
    .from('contests')
    .select(
      `
      id,
      title,
      brief_md,
      description,
      cover_url,
      prize_pool_cents,
      currency,
      end_at,
      networks,
      status,
      brand:brand_id (
        display_name,
        avatar_url
      ),
      prizes:contest_prizes (
        rank,
        amount_cents
      )
    `
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('Contest fetch error', error);
  }
  if (!contest) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          title="Concours introuvable"
          description="Ce concours n'existe plus ou n'est pas accessible."
          action={{ label: 'Retour aux concours', href: '/app/creator/contests', variant: 'secondary' }}
        />
      </main>
    );
  }

  const steps: ProgressStep[] = [
    { title: 'Créer ta vidéo', description: `Publie sur ${contest.networks.join(', ') || 'ton réseau'}`, state: 'completed' },
    { title: 'Ajouter les hashtags', description: '#ClipRace + hashtag de marque', state: 'current' },
    { title: 'Coller le lien', description: 'Soumets ta vidéo dans ClipRace', state: 'upcoming' },
  ];

  const isEnded = contest.status === 'ended' || contest.status === 'archived';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <Card className="overflow-hidden">
        {contest.cover_url && (
          <div className="relative h-64 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contest.cover_url} alt={contest.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant={isEnded ? 'default' : 'success'}>
              {isEnded ? 'Terminé' : 'Actif'}
            </Badge>
            <Badge variant="info" className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              {formatCurrency(contest.prize_pool_cents, contest.currency || 'EUR')}
            </Badge>
            <Badge variant="default" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Fin le {new Date(contest.end_at).toLocaleDateString('fr-FR')}
            </Badge>
          </div>
          <CardTitle className="text-3xl">{contest.title}</CardTitle>
          {contest.brand?.display_name && (
            <p className="text-sm text-muted-foreground">Proposé par {contest.brand.display_name}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {contest.brief_md && <p className="text-muted-foreground">{contest.brief_md}</p>}
          <div className="flex flex-wrap gap-2">
            {contest.networks?.map((n) => (
              <Badge key={n} variant="default">
                {n}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild disabled={isEnded}>
              <Link href={`/app/creator/contests/${contest.id}/participate`}>Participer maintenant</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/creator/contests">Voir tous les concours</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comment ça marche</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressSteps steps={steps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Récompenses</CardTitle>
        </CardHeader>
        <CardContent>
          {contest.prizes && contest.prizes.length > 0 ? (
            <div className="space-y-2">
              {contest.prizes
                .sort((a, b) => a.rank - b.rank)
                .map((p) => (
                  <div key={p.rank} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      <span className="font-semibold">#{p.rank}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(p.amount_cents, contest.currency || 'EUR')}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pas de récompenses détaillées. Le prize pool global s’applique.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pourquoi participer ?</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Feature title="Gain" description="Prize pool garanti et classement clair." icon={<Trophy className="h-5 w-5" />} />
          <Feature title="Visibilité" description="Expose ta vidéo auprès de la marque." icon={<PlayCircle className="h-5 w-5" />} />
          <Feature title="Validation simple" description="Submission en quelques clics." icon={<CheckCircle2 className="h-5 w-5" />} />
        </CardContent>
      </Card>

      <SubmissionsShowcase contestId={contest.id} />
      <LeaderboardTop contestId={contest.id} />

      {!isEnded && (
        <div className="fixed bottom-20 inset-x-0 px-4 md:hidden">
          <Button asChild className="w-full shadow-card-hover">
            <Link href={`/app/creator/contests/${contest.id}/participate`}>Participer maintenant</Link>
          </Button>
        </div>
      )}
    </main>
  );
}

function Feature({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-2">
      <div className="flex items-center gap-2 text-primary">{icon}<span className="font-semibold text-foreground">{title}</span></div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

async function SubmissionsShowcase({ contestId }: { contestId: string }) {
  const supabase = getSupabaseSSR();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, external_url, platform, creator_handle, views')
    .eq('contest_id', contestId)
    .eq('status', 'approved')
    .order('views', { ascending: false })
    .limit(6);

  if (error || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exemples de vidéos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Pas encore de soumissions approuvées.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exemples de vidéos</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-3">
        {data.map((item) => (
          <a
            key={item.id}
            href={item.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border p-3 hover:-translate-y-1 hover:shadow-card-hover transition block"
          >
            <div className="text-sm font-medium">{item.creator_handle || 'Créateur'}</div>
            <div className="text-xs text-muted-foreground">Views : {item.views ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Plateforme : {item.platform}</div>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

async function LeaderboardTop({ contestId }: { contestId: string }) {
  const supabase = getSupabaseSSR();
  const { data, error } = await supabase
    .from('leaderboards')
    .select('creator_handle, views, rank, prize_cents')
    .eq('contest_id', contestId)
    .order('rank', { ascending: true })
    .limit(5);

  if (error || !data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Leaderboard indisponible.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leaderboard</CardTitle>
        <Link href={`/app/creator/contests/${contestId}/leaderboard`} className="text-sm text-primary hover:underline">
          Voir tout
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((row) => (
          <div key={`${row.creator_handle}-${row.rank}`} className="flex items-center gap-3 border border-border rounded-xl px-3 py-2">
            <Badge variant="default">#{row.rank}</Badge>
            <div className="flex-1">
              <div className="font-medium">{row.creator_handle || 'Créateur'}</div>
              <div className="text-xs text-muted-foreground">Views : {row.views ?? '—'}</div>
            </div>
            {row.prize_cents ? (
              <div className="text-sm font-semibold">{formatCurrency(row.prize_cents, 'EUR')}</div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
