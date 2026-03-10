'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronsUpDown, LayoutDashboard, Trophy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type CampaignOption = { id: string; title: string };

export function CampaignSwitcher({
  campaigns,
  companyName,
}: {
  campaigns: CampaignOption[];
  companyName?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const contestSegment = pathname
    .split('/')
    .find((segment, i, segments) => segments[i - 1] === 'contests' && !['contests', 'new', 'submissions', 'leaderboard'].includes(segment));
  const currentContestId = contestSegment && /^[0-9a-f-]{36}$/i.test(contestSegment) ? contestSegment : null;

  const displayValue =
    currentContestId && campaigns.some((campaign) => campaign.id === currentContestId)
      ? currentContestId
      : '__dashboard__';

  function handleValueChange(value: string) {
    if (value === '__dashboard__') {
      router.push('/app/brand/dashboard');
      return;
    }
    router.push(`/app/brand/contests/${value}`);
  }

  return (
    <Select value={displayValue} onValueChange={handleValueChange}>
      <SelectTrigger className="h-10 w-[290px] rounded-2xl border border-black/5 bg-white/40 px-3 backdrop-blur-2xl [&>svg]:hidden dark:border-white/5 dark:bg-zinc-900/40">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
              {currentContestId ? <Trophy className="h-3.5 w-3.5" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
            </span>
            <SelectValue placeholder={companyName ? `${companyName} — Campagnes` : 'Choisir une campagne'} />
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__dashboard__">
          <span className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Tableau de bord
          </span>
        </SelectItem>
        {campaigns.map((campaign) => (
          <SelectItem key={campaign.id} value={campaign.id}>
            <span className="flex max-w-[220px] items-center gap-2 truncate">
              <Trophy className="h-4 w-4 shrink-0 text-primary/80" />
              {campaign.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
