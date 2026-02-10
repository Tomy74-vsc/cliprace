'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayoutDashboard, Trophy } from 'lucide-react';

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

  // Extract contest id from path: /app/brand/contests/[id]/...
  const contestSegment = pathname.split('/').find((_, i, arr) => arr[i - 1] === 'contests' && _ !== 'contests' && !['new', 'submissions', 'leaderboard'].includes(_));
  const currentContestId = contestSegment && /^[0-9a-f-]{36}$/i.test(contestSegment) ? contestSegment : null;

  const handleValueChange = (value: string) => {
    if (value === '__dashboard__') {
      router.push('/app/brand/dashboard');
      return;
    }
    router.push(`/app/brand/contests/${value}`);
  };

  const displayValue =
    currentContestId && campaigns.some((c) => c.id === currentContestId)
      ? currentContestId
      : '__dashboard__';

  if (campaigns.length === 0) {
    return (
      <Select value="__dashboard__" onValueChange={handleValueChange}>
        <SelectTrigger className="w-[220px] h-9 border-border/80 bg-muted/30 font-medium">
          <LayoutDashboard className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <SelectValue placeholder="Tableau de bord" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__dashboard__">
            <span className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={displayValue} onValueChange={handleValueChange}>
      <SelectTrigger className="w-[240px] h-9 border-border/80 bg-muted/30 font-medium">
        {currentContestId ? (
          <Trophy className="h-4 w-4 text-primary mr-2 shrink-0" />
        ) : (
          <LayoutDashboard className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
        )}
        <SelectValue placeholder={companyName ? `${companyName} — Campagnes` : 'Choisir une campagne'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__dashboard__">
          <span className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Tableau de bord
          </span>
        </SelectItem>
        {campaigns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2 truncate max-w-[200px]">
              <Trophy className="h-4 w-4 shrink-0 text-primary/80" />
              {c.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
