import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession, getUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/creator/banner';
import { AdminImpersonationBanner } from '@/components/admin/admin-impersonation-banner';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { BrandShell } from '@/components/brand-ui/BrandShell';
import { BrandProviders } from '@/components/brand-ui/BrandProviders';
import { BrandRailNav } from '@/components/brand-ui/BrandRailNav';
import { BrandTopBar } from '@/components/brand-ui/BrandTopBar';
import { BrandPageTransition } from './brand-page-transition';

/**
 * Brand Layout — shell marque
 * - Auth guard (brand | admin)
 * - BrandShell (brand-scope + portal root)
 * - BrandProviders (Sonner / Tooltip / Lenis) wraps everything for context
 * - Rail nav (desktop) + Top bar (glass) + Mobile drawer
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

  const [{ data: profileBrand, error: profileError }, { data: contests }] = await Promise.all([
    supabase
      .from('profile_brands')
      .select('company_name')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('contests').select('id').eq('brand_id', user.id),
  ]);

  const profileIncomplete = profileError ? false : !profileBrand?.company_name;

  const contestIds = contests?.map((c) => c.id) || [];
  let pendingSubmissionsCount = 0;
  if (contestIds.length > 0) {
    const { count } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .in('contest_id', contestIds);
    pendingSubmissionsCount = count || 0;
  }

  return (
    <BrandShell bare className="relative overflow-hidden">
      {/* BrandProviders wraps everything — Sonner, TooltipProvider (needed by rail tooltips) */}
      <BrandProviders smoothScroll={false}>
        {/* ── Ambient glow (Race Light signature, < 10% emerald area) ── */}
        <div
          className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-emerald-500/[0.06] blur-[120px]"
          aria-hidden="true"
        />

        {/* ── Desktop Rail Nav (fixed left, hidden on mobile) ── */}
        <BrandRailNav />

        {/* ── Content column (offset for rail on desktop) ── */}
        <div className="lg:pl-16 min-h-screen flex flex-col">
          {/* ── Top Bar (glass, sticky) ── */}
          <BrandTopBar companyName={profileBrand?.company_name} />

          {/* ── Admin banner ── */}
          <AdminImpersonationBanner />

          {/* ── Contextual banners ── */}
          {profileIncomplete && (
            <div className="mx-auto max-w-7xl w-full px-4 lg:px-6 pb-4 pt-4">
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
            </div>
          )}

          {pendingSubmissionsCount > 0 && (
            <div className="mx-auto max-w-7xl w-full px-4 lg:px-6 pb-4">
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
            </div>
          )}

          {/* ── Page content ── */}
          <main className="flex-1">
            <BrandPageTransition>{children}</BrandPageTransition>
          </main>
        </div>
      </BrandProviders>
    </BrandShell>
  );
}
