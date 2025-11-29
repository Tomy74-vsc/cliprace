import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { User } from 'lucide-react';

import { getSession, getUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { CreatorNav, type CreatorNavItem } from './layout_nav';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Banner } from '@/components/creator/banner';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { NotificationsDropdown } from '@/components/notifications/notifications-dropdown';
import { CreatorBreadcrumbs } from '@/components/navigation/creator-breadcrumbs';
import { Badge } from '@/components/ui/badge';

/**
 * Shell créateur
 * - Garde d'accès rôle = creator (ou admin)
 * - Onboarding appliqué globalement via middleware.ts sur /app/*
 * - Layout : sidebar desktop, topbar, bottom nav mobile
 */
export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect('/auth/login');
  }

  const role = await getUserRole(user.id);
  if (role !== 'creator' && role !== 'admin') {
    redirect('/forbidden');
  }

  const supabase = await getSupabaseSSR();
  const { data: profileCreator, error: profileError } = await supabase
    .from('profile_creators')
    .select('primary_platform')
    .eq('user_id', user.id)
    .maybeSingle();

  const profileIncomplete = profileError ? false : !profileCreator?.primary_platform;

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false);

  const { data: winnings } = await supabase
    .from('contest_winnings')
    .select('payout_cents, paid_at')
    .eq('creator_id', user.id);

  const { data: cashouts } = await supabase
    .from('cashouts')
    .select('amount_cents, status')
    .eq('creator_id', user.id);

  const unpaidWinnings = (winnings || []).filter((w) => !w.paid_at).reduce((sum, w) => sum + w.payout_cents, 0);
  const activeCashouts =
    (cashouts || [])
      .filter((c) => ['requested', 'processing'].includes(c.status))
      .reduce((sum, c) => sum + c.amount_cents, 0) || 0;
  const availableBalanceCents = Math.max(0, unpaidWinnings - activeCashouts);

  const nav: CreatorNavItem[] = [
    { label: 'Tableau de bord', href: '/app/creator/dashboard', icon: 'home' },
    { label: 'Concours', href: '/app/creator/contests', icon: 'trophy' },
    { label: 'Soumissions', href: '/app/creator/submissions', icon: 'video' },
    {
      label: 'Gains',
      href: '/app/creator/wallet',
      icon: 'wallet',
      badgeCount: availableBalanceCents > 0 ? 1 : 0,
      tooltip: availableBalanceCents > 0 ? 'Solde disponible' : 'Suivre mes gains',
    },
    {
      label: 'Notifications',
      href: '/app/creator/notifications',
      icon: 'bell',
      badgeCount: unreadCount || 0,
      tooltip: 'Notifications',
    },
    { label: 'Profil', href: '/app/creator/settings', icon: 'user' },
  ];

  const statusSegments = [
    {
      label: 'Actif',
      hint: 'Prêt à participer',
      active: !profileIncomplete && (unreadCount || 0) === 0,
    },
    {
      label: 'À faire',
      hint: profileIncomplete ? 'Compléter le profil' : 'Consulter les alertes',
      active: profileIncomplete,
    },
    {
      label: 'Alertes',
      hint: unreadCount ? `${unreadCount} notif(s)` : 'RAS',
      active: (unreadCount || 0) > 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl px-4 py-6">
          <Link href="/app/creator/dashboard" className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card transition-transform duration-200 hover:-translate-y-0.5" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ClipRace
            </span>
          </Link>
          <div className="mt-6 flex-1 space-y-1">
            <CreatorNav nav={nav} />
          </div>
          <div className="mt-auto text-xs text-muted-foreground px-2 space-y-2">
            <Link href="/app/creator/faq" className="hover:text-primary transition-colors">
              Support / FAQ
            </Link>
            <p className="text-muted-foreground/70">v1.0 créateur</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="flex h-14 items-center justify-between px-4 lg:px-8">
              <div className="flex items-center gap-3 overflow-hidden">
                <CreatorBreadcrumbs />
                <div className="hidden">
                  {statusSegments.map((segment) => {
                    const variant =
                      segment.label === 'Actif'
                        ? segment.active
                          ? 'success'
                          : 'secondary'
                        : segment.label === 'À faire'
                          ? segment.active
                            ? 'warning'
                            : 'secondary'
                          : segment.active
                            ? 'danger'
                            : 'secondary';
                    return (
                      <Badge key={segment.label} variant={variant} className="text-xs rounded-full">
                        {segment.label}
                        {segment.hint ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">{segment.hint}</span>
                        ) : null}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <NotificationsDropdown />
                <Button asChild variant="ghost" size="sm" className="h-12 w-12 rounded-full">
                  <Link href="/app/creator/settings">
                    <User className="h-10 w-10" />
                    <span className="sr-only">Profil</span>
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-4">
            {profileIncomplete && (
              <Banner
                variant="warning"
                title="Complète ton profil créateur"
                description="Ajoute ta plateforme principale pour débloquer toutes les fonctionnalités."
                action={
                  <Button asChild size="sm" variant="primary" className="animate-pulse">
                    <Link href="/app/creator/settings">Compléter</Link>
                  </Button>
                }
              />
            )}
            {children}
          </main>

          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl">
            <CreatorNav nav={nav} variant="bottom" />
          </nav>
        </div>
      </div>
    </div>
  );
}
