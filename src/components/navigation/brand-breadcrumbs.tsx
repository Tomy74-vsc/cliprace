/* Breadcrumbs contextualisés pour l'espace marque — "Company > Campaign > Modération" */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  contests: 'Concours',
  submissions: 'Soumissions',
  leaderboard: 'Classement',
  billing: 'Factures',
  notifications: 'Notifications',
  settings: 'Paramètres',
  messages: 'Messages',
  faq: 'FAQ',
  new: 'Nouveau concours',
  moderate: 'Modération',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BrandBreadcrumbs() {
  const pathname = usePathname();
  const [contestTitleMap, setContestTitleMap] = useState<Record<string, string>>({});

  const parts = pathname.split('/').filter(Boolean).slice(2); // ['dashboard'] or ['contests', 'id', 'submissions'] etc.

  useEffect(() => {
    const contestIds = parts.filter((p) => UUID_REGEX.test(p));
    if (contestIds.length === 0) return;

    const fetchTitles = async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        contestIds.map(async (id) => {
          try {
            const res = await fetch(`/api/brand/contests/${id}/title`);
            if (res.ok) {
              const { title } = await res.json();
              map[id] = title;
            }
          } catch {
            map[id] = 'Concours';
          }
        })
      );
      setContestTitleMap((prev) => ({ ...prev, ...map }));
    };
    fetchTitles();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const items: { label: string; href: string }[] = [];
  let hrefSoFar = '/app/brand';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    hrefSoFar += `/${part}`;
    const label =
      UUID_REGEX.test(part) && contestTitleMap[part]
        ? contestTitleMap[part]
        : SEGMENT_LABELS[part] ?? formatSegment(part);
    items.push({ label, href: hrefSoFar });
  }

  if (items.length === 0) {
    return (
      <span className="text-sm font-medium text-muted-foreground">
        Tableau de bord
      </span>
    );
  }

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden"
    >
      <Link
        href="/app/brand/dashboard"
        className="hover:text-foreground transition-colors shrink-0"
      >
        Tableau de bord
      </Link>
      {items.map((item, i) => (
        <span
          key={item.href}
          className="flex items-center gap-1 min-w-0 shrink"
        >
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <Link
            href={item.href}
            className={cn(
              'hover:text-foreground transition-colors truncate max-w-[140px] sm:max-w-[200px]',
              i === items.length - 1 && 'font-medium text-foreground'
            )}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function formatSegment(value: string) {
  if (value.length <= 3) return value.toUpperCase();
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
