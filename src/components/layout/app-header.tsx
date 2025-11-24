// Source: Layout App — Header (§32, §1296)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AppHeaderProps {
  role: 'creator' | 'brand' | 'admin';
  unreadNotifications?: number;
}

export function AppHeader({ role, unreadNotifications = 0 }: AppHeaderProps) {
  const pathname = usePathname();
  
  const getDashboardPath = () => {
    switch (role) {
      case 'creator':
        return '/app/creator/dashboard';
      case 'brand':
        return '/app/brand/dashboard';
      case 'admin':
        return '/app/admin/dashboard';
      default:
        return '/';
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={getDashboardPath()} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF] shadow-lg ring-1 ring-[#7C3AED]/30" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
              ClipRace
            </span>
          </Link>

          {/* Navigation desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {role === 'creator' && (
              <>
                <Link
                  href="/app/creator/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/creator/dashboard')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/app/creator/discover"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/creator/discover')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Découvrir
                </Link>
                <Link
                  href="/app/creator/submissions"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/creator/submissions')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Mes soumissions
                </Link>
                <Link
                  href="/app/creator/wallet"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/creator/wallet')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Wallet
                </Link>
              </>
            )}
            {role === 'brand' && (
              <>
                <Link
                  href="/app/brand/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/brand/dashboard')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/app/brand/contests"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/brand/contests')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Mes concours
                </Link>
                <Link
                  href="/app/brand/payments"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/brand/payments')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Paiements
                </Link>
              </>
            )}
            {role === 'admin' && (
              <>
                <Link
                  href="/app/admin/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/admin/dashboard')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/app/admin/moderation"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    pathname.startsWith('/app/admin/moderation')
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-[#635BFF]'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  Modération
                </Link>
              </>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <Badge
                  variant="danger"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Badge>
              )}
            </Button>

            {/* Profile menu */}
            <Button variant="ghost" size="sm">
              <User className="h-5 w-5" />
            </Button>

            {/* Mobile menu */}
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

