'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationsDropdown } from '@/components/notifications/notifications-dropdown';
import { BrandBreadcrumbs } from '@/components/navigation/brand-breadcrumbs';
import { CampaignSwitcher, type CampaignOption } from '@/components/brand/campaign-switcher';

export function BrandHeader({
  activeCampaigns,
  companyName,
}: {
  activeCampaigns: CampaignOption[];
  companyName: string | null;
}) {
  return (
    <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-3xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="hidden shrink-0 sm:block">
            <CampaignSwitcher campaigns={activeCampaigns} companyName={companyName} />
          </div>
          <div className="hidden items-center gap-2 rounded-2xl bg-white/35 px-2.5 py-1.5 backdrop-blur-2xl dark:bg-zinc-900/35 xl:flex">
            <span className="text-xs text-muted-foreground">Recherche globale</span>
            <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              Ctrl+K
            </kbd>
          </div>
          <div className="min-w-0 flex-1">
            <BrandBreadcrumbs />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <NotificationsDropdown />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-10 w-10 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-2xl dark:border-white/5 dark:bg-zinc-900/40"
          >
            <Link href="/app/brand/settings">
              <User className="h-4 w-4" />
              <span className="sr-only">Profil</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
