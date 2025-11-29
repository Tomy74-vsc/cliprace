import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { SubmissionForm } from '@/components/submission/submission-form';
import type { Platform } from '@/lib/validators/platforms';
import { EmptyState } from '@/components/creator/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ParticipatePage({ params }: { params: { id: string } }) {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const supabase = getSupabaseSSR();
  const { data: contest, error } = await supabase
    .from('contests')
    .select('id, title, networks, status')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('Contest fetch error', error);
  }

  if (!contest) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          title="Concours introuvable"
          description="Ce concours n'existe plus ou n'est pas accessible."
          action={{ label: 'Retour aux concours', href: '/app/creator/contests', variant: 'secondary' }}
        />
      </main>
    );
  }

  const allowedPlatforms = (contest.networks as Platform[]) || ['tiktok', 'instagram', 'youtube'];
  const isEnded = contest.status === 'ended' || contest.status === 'archived';

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Participer au concours</CardTitle>
          <p className="text-sm text-muted-foreground">{contest.title}</p>
        </CardHeader>
        <CardContent>
          {isEnded ? (
            <EmptyState
              title="Concours termin├®"
              description="Ce concours est cl├┤tur├®. D├®couvre d'autres opportunit├®s."
              action={{ label: 'Voir les concours', href: '/app/creator/contests', variant: 'secondary' }}
            />
          ) : (
            <SubmissionForm contestId={contest.id} allowedPlatforms={allowedPlatforms} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
