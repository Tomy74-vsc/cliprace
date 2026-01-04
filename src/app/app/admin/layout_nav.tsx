/* Admin navigation (sidebar) */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Building2,
  BookOpen,
  Briefcase,
  Clipboard,
  DollarSign,
  Download,
  FileText,
  Home,
  LifeBuoy,
  Mail,
  Plug,
  Settings,
  ShieldAlert,
  Shield,
  Tag,
  Trophy,
  Users,
  Video,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAdminInboxOptional } from '@/components/admin/admin-inbox-provider';

const iconMap = {
  home: Home,
  building: Building2,
  book: BookOpen,
  plug: Plug,
  activity: Activity,
  alert: ShieldAlert,
  tag: Tag,
  trophy: Trophy,
  video: Video,
  shield: Shield,
  users: Users,
  dollar: DollarSign,
  filetext: FileText,
  mail: Mail,
  briefcase: Briefcase,
  lifebuoy: LifeBuoy,
  clipboard: Clipboard,
  download: Download,
  settings: Settings,
} as const;

type IconKey = keyof typeof iconMap;

export type AdminNavItem = {
  label: string;
  href: string;
  icon: IconKey;
  badgeCount?: number;
  badgeKey?: 'adminInbox';
  badgeTone?: 'primary' | 'danger';
  disabled?: boolean;
  tooltip?: string;
};

export function AdminNav({ nav }: { nav: AdminNavItem[] }) {
  const pathname = usePathname();
  const inbox = useAdminInboxOptional();
  const inboxBadgeCount = inbox?.summary?.badge_count ?? null;

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = iconMap[item.icon];
          const effectiveBadgeCount =
            item.badgeKey === 'adminInbox' && inboxBadgeCount !== null ? inboxBadgeCount : item.badgeCount ?? 0;
          const badgeTone = item.badgeTone ?? 'primary';
          const baseClass = cn(
            'group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent transition-all',
            active
              ? 'bg-primary/10 text-primary border-primary/30 shadow-card'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          );

          const inner = (
            <>
              <span className={cn('h-8 w-1 rounded-full bg-transparent', active && 'bg-primary')} />
              <div className="relative flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {effectiveBadgeCount ? (
                  <span
                    className={cn(
                      'absolute -top-2 -right-3 rounded-full text-[10px] px-1.5 py-0.5 leading-none shadow-sm',
                      badgeTone === 'danger' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {effectiveBadgeCount > 9 ? '9+' : effectiveBadgeCount}
                  </span>
                ) : null}
                {item.disabled ? (
                  <span className="absolute -top-2 -right-3 rounded-full bg-muted text-muted-foreground p-0.5 border border-border">
                    <Lock className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <span className="font-medium">{item.label}</span>
            </>
          );

          const content = item.disabled ? (
            <div key={item.href} className={cn(baseClass, 'opacity-60 cursor-not-allowed')} aria-disabled>
              {inner}
            </div>
          ) : (
            <Link key={item.href} href={item.href} className={baseClass}>
              {inner}
            </Link>
          );

          if (!item.tooltip) return content;

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
