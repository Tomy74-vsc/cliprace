import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bell, Home, Trophy, User, Video, Wallet2 } from 'lucide-react';

import { getSession, getUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { CreatorNav } from './layout_nav';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Banner } from '@/components/creator/banner';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { NotificationsDropdown } from '@/components/notifications/notifications-dropdown';

/*
Shell créateur :
- Guard role = creator (ou admin)
- Onboarding : redirect si incomplet
- Layout : sidebar desktop, topbar, bottom nav mobile
*/
export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) redirect('/auth/login');

  const role = await getUserRole(user.id);
  if (role !== 'creator' && role !== 'admin') redirect('/forbidden');
  if (role === 'creator' && !user.onboarding_complete) {
    redirect('/app/onboarding');
  }

  const supabase = getSupabaseSSR();
  const { data: profileCreator } = await supabase
    .from('profiles_creator')
    .select('primary_network')
    .eq('id', user.id)
    .single();
  const profileIncomplete = !profileCreator?.primary_network;

  const nav = [
    { label: 'Accueil', href: '/app/creator/dashboard', icon: Home },
    { label: 'Concours', href: '/app/creator/discover', icon: Trophy },
    { label: 'Participations', href: '/app/creator/submissions', icon: Video },
    { label: 'Gains', href: '/app/creator/wallet', icon: Wallet2 },
    { label: 'Profil', href: '/app/creator/settings', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl px-4 py-6">
          <Link href="/app/creator/dashboard" className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card" />
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
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                  Espace Créateur
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <NotificationsDropdown />
                <Button asChild variant="ghost" size="sm" className="h-10 rounded-full">
                  <Link href="/app/creator/settings">
                    <User className="h-5 w-5" />
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
                description="Ajoute ton réseau principal pour débloquer toutes les fonctionnalités."
                action={
                  <Button asChild size="sm" variant="primary">
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
