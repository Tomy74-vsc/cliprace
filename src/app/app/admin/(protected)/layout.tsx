import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { User } from 'lucide-react';

import { getSession, getUserRole } from '@/lib/auth';
import { fetchAdminApi } from '@/lib/admin/request';
import { getAdminAccess, hasAdminPermission } from '@/lib/admin/rbac';
import { enforceAdminAal2OrRedirect } from '@/lib/admin/mfa-aal2';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AdminBreadcrumbs } from '@/components/navigation/admin-breadcrumbs';
import { AdminCommandK } from '@/components/admin/admin-command-k';
import { AdminGlobalSearch } from '@/components/admin/admin-global-search';
import { AdminSavedViews } from '@/components/admin/admin-saved-views';
import { AdminReadOnlyBanner } from '@/components/admin/admin-read-only-banner';
import { AdminInboxProvider, type AdminInboxSummary } from '@/components/admin/admin-inbox-provider';
import { AdminInboxDropdown } from '@/components/admin/admin-inbox-dropdown';
import { AdminDensityToggle, AdminUIProvider } from '@/components/admin/admin-ui';
import { AdminHelpButton } from '@/components/admin/admin-help-button';
import { AdminToastProvider } from '@/components/admin/admin-toast-provider';
import { AdminNav, type AdminNavItem } from '../layout_nav';

