import Link from 'next/link';
import type React from 'react';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/creator/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Clock, Trophy, PlayCircle, CheckCircle2, Crown, Shield, AlertTriangle, Info } from 'lucide-react';
import type { Platform } from '@/lib/validators/platforms';
import { TrackedLink } from '@/components/analytics/track-once';
import { fetchContestLeaderboard, type LeaderboardEntry } from '@/lib/queries/contest-leaderboard';
import { PlatformBadge } from '@/components/creator/platform-badge';

type StatusFilter = 'active' | 'upcoming' | 'ended';
interface ContestDetail {
  id: string;
  title: string;
  brief_md?: string | null;
  description?: string | null;
  cover_url?: string | null;
  prize_pool_cents: number;
  currency: string;
  start_at: string | null;
  end_at: string;
  networks: Platform[];
  status: string;
  min_followers?: number | null;
  min_views?: number | null;
  brand?: { display_name?: string | null; avatar_url?: string | null } | null;
  prizes?: { position: number; amount_cents: number | null; percentage: number | null }[] | null;
  contest_terms?: { version?: string | null; terms_url?: string | null } | null;
}

export default async function ContestDetailPage({ params }: { params: { id: string } }) {
  const { user } = await getSession();
  const supabase = await getSupabaseSSR();
  const { data: contestData, error } = await supabase
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
      start_at,
      end_at,
      networks,
      status,
      brand:brand_id (
        display_name,
        avatar_url
      ),
      prizes:contest_prizes (
        position,
        amount_cents,
        percentage
      ),
      contest_terms:contest_terms_id (
        version,
        terms_url
      )
    `
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('Contest fetch error', error);
  }

  const contest = contestData as ContestDetail | null;

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

  const isEnded = contest.status === 'ended' || contest.status === 'archived';
  const now = Date.now();
  const isUpcoming = contest.start_at ? new Date(contest.start_at).getTime() > now : false;
  const countdown = computeCountdown(contest.end_at);

  const { data: canSubmitRes, error: canSubmitErr } =
    user && contest.status === 'active'
      ? await supabase.rpc('can_submit_to_contest', { p_contest_id: contest.id, p_user_id: user.id })
      : { data: null, error: null };
  if (canSubmitErr) {
    console.error('Eligibility error', canSubmitErr);
  }
  const canSubmit = Boolean(canSubmitRes) && contest.status === 'active' && !isEnded && !isUpcoming;

  const steps = [
    { title: 'Cree ta video', description: `Publie sur ${contest.networks?.join(', ') || 'ton reseau'}` },
    { title: 'Ajoute les hashtags', description: '#ClipRace + hashtag de marque' },
    { title: 'Colle le lien', description: 'Soumets ta video dans ClipRace' },
    { title: 'Suis la moderation', description: 'Nous te notifions a chaque etape' },
  ];

  const [examples, leaderboard, recommended] = await Promise.all([
    fetchExamples(contest.id),
    fetchContestLeaderboard(contest.id),
    fetchRecommended(contest.id, 'active'),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {isEnded && (
        <Alert variant="default">
          <AlertTitle>Concours termin�</AlertTitle>
          <AlertDescription>
            Ce concours est cl�tur�. Tu peux encore consulter les exemples, le classement et d�couvrir d&apos;autres concours recommand�s ci-dessous.
          </AlertDescription>
        </Alert>
      )}
      {!isEnded && isUpcoming && (
        <Alert>
          <AlertTitle>Concours � venir</AlertTitle>
          <AlertDescription>
            Ce concours n&apos;est pas encore ouvert. Tu pourras participer d�s la date d&apos;ouverture indiqu�e dans la fiche concours.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Colonne principale */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            {contest.cover_url && (
              <div className="relative h-64 w-full bg-muted animate-pulse">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={contest.cover_url} alt={contest.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            )}
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={isEnded ? 'default' : isUpcoming ? 'secondary' : 'success'}>
                  {isEnded ? 'Cl�tur�' : isUpcoming ? '� venir' : 'Actif'}
                </Badge>
                <Badge variant="info" className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {formatCurrency(contest.prize_pool_cents, contest.currency || 'EUR')}
                </Badge>
                <Badge variant="default" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Fin le {formatDate(contest.end_at)}
                </Badge>
                {countdown && !isEnded && <Badge variant="outline">{countdown.label}</Badge>}
              </div>
              <CardTitle className="text-3xl">{contest.title}</CardTitle>
              {contest.brand?.display_name && (
                <p className="text-sm text-muted-foreground">Propos� par {contest.brand.display_name}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {contest.brief_md && <p className="text-muted-foreground">{contest.brief_md}</p>}
              <div className="flex flex-wrap gap-2">
                {contest.networks?.map((network: Platform) => (
                  <PlatformBadge key={network} platform={network} />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild disabled={!canSubmit} className="min-w-[180px]">
                  <TrackedLink
                    href={`/app/creator/contests/${contest.id}/participate`}
                    event="click_participate"
                    payload={{ contest_id: contest.id, eligible: canSubmit }}
                  >
                    {canSubmit ? 'Participer maintenant' : isEnded ? 'Concours termin�' : 'V�rification �ligibilit�...'}
                  </TrackedLink>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/app/creator/contests">Voir tous les concours</Link>
                </Button>
              </div>
              {!canSubmit && !isEnded && !isUpcoming && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span>�ligibilit� requise (plateformes, followers ou vues minimales).</span>
                </div>
              )}
            </CardContent>
          </Card>

          <SectionCard title="Barre de confiance">
            <div className="grid gap-3 md:grid-cols-3">
              <Badge variant="outline" className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Donn�es s�curis�es
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Fin {countdown?.short ?? '-'}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                R�seaux�: {contest.networks.join(', ')}
              </Badge>
            </div>
          </SectionCard>

          <SectionCard title="�ligibilit�">
            <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p>Plateformes autoris�es:</p>
                <div className="flex flex-wrap gap-2">
                  {contest.networks.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p>Seuils :</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Followers min: {contest.min_followers ? contest.min_followers.toLocaleString('fr-FR') : 'Non requis'}
                  </Badge>
                  <Badge variant="secondary">
                    Vues moy. min: {contest.min_views ? contest.min_views.toLocaleString('fr-FR') : 'Non requis'}
                  </Badge>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Comment ca marche">
            <div className="relative pl-4">
              <div className="absolute left-1 top-2 bottom-2 w-px bg-border" aria-hidden />
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div className="mt-1 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{step.title}</div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recompenses">
            {contest.prizes && contest.prizes.length > 0 ? (
              <div className="space-y-2">
                {contest.prizes
                  .sort((a, b) => a.position - b.position)
                  .map((p) => (
                    <div key={p.position} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        <span className="font-semibold">#{p.position}</span>
                      </div>
                      <span className="font-medium">
                        {p.amount_cents
                          ? formatCurrency(p.amount_cents, contest.currency || 'EUR')
                          : p.percentage
                            ? `${p.percentage}% du prize pool`
                            : '� d�finir'}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pas de r�partition d�taill�e. Le prize pool global de {formatCurrency(contest.prize_pool_cents, contest.currency || 'EUR')} sera
                distribue aux gagnants.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Conditions du concours">
            {contest.contest_terms?.terms_url ? (
              <Link href={contest.contest_terms.terms_url} className="text-sm text-primary hover:underline">
                Consulter les conditions (version {contest.contest_terms.version || 'N/A'})
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Conditions non renseign�es.</p>
            )}
          </SectionCard>

          <SectionCard title="Top vues 30j">
            {examples.length === 0 ? (
              <EmptyState
                title="Pas encore d'exemples"
                description="Les participations appara�tront ici d�s qu'elles seront approuv�es."
                action={{ label: 'Voir le leaderboard', href: `/app/creator/contests/${contest.id}/leaderboard`, variant: 'secondary' }}
              />
            ) : (
              <div className="grid md:grid-cols-3 gap-3">
                {examples.map((item) => (
                  <div
                    key={item.submission_id}
                    className="rounded-2xl border border-border p-4 bg-card shadow-card flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{item.creator_name || 'Cr�ateur'}</span>
                      <PlatformBadge platform={item.platform} className="text-[10px]" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vues : <span className="font-medium">{item.views?.toLocaleString('fr-FR') ?? '-'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Likes : <span className="font-medium">{item.likes?.toLocaleString('fr-FR') ?? '-'}</span>
                    </div>
                    <Button asChild variant="secondary" size="sm" className="w-full justify-center">
                      <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                        Voir la vid�o
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Pourquoi participer ?"
            description="Gagne, gagne en Visibilit� et simplifie ta participation."
          >
            <div className="grid md:grid-cols-3 gap-3">
              <Feature title="Gain" description="Prize pool garanti et classement clair." icon={<Trophy className="h-5 w-5" />} />
              <Feature title="Visibilit�" description="Expose ta vid�o aupr�s de la marque." icon={<PlayCircle className="h-5 w-5" />} />
              <Feature title="Validation simple" description="Soumission en quelques clics." icon={<CheckCircle2 className="h-5 w-5" />} />
            </div>
          </SectionCard>

          <LeaderboardTop contestId={contest.id} leaderboard={leaderboard} />

          {recommended.length > 0 && (
            <SectionCard title="Concours recommand�s">
              <div className="grid md:grid-cols-3 gap-3">
                {recommended.map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/creator/contests/${c.id}`}
                    className="rounded-xl border border-border p-3 hover:-translate-y-1 hover:shadow-card-hover transition block"
                  >
                    <div className="text-sm font-semibold text-foreground line-clamp-2">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Fin le {formatDate(c.end_at)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Prize pool {formatCurrency(c.prize_pool_cents, c.currency || 'EUR')}
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Colonne droite sticky */}
        <div className="space-y-4">
          <div className="sticky top-20">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Pret a participer ?</CardTitle>
                <p className="text-sm text-muted-foreground">Depose ta video et suis ta progression.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full" disabled={!canSubmit}>
                  <TrackedLink
                    href={`/app/creator/contests/${contest.id}/participate`}
                    event="click_participate"
                    payload={{ contest_id: contest.id, surface: 'sticky_cta', eligible: canSubmit }}
                  >
                    {canSubmit ? 'Participer maintenant' : isEnded ? 'Concours termin�' : 'V�rification �ligibilit�...'}
                  </TrackedLink>
                </Button>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/app/creator/submissions">Suivre mes soumissions</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

