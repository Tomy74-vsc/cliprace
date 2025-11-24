/*
Source: Page onboarding
Purpose: Page onboarding avec formulaire multi-étapes
*/
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { User, Building2 } from 'lucide-react';

export default async function OnboardingPage() {
  const { user, error } = await getSession();

  if (error || !user) {
    redirect('/auth/login');
  }

  const admin = getSupabaseAdmin();

  // Récupérer les données existantes pour pré-remplir le formulaire
  let initialData: any = {};

  if (user.role === 'creator') {
    const { data: creator } = await admin
      .from('profile_creators')
      .select('handle, primary_platform, followers, avg_views')
      .eq('user_id', user.id)
      .single();

    if (creator) {
      initialData = {
        username: creator.handle || undefined,
        primary_platform: creator.primary_platform || undefined,
        followers: creator.followers || undefined,
        avg_views: creator.avg_views || undefined,
      };
    }

    const { data: platformAccounts } = await admin
      .from('platform_accounts')
      .select('platform, handle')
      .eq('user_id', user.id);

    if (platformAccounts?.length) {
      initialData.platform_links = platformAccounts.reduce(
        (acc: Record<string, string>, account) => {
          if (account?.platform && account.handle) {
            acc[account.platform] = account.handle;
          }
          return acc;
        },
        initialData.platform_links || {}
      );
    }
  } else if (user.role === 'brand') {
    const { data: brand } = await admin
      .from('profile_brands')
      .select('company_name, vat_number, address_line1, address_line2, address_city, address_postal_code, address_country')
      .eq('user_id', user.id)
      .single();

    if (brand) {
      initialData = {
        company_name: brand.company_name || undefined,
        vat_number: brand.vat_number || undefined,
        address_line1: brand.address_line1 || undefined,
        address_line2: brand.address_line2 || undefined,
        address_city: brand.address_city || undefined,
        address_postal_code: brand.address_postal_code || undefined,
        address_country: brand.address_country || undefined,
      };
    }
  }

  // Récupérer bio depuis profiles
  const { data: profile } = await admin
    .from('profiles')
    .select('bio, onboarding_complete')
    .eq('id', user.id)
    .single();

  if (profile?.bio) {
    initialData.bio = profile.bio;
  }

  const onboardingComplete = !!profile?.onboarding_complete;

  // Si onboarding déjà complet, rediriger vers dashboard
  if (onboardingComplete) {
    if (user.role === 'creator') {
      redirect('/app/creator/dashboard');
    } else if (user.role === 'brand') {
      redirect('/app/brand/dashboard');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          {user.role === 'creator' ? (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="display-2 bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
              Finalisez votre profil
            </h1>
            <p className="text-muted-foreground mt-1">
              {user.role === 'creator'
                ? 'Complétez votre profil créateur pour commencer à participer aux concours'
                : 'Complétez votre profil marque pour lancer vos premiers concours'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {user.role === 'creator' ? (
                <>
                  <User className="w-5 h-5 text-[#635BFF]" />
                  Onboarding Créateur
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 text-[#635BFF]" />
                  Onboarding Marque
                </>
              )}
            </CardTitle>
            <CardDescription>
              {user.role === 'creator'
                ? 'Remplissez les informations suivantes pour compléter votre profil'
                : 'Remplissez les informations suivantes pour compléter votre profil entreprise'}
            </CardDescription>
          </CardHeader>
          <OnboardingForm role={user.role} initialData={initialData} />
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800">
            {/* Footer space */}
          </div>
        </Card>
      </div>
    </main>
  );
}

