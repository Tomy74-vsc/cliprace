import { cn } from '@/lib/utils';
import { Music2, Instagram, Youtube } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Platform } from '@/lib/validators/platforms';

const PLATFORM_META: Record<
  Platform,
  {
    label: string;
    Icon: LucideIcon;
  }
> = {
  tiktok: { label: 'TikTok', Icon: Music2 },
  instagram: { label: 'Instagram', Icon: Instagram },
  youtube: { label: 'YouTube', Icon: Youtube },
};

export function PlatformBadge({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  const { Icon, label } = meta;
  return (
    <Badge className={cn('flex items-center gap-1.5 px-3 py-1 bg-muted/50 text-foreground', className)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </Badge>
  );
}

export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_META[platform]?.label ?? platform;
}

