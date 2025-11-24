import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { CreatorSettingsForm } from '@/components/settings/creator-settings-form';

export default async function CreatorSettingsPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const supabase = getSupabaseSSR();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('id', user.id)
    .single();

  const { data: creatorDetails } = await supabase
    .from('profile_creators')
    .select('first_name, last_name, handle, primary_platform, followers, avg_views')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: notificationPrefs } = await supabase
    .from('notification_preferences')
    .select('event, channel, enabled')
    .eq('user_id', user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="display-3 mb-2">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil créateur, vos préférences de notification et la sécurité de votre compte.
        </p>
      </div>
      <CreatorSettingsForm
        initialProfile={{
          display_name: profile?.display_name || '',
          bio: profile?.bio || '',
          avatar_url: profile?.avatar_url || '',
        }}
        initialCreator={{
          first_name: creatorDetails?.first_name || '',
          last_name: creatorDetails?.last_name || '',
          handle: creatorDetails?.handle || '',
          primary_platform: (creatorDetails?.primary_platform as 'tiktok' | 'instagram' | 'youtube') || 'tiktok',
          followers: creatorDetails?.followers ?? 0,
          avg_views: creatorDetails?.avg_views ?? 0,
        }}
        notificationPreferences={notificationPrefs || []}
      />
    </main>
  );
}
