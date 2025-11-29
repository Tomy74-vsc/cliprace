import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, Info, Shield } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { SubmissionForm } from '@/components/submission/submission-form';
import type { Platform } from '@/lib/validators/platforms';
import { EmptyState } from '@/components/creator/empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { TrackOnView } from '@/components/analytics/track-once';
import { formatCurrency } from '@/lib/formatters';

interface ContestRow {
  id: string;
  title: string;
  networks: Platform[] | null;
  status: string;
  end_at: string | null;
  prize_pool_cents: number | null;
  currency: string | null;
  contest_terms_id?: string | null;
  min_followers?: number | null;
  min_views?: number | null;
}

export default async function ParticipatePage({ params }: { params: { id: string } }) {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const supabase = await getSupabaseSSR();
  const { data: contest, error } = await supabase
    .from('contests')
    .select(
      'id, title, networks, status, end_at, prize_pool_cents, currency, contest_terms_id, min_followers, min_views',
    )
    .eq('id', params.id)
    .maybeSingle<ContestRow>();

  if (error) {
    console.error('Contest fetch error', error instanceof Error ? error.message : error);
  }

  if (!contest) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          title="Concours introuvable"
          description="Ce concours n'existe plus ou n'est pas accessible."
          action={{
            label: 'Retour aux concours',
            href: '/app/creator/contests',
            variant: 'secondary',
          }}
        />
      </main>
    );
  }

  const allowedPlatforms: Platform[] =
    Array.isArray(contest.networks) && contest.networks.length
      ? (contest.networks as Platform[])
      : (['tiktok', 'instagram', 'youtube'] as Platform[]);

  const isEnded = contest.status === 'ended' || contest.status === 'archived';

  const { data: isActiveRes } = await supabase.rpc('is_contest_active', {
    p_contest_id: contest.id,
  });
  const { data: canSubmitRes, error: canSubmitErr } = await supabase.rpc(
    'can_submit_to_contest',
    {
      p_contest_id: contest.id,
      p_user_id: user.id,
    },
  );

  if (canSubmitErr) {
    console.error('Eligibility check error', canSubmitErr instanceof Error ? canSubmitErr.message : canSubmitErr);
  }

  const canSubmit = Boolean(isActiveRes) && Boolean(canSubmitRes) && !isEnded;

  const eligibilityReasons: string[] = [];
  if (!isActiveRes) eligibilityReasons.push('Concours inactif ou clôturé.');
  if (contest.min_followers && contest.min_followers > 0) {
    eligibilityReasons.push(
      `Followers requis : ${contest.min_followers.toLocaleString('fr-FR')}`,
    );
  }
  if (contest.min_views && contest.min_views > 0) {
    eligibilityReasons.push(
      `Vues moyennes requises : ${contest.min_views.toLocaleString('fr-FR')}`,
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <TrackOnView
        event="view_participate"
        payload={{
          contest_id: contest.id,
          is_ended: isEnded,
          networks: contest.networks,
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Participer au concours</CardTitle>
                <CardDescription className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span>{contest.title}</span>
                  {!isEnded && (
                    <span>
                      Fin le{' '}
                      {contest.end_at
                        ? new Date(contest.end_at).toLocaleDateString('fr-FR')
                        : '-'}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={isEnded ? 'default' : 'success'}>
                  {isEnded ? 'Clôturé' : 'Actif'}
                </Badge>
                {contest.prize_pool_cents ? (
                  <Badge variant="info">
                    {formatCurrency(
                      contest.prize_pool_cents,
                      contest.currency || 'EUR',
                    )}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEnded ? (
              <EmptyState
                title="Concours terminé"
                description="Ce concours est clôturé. Découvre d'autres opportunités."
                action={{
                  label: 'Voir les concours',
                  href: '/app/creator/contests',
                  variant: 'secondary',
                }}
              />
            ) : !canSubmit ? (
              <EmptyState
                title="Non éligible pour le moment"
                description="Vérifie les conditions ci-dessous."
                action={{
                  label: 'Retour aux concours',
                  href: '/app/creator/contests',
                  variant: 'secondary',
                }}
                secondaryAction={{
                  label: 'Compléter mon profil',
                  href: '/app/creator/settings',
                  variant: 'ghost',
                }}
              >
                {eligibilityReasons.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {eligibilityReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </EmptyState>
            ) : (
              <>
                <StepList />
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Formats acceptés : TikTok / Instagram Reels / YouTube Shorts (lien public).
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    1 soumission max par concours (doublons refusés).
                  </div>
                </div>
                <SubmissionForm contestId={contest.id} allowedPlatforms={allowedPlatforms} />
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rappel concours</CardTitle>
              <p className="text-sm text-muted-foreground">Deadline, plateformes, seuils.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Fin le{' '}
                {contest.end_at
                  ? new Date(contest.end_at).toLocaleDateString('fr-FR')
                  : '-'}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {allowedPlatforms.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  Followers min. :{' '}
                  {contest.min_followers
                    ? contest.min_followers.toLocaleString('fr-FR')
                    : 'Non requis'}
                </Badge>
                <Badge variant="secondary">
                  Vues moy. min. :{' '}
                  {contest.min_views
                    ? contest.min_views.toLocaleString('fr-FR')
                    : 'Non requis'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                1 soumission max par concours
              </div>
            </CardContent>
          </Card>
          {contest.status !== 'active' && (
            <Card className="border-warning/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Concours non actif
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  La participation sera désactivée si le concours n&apos;est pas actif.
                </p>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function StepList() {
  const steps = [
    'Vérifier mon éligibilité',
    'Coller le lien vidéo',
    'Confirmer et envoyer',
  ];
  return (
    <div className="space-y-3">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-start gap-2">
          <Badge
            variant="outline"
            className="h-7 w-7 flex items-center justify-center rounded-full"
          >
            {idx + 1}
          </Badge>
          <div className="text-sm text-foreground">{step}</div>
        </div>
      ))}
    </div>
  );
}
