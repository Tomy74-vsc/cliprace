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
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className="hidden sm:block shrink-0">
            <CampaignSwitcher campaigns={activeCampaigns} companyName={companyName} />
          </div>
          <div className="flex-1 min-w-0">
            <BrandBreadcrumbs />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <NotificationsDropdown />
          <Button asChild variant="ghost" size="sm" className="h-12 w-12 rounded-full">
            <Link href="/app/brand/settings">
              <User className="h-10 w-10" />
              <span className="sr-only">Profil</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
