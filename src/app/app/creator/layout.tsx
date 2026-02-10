import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { User } from "lucide-react";

import { getSession, getUserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CreatorNav, type CreatorNavItem } from "./layout_nav";
import { CreatorBottomNav } from "./creator-bottom-nav";
import { CreatorPageTransition } from "./creator-page-transition";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Banner } from "@/components/creator/banner";
import { AdminImpersonationBanner } from "@/components/admin/admin-impersonation-banner";
import { getSupabaseSSR } from "@/lib/supabase/ssr";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { CreatorBreadcrumbs } from "@/components/navigation/creator-breadcrumbs";

/**
 * Shell créateur
 * - Garde d'accès rôle = creator (ou admin)
 * - Onboarding appliqué globalement via middleware.ts sur /app/*
 * - Layout : sidebar desktop, topbar, bottom nav mobile
 */
export default async function CreatorLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect("/auth/login");
  }

  const role = await getUserRole(user.id);
  if (role !== "creator" && role !== "admin") {
    redirect("/forbidden");
  }

  const supabase = await getSupabaseSSR();
  const { data: profileCreator, error: profileError } = await supabase
    .from("profile_creators")
    .select("primary_platform")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileIncomplete = profileError ? false : !profileCreator?.primary_platform;

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  const { data: winnings } = await supabase
    .from("contest_winnings")
    .select("payout_cents, paid_at")
    .eq("creator_id", user.id);

  const { data: cashouts } = await supabase
    .from("cashouts")
    .select("amount_cents, status")
    .eq("creator_id", user.id);

  const unpaidWinnings = (winnings || [])
    .filter((w) => !w.paid_at)
    .reduce((sum, w) => sum + w.payout_cents, 0);

  const activeCashouts =
    (cashouts || [])
      .filter((c) => ["requested", "processing"].includes(c.status))
      .reduce((sum, c) => sum + c.amount_cents, 0) || 0;

  const availableBalanceCents = Math.max(0, unpaidWinnings - activeCashouts);

  const nav: CreatorNavItem[] = [
    { label: "Tableau de bord", href: "/app/creator/dashboard", icon: "home" },
    { label: "Concours", href: "/app/creator/contests", icon: "trophy" },
    { label: "Soumissions", href: "/app/creator/submissions", icon: "video" },
    {
      label: "Gains",
      href: "/app/creator/wallet",
      icon: "wallet",
      badgeCount: availableBalanceCents > 0 ? 1 : 0,
      tooltip: availableBalanceCents > 0 ? "Solde disponible" : "Suivre mes gains",
    },
    {
      label: "Notifications",
      href: "/app/creator/notifications",
      icon: "bell",
      badgeCount: unreadCount || 0,
      tooltip: "Notifications",
    },
    { label: "Profil", href: "/app/creator/settings", icon: "user" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-56 flex-col border-r border-border/50 bg-transparent px-3 py-5">
          <Link href="/app/creator/dashboard" className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-muted/30 transition-colors duration-200">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent shadow-card transition-transform duration-200 hover:-translate-y-0.5" />
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ClipRace
            </span>
          </Link>
          <div className="mt-8 flex-1 min-h-0">
            <CreatorNav nav={nav} />
          </div>
          <div className="mt-auto pt-4 border-t border-border/40 space-y-2 px-2">
            <Link href="/app/creator/faq" className="block text-xs text-muted-foreground hover:text-primary transition-colors py-1 rounded-lg">
              Support / FAQ
            </Link>
            <p className="text-[11px] text-muted-foreground/70">v1.0 créateur</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <AdminImpersonationBanner />
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
            <div className="flex h-14 items-center justify-between px-4 lg:px-8">
              <div className="flex items-center gap-3 overflow-hidden">
                <CreatorBreadcrumbs />
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

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6 space-y-4 min-h-0">
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
            <CreatorPageTransition>{children}</CreatorPageTransition>
          </main>

          <CreatorBottomNav nav={nav} />
        </div>
      </div>
    </div>
  );
}
