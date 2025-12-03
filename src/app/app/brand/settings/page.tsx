import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { BrandSettingsForm } from '@/components/settings/brand-settings-form';
import { TrackOnView } from '@/components/analytics/track-once';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default async function BrandSettingsPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  const supabase = await getSupabaseSSR();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url')
    .eq('id', user.id)
    .single();

  const { data: brandDetails, error: brandError } = await supabase
    .from('profile_brands')
    .select('company_name, website, industry, vat_number, address_line1, address_line2, address_city, address_postal_code, address_country')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: notificationPrefs, error: notificationError } = await supabase
    .from('notification_preferences')
    .select('event, channel, enabled')
    .eq('user_id', user.id);

  if (profileError) console.error('Profile fetch error', profileError);
  if (brandError) console.error('Brand details error', brandError);
  if (notificationError) console.error('Notification prefs error', notificationError);

  const completion = computeCompletion({ profile, brand: brandDetails });
  const profileIncomplete = completion.percent < 80;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <TrackOnView
        event="view_brand_settings"
        payload={{
          has_profile: Boolean(profile),
          has_brand_details: Boolean(brandDetails),
        }}
      />

      <div>
        <h1 className="display-3 mb-2">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil marque, vos préférences de notification et la sécurité de votre compte.
        </p>
      </div>

      {profileIncomplete && (
        <Alert>
          <AlertTitle>Profil incomplet</AlertTitle>
          <AlertDescription>
            Un profil incomplet peut limiter certaines fonctionnalités. Complétez les champs ci-dessous pour
            débloquer toutes les fonctionnalités et améliorer votre expérience.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Résumé profil</CardTitle>
            <CardDescription>Taux de complétion et aperçu public.</CardDescription>
          </div>
          <Badge variant={completion.percent >= 80 ? 'success' : 'secondary'}>
            {completion.percent}% complété
          </Badge>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || 'Marque'} />
            <AvatarFallback>{(profile?.display_name || 'MA').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-foreground">{profile?.display_name || 'Nom non renseigné'}</div>
            <div className="text-muted-foreground">
              {brandDetails?.company_name || 'Entreprise ?'} ·{' '}
              {brandDetails?.industry || 'Secteur non renseigné'} ·{' '}
              {brandDetails?.address_city || 'Localisation ?'}
            </div>
          </div>
        </CardContent>
      </Card>

      <BrandSettingsForm
        initialProfile={{
          display_name: profile?.display_name || '',
          bio: profile?.bio || '',
          avatar_url: profile?.avatar_url || '',
        }}
        initialBrand={{
          company_name: brandDetails?.company_name || '',
          website: brandDetails?.website || null,
          industry: brandDetails?.industry || null,
          vat_number: brandDetails?.vat_number || null,
          address_line1: brandDetails?.address_line1 || null,
          address_line2: brandDetails?.address_line2 || null,
          address_city: brandDetails?.address_city || null,
          address_postal_code: brandDetails?.address_postal_code || null,
          address_country: brandDetails?.address_country || 'FR',
        }}
        notificationPreferences={notificationPrefs || []}
      />
    </main>
  );
}

function computeCompletion({
  profile,
  brand,
}: {
  profile?: { display_name?: string | null; bio?: string | null; avatar_url?: string | null } | null;
  brand?: {
    company_name?: string | null;
    website?: string | null;
    industry?: string | null;
    vat_number?: string | null;
    address_line1?: string | null;
    address_city?: string | null;
    address_country?: string | null;
  } | null;
}) {
  const fields = [
    Boolean(profile?.display_name),
    Boolean(profile?.bio),
    Boolean(profile?.avatar_url),
    Boolean(brand?.company_name),
    Boolean(brand?.website),
    Boolean(brand?.industry),
    Boolean(brand?.address_line1),
    Boolean(brand?.address_city),
    Boolean(brand?.address_country),
  ];
  const completed = fields.filter(Boolean).length;
  const percent = Math.round((completed / fields.length) * 100);
  return { completed, total: fields.length, percent };
}