type ContestExample = {
  submission_id: string;
  external_url: string;
  platform: Platform;
  creator_name: string | null;
  views: number | null;
  likes: number | null;
};

type RecommendedContest = {
  id: string;
  title: string;
  end_at: string;
  prize_pool_cents: number;
  currency: string;
};

type MetricsRow = {
  submission_id: string;
  views: number | null;
  likes: number | null;
  submissions: {
    external_url: string;
    platform: Platform;
    creator?: { display_name?: string | null } | null;
  } | null;
};

async function fetchExamples(contestId: string): Promise<ContestExample[]> {
  const supabase = await getSupabaseSSR();
  const metricsQuery = supabase
    .from('metrics_daily')
    .select(
      `
      submission_id,
      views:sum(views),
      likes:sum(likes),
      submissions!inner (
        id,
        external_url,
        platform,
        creator:creator_id ( display_name )
      )
    `
    )
    .eq('submissions.contest_id', contestId)
    .eq('submissions.status', 'approved');

  type GroupCapableQuery = typeof metricsQuery & {
    group: (columns: string) => typeof metricsQuery;
  };

  const typedQuery = metricsQuery as GroupCapableQuery;

  const { data, error } = await typedQuery
    .group('submission_id, submissions(id, external_url, platform, creator(display_name))')
    .order('views', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Examples fetch error', error);
    return [];
  }

  const typedData = (data ?? []) as unknown as MetricsRow[];

  return typedData.map((row) => ({
    submission_id: row.submission_id,
    external_url: row.submissions?.external_url ?? '',
    platform: row.submissions?.platform ?? 'tiktok',
    creator_name: row.submissions?.creator?.display_name ?? null,
    views: row.views ?? null,
    likes: row.likes ?? null,
  }));
}

