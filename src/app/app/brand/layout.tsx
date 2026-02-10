import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession, getUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BrandNav, type BrandNavItem } from './layout_nav';
import { Banner } from '@/components/creator/banner';
import { AdminImpersonationBanner } from '@/components/admin/admin-impersonation-banner';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { BrandHeader } from './brand-header';
import { BrandPageTransition } from './brand-page-transition';

/**
 * Shell marque
 * - Garde d'accès rôle = brand (ou admin)
 * - Onboarding appliqué globalement via middleware.ts sur /app/*
 * - Layout : sidebar desktop, topbar, bottom nav mobile
*/
export default async function BrandLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect('/auth/login');
  }

  const role = await getUserRole(user.id);
  if (role !== 'brand' && role !== 'admin') {
    redirect('/forbidden');
  }

  const supabase = await getSupabaseSSR();
  
  // Vérifier le profil brand
  const { data: profileBrand, error: profileError } = await supabase
    .from('profile_brands')
    .select('company_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const profileIncomplete = profileError ? false : !profileBrand?.company_name;

  // Compter les notifications non lues
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  // Récupérer les concours de la marque (actifs pour le switcher + tous pour les comptes)
  const { data: contests } = await supabase
    .from('contests')
    .select('id, title, status')
    .eq('brand_id', user.id);

  const contestIds = contests?.map((c) => c.id) || [];
  const activeCampaigns = (contests ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => ({ id: c.id, title: c.title ?? 'Sans titre' }));
  const companyName = profileBrand?.company_name ?? null;

  // Compter les soumissions en attente de modération
  let pendingSubmissionsCount = 0;
  if (contestIds.length > 0) {
    const { count } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .in('contest_id', contestIds);
    pendingSubmissionsCount = count || 0;
  }

  // Compter les paiements en attente
  const { count: pendingPaymentsCount } = await supabase
    .from('payments_brand')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', user.id)
    .in('status', ['requires_payment', 'processing']);

  const nav: BrandNavItem[] = [
    { label: 'Tableau de bord', href: '/app/brand/dashboard', icon: 'home' },
    { label: 'Concours', href: '/app/brand/contests', icon: 'trophy' },
    {
      label: 'Messages',
      href: '/app/brand/messages',
      icon: 'message',
      badgeCount: 0, // TODO: compter les messages non lus
      tooltip: 'Messages avec les créateurs',
    },
    {
      label: 'Factures',
      href: '/app/brand/billing',
      icon: 'creditcard',
      badgeCount: pendingPaymentsCount || 0,
      tooltip: pendingPaymentsCount ? 'Paiements en attente' : 'Gérer les factures',
    },
    {
      label: 'Notifications',
      href: '/app/brand/notifications',
      icon: 'bell',
      badgeCount: unreadCount || 0,
      tooltip: 'Notifications',
    },
    { label: 'Paramètres', href: '/app/brand/settings', icon: 'user' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl px-4 py-6">
          <Link href="/app/brand/dashboard" className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card transition-transform duration-200 hover:-translate-y-0.5" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ClipRace
            </span>
          </Link>
          <div className="mt-6 flex-1 space-y-1">
            <BrandNav nav={nav} />
          </div>
          <div className="mt-auto text-xs text-muted-foreground px-2 space-y-2">
            <Link href="/app/brand/faq" className="hover:text-primary transition-colors">
              Support / FAQ
            </Link>
            <p className="text-muted-foreground/70">v1.0 marque</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <AdminImpersonationBanner />
          <BrandHeader activeCampaigns={activeCampaigns} companyName={companyName} />

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-4">
            {profileIncomplete && (
              <Banner
                variant="warning"
                title="Complète ton profil marque"
                description="Ajoute les informations de ton entreprise pour débloquer toutes les fonctionnalités."
                action={
                  <Button asChild size="sm" variant="primary" className="animate-pulse">
                    <Link href="/app/brand/settings">Compléter</Link>
                  </Button>
                }
              />
            )}
            {pendingSubmissionsCount > 0 && (
              <Banner
                variant="info"
                title={`${pendingSubmissionsCount} soumission${pendingSubmissionsCount > 1 ? 's' : ''} en attente de modération`}
                description="Des créateurs attendent ta validation pour leurs participations."
                action={
                  <Button asChild size="sm" variant="primary">
                    <Link href="/app/brand/contests">Modérer</Link>
                  </Button>
                }
              />
            )}
            <BrandPageTransition>{children}</BrandPageTransition>
          </main>

          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
            <BrandNav nav={nav} variant="bottom" />
          </nav>
        </div>
      </div>
    </div>
  );
}
