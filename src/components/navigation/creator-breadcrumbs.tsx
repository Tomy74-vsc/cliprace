/* Breadcrumbs contextualisés pour l'espace créateur */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  contests: 'Concours',
  submissions: 'Soumissions',
  wallet: 'Gains',
  notifications: 'Notifications',
  settings: 'Profil',
  messages: 'Messages',
  faq: 'FAQ',
  participate: 'Participation',
  leaderboard: 'Classement',
};

export function CreatorBreadcrumbs() {
  const pathname = usePathname();
  // /app/creator/... -> parts = ['app', 'creator', ...]
  const rawParts = pathname.split('/').filter(Boolean).slice(2);
  const parts = rawParts[0] === 'dashboard' ? rawParts.slice(1) : rawParts;

  const items = parts.map((part, index) => {
    const label = LABELS[part] || formatSegment(part);
    const href = `/${['app', 'creator', ...parts.slice(0, index + 1)].join('/')}`;
    return { label, href };
  });

  if (items.length === 0) {
    return <span className="text-sm font-medium text-muted-foreground">Tableau de bord</span>;
  }

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/app/creator/dashboard" className="hover:text-foreground transition-colors">
        Tableau de bord
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Link
            href={item.href}
            className={cn('hover:text-foreground transition-colors', 'max-w-[160px] truncate')}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function formatSegment(value: string) {
  if (value.startsWith('[') && value.endsWith(']')) return 'Détail';
  if (value.length <= 3) return value.toUpperCase();
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