function LeaderboardTop({ contestId, leaderboard }: { contestId: string; leaderboard: LeaderboardEntry[] }) {
  const items = leaderboard;
  return (
    <SectionCard title="Leaderboard">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Leaderboard indisponible.</p>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div key={`${row.creator_id}-${row.rank}`} className="flex items-center gap-3 border border-border rounded-xl px-3 py-2">
              <Badge variant="default">#{row.rank}</Badge>
              <div className="flex-1">
                <div className="font-medium">{row.creator_name}</div>
                <div className="text-xs text-muted-foreground">Vues : {row.total_views ?? '-'}</div>
              </div>
              <Button asChild size="sm" variant="ghost">
                <TrackedLink
                  href={`/app/creator/contests/${contestId}/leaderboard`}
                  event="view_leaderboard"
                  payload={{ contest_id: contestId }}
                >
                  Voir tout
                </TrackedLink>
              </Button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

async function fetchRecommended(contestId: string, status: StatusFilter): Promise<RecommendedContest[]> {
  const supabase = await getSupabaseSSR();
  const now = new Date().toISOString();
  let query = supabase
    .from('contests')
    .select('id, title, end_at, prize_pool_cents, currency')
    .neq('id', contestId)
    .limit(3);

  if (status === 'active') {
    query = query.eq('status', 'active').gte('end_at', now);
  }

  const { data, error } = await query.order('end_at', { ascending: true });
  if (error) {
    console.error('Recommended contests error', error);
    return [];
  }
  return (data || []) as RecommendedContest[];
}

function computeCountdown(endAt: string) {
  const now = Date.now();
  const end = new Date(endAt).getTime();
  const diffMs = Math.max(0, end - now);
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return {
    label: diffMs === 0 ? 'Termine' : days > 0 ? `Se termine dans ${days}j` : `Dans ${hours}h`,
    short: diffMs === 0 ? 'Termine' : days > 0 ? `${days}j ${hours}h` : `${hours}h`,
  };
}