/*
Source:
- Guard: role = admin + MFA AAL2 (Supabase TOTP)
*/
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) redirect('/auth/login');
  const role = await getUserRole(user.id);
  if (role !== 'admin') redirect('/forbidden');

  await enforceAdminAal2OrRedirect();

  const access = await getAdminAccess(user.id);
  const can = (permission: string) => hasAdminPermission(access, permission);

  let inboxInitial: AdminInboxSummary | null = null;
  if (can('inbox.read')) {
    const inboxRes = await fetchAdminApi('/api/admin/inbox/summary', { cache: 'no-store' }).catch(() => null);
    if (inboxRes && inboxRes.ok) {
      inboxInitial = (await inboxRes.json().catch(() => null)) as AdminInboxSummary | null;
    }
  }

  const nav: AdminNavItem[] = [
    {
      label: 'Tableau de bord',
      href: '/app/admin/dashboard',
      icon: 'home',
      disabled: !can('dashboard.read'),
      tooltip: 'Accès requis : dashboard',
    },
    {
      label: 'À traiter',
      href: '/app/admin/inbox',
      icon: 'alert',
      badgeKey: 'adminInbox',
      badgeTone: 'danger',
      badgeCount: inboxInitial?.badge_count ?? 0,
      disabled: !can('inbox.read'),
      tooltip: 'Accès requis : inbox',
    },
    {
      label: 'Marques / Orgs',
      href: '/app/admin/brands',
      icon: 'building',
      disabled: !can('brands.read'),
      tooltip: 'Accès requis : marques',
    },
    {
      label: 'Concours',
      href: '/app/admin/contests',
      icon: 'trophy',
      disabled: !can('contests.read'),
      tooltip: 'Accès requis : concours',
    },
    {
      label: 'Soumissions',
      href: '/app/admin/submissions',
      icon: 'video',
      disabled: !can('submissions.read'),
      tooltip: 'Accès requis : soumissions',
    },
    {
      label: 'Modération',
      href: '/app/admin/moderation',
      icon: 'shield',
      disabled: !can('moderation.read'),
      tooltip: 'Accès requis : modération',
    },
    {
      label: 'Intégrations',
      href: '/app/admin/integrations',
      icon: 'plug',
      disabled: !can('integrations.read'),
      tooltip: 'Accès requis : intégrations',
    },
    {
      label: 'Ingestion',
      href: '/app/admin/ingestion',
      icon: 'activity',
      disabled: !can('ingestion.read'),
      tooltip: 'Accès requis : ingestion',
    },
    {
      label: 'KYC / Risque',
      href: '/app/admin/risk',
      icon: 'alert',
      disabled: !can('risk.read'),
      tooltip: 'Accès requis : risque',
    },
    {
      label: 'Tags / Médias',
      href: '/app/admin/taxonomy',
      icon: 'tag',
      disabled: !can('taxonomy.read'),
      tooltip: 'Accès requis : taxonomy',
    },
    {
      label: 'Exports',
      href: '/app/admin/exports',
      icon: 'download',
      disabled: !can('exports.read'),
      tooltip: 'Accès requis : exports',
    },
    {
      label: 'Utilisateurs',
      href: '/app/admin/users',
      icon: 'users',
      disabled: !can('users.read'),
      tooltip: 'Accès requis : utilisateurs',
    },
    {
      label: 'Finance',
      href: '/app/admin/finance',
      icon: 'dollar',
      disabled: !can('finance.read'),
      tooltip: 'Accès requis : finance',
    },
    {
      label: 'Factures',
      href: '/app/admin/invoices',
      icon: 'filetext',
      disabled: !can('invoices.read'),
      tooltip: 'Accès requis : factures',
    },
    {
      label: 'Emails',
      href: '/app/admin/emails',
      icon: 'mail',
      disabled: !can('emails.read'),
      tooltip: 'Accès requis : emails',
    },
    {
      label: 'CRM',
      href: '/app/admin/crm',
      icon: 'briefcase',
      disabled: !can('crm.read'),
      tooltip: 'Accès requis : CRM',
    },
    {
      label: 'Support',
      href: '/app/admin/support',
      icon: 'lifebuoy',
      disabled: !can('support.read'),
      tooltip: 'Accès requis : support',
    },
    {
      label: 'Audit',
      href: '/app/admin/audit',
      icon: 'clipboard',
      disabled: !can('audit.read'),
      tooltip: 'Accès requis : audit',
    },
    {
      label: 'Équipe',
      href: '/app/admin/team',
      icon: 'users',
      disabled: !can('admin.team.read'),
      tooltip: 'Accès requis : équipe admin',
    },
    {
      label: 'Paramètres',
      href: '/app/admin/settings',
      icon: 'settings',
      disabled: !can('settings.read'),
      tooltip: 'Accès requis : settings',
    },
    {
      label: 'Guide',
      href: '/app/admin/guide',
      icon: 'book',
      disabled: !can('guide.read'),
      tooltip: 'Accès requis : guide',
    },
  ];

  const content = (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl px-4 py-6">
          <Link href="/app/admin/dashboard" className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-card transition-transform duration-200 hover:-translate-y-0.5" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ClipRace
            </span>
          </Link>
          <div className="mt-6 flex-1 space-y-1">
            <AdminNav nav={nav} />
          </div>
          <div className="mt-auto text-xs text-muted-foreground px-2 space-y-2">
            <p className="text-muted-foreground/70">v1.0 admin</p>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <AdminReadOnlyBanner />
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/90 backdrop-blur-xl shadow-sm">
            <div className="flex h-14 items-center justify-between px-4 lg:px-8">
              <div className="flex items-center gap-3 overflow-hidden">
                <AdminBreadcrumbs />
              </div>
              <div className="flex items-center gap-2">
                <AdminCommandK />
                <AdminGlobalSearch />
                <AdminSavedViews />
                {can('guide.read') ? <AdminHelpButton /> : null}
                <AdminDensityToggle />
                <ThemeToggle />
                {can('inbox.read') ? <AdminInboxDropdown /> : null}
                <Button asChild variant="ghost" size="sm" className="h-12 w-12 rounded-full">
                  <Link href="/app/admin/settings">
                    <User className="h-10 w-10" />
                    <span className="sr-only">Profil</span>
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );

  return (
    <AdminUIProvider>
      <AdminToastProvider>
        {can('inbox.read') ? (
          <AdminInboxProvider initialSummary={inboxInitial}>{content}</AdminInboxProvider>
        ) : (
          content
        )}
      </AdminToastProvider>
    </AdminUIProvider>
  );
}


