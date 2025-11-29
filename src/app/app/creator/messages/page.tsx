import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { EmptyState } from '@/components/creator/empty-state';
import { TrackOnView } from '@/components/analytics/track-once';

export default async function CreatorMessagesDisabledPage() {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect('/auth/login');
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <TrackOnView event="view_messages_disabled" payload={{ user: user.id }} />
      <EmptyState
        title="Messagerie désactivée"
        description="Les conversations marque-créateur ne sont plus disponibles pour le moment."
        action={{ label: 'Découvrir les concours', href: '/app/creator/contests' }}
        secondaryAction={{ label: 'Mes soumissions', href: '/app/creator/submissions', variant: 'secondary' }}
      />
    </main>
  );
}
