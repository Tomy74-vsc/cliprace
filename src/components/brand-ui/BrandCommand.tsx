'use client';

/**
 * BrandCommand — cmdk-powered command palette for brand pages.
 * Navigation-only in this PR (no API fetches).
 */
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Trophy,
  PlusCircle,
  MessageCircle,
  CreditCard,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrandPortalContainer } from './use-brand-portal';

/* ── Types ── */

export interface BrandCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Nav items ── */

interface CmdItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const NAV_ITEMS: CmdItem[] = [
  { label: 'Dashboard', href: '/app/brand/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, shortcut: 'D' },
  { label: 'Campagnes', href: '/app/brand/contests', icon: <Trophy className="h-4 w-4" />, shortcut: 'C' },
  { label: 'Nouvelle campagne', href: '/app/brand/contests/new', icon: <PlusCircle className="h-4 w-4" />, shortcut: 'N' },
  { label: 'Messages', href: '/app/brand/messages', icon: <MessageCircle className="h-4 w-4" />, shortcut: 'M' },
  { label: 'Facturation', href: '/app/brand/billing', icon: <CreditCard className="h-4 w-4" />, shortcut: 'B' },
  { label: 'Paramètres', href: '/app/brand/settings', icon: <Settings className="h-4 w-4" />, shortcut: 'S' },
];

/* ── Component ── */

export function BrandCommand({ open, onOpenChange }: BrandCommandProps) {
  const router = useRouter();
  const portalContainer = useBrandPortalContainer();

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange],
  );

  // Global ⌘K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={portalContainer}>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2',
            'rounded-[var(--r4)] border border-[var(--border-1)]',
            'bg-[var(--surface-1)] shadow-[var(--shadow-brand-2)]',
            'overflow-hidden focus:outline-none',
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Recherche rapide
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Naviguez rapidement vers une page ou action.
          </DialogPrimitive.Description>

          <Command className="flex flex-col" label="Recherche rapide">
            {/* Input */}
            <Command.Input
              placeholder="Rechercher…"
              className={cn(
                'w-full bg-transparent px-4 py-3.5',
                'text-[14px] text-[var(--text-1)] placeholder:text-[var(--text-3)]',
                'border-b border-[var(--border-1)]',
                'outline-none',
              )}
            />

            {/* List */}
            <Command.List className="max-h-[320px] overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-[14px] text-[var(--text-3)]">
                Aucun résultat
              </Command.Empty>

              <Command.Group
                heading="Navigation"
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-[var(--text-3)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5"
              >
                {NAV_ITEMS.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => navigate(item.href)}
                    className={cn(
                      'flex items-center gap-3 rounded-[var(--r2)] px-3 py-2.5',
                      'text-[14px] text-[var(--text-2)] cursor-pointer',
                      'data-[selected=true]:bg-[var(--surface-2)] data-[selected=true]:text-[var(--text-1)]',
                      'transition-colors',
                    )}
                  >
                    <span className="text-[var(--text-3)]">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-[11px] text-[var(--text-3)] font-mono bg-[var(--surface-3)] rounded px-1.5 py-0.5">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default BrandCommand;
