import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchAdminApi } from '@/lib/admin/request';
import { AdminFeatureFlags } from '@/components/admin/admin-feature-flags';
import { AdminPlatformSettings } from '@/components/admin/admin-platform-settings';
import { AdminMfaSettings } from '@/components/admin/admin-mfa-settings';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { ListChecks, Settings, Shield, SlidersHorizontal } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PlatformSetting = {
  key: string;
  value: unknown;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsResponse = {
  items: PlatformSetting[];
  pagination: { total: number; page: number; limit: number };
};

type FeatureFlag = {
  key: string;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type FlagsResponse = {
  items: FeatureFlag[];
  pagination: { total: number; page: number; limit: number };
};

function SectionHeader({
  icon,
  title,
  subtitle,
  badges,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges ? <div className="flex items-center gap-2">{badges}</div> : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export default async function AdminSettingsPage() {
  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('settings.read');
    canWrite = hasAdminPermission(access, 'settings.write');
  } catch {
    redirect('/forbidden');
  }

  const [settingsRes, flagsRes] = await Promise.all([
    fetchAdminApi('/api/admin/settings?limit=100&page=1', {
      cache: 'no-store',
    }),
    fetchAdminApi('/api/admin/feature-flags?limit=100&page=1', {
      cache: 'no-store',
    }),
  ]);

  const settingsData: SettingsResponse = settingsRes.ok
    ? await settingsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 100 } };
  const flagsData: FlagsResponse = flagsRes.ok
    ? await flagsRes.json()
    : { items: [], pagination: { total: 0, page: 1, limit: 100 } };

  const activeFlags = flagsData.items.filter((flag) => flag.is_enabled).length;
  const inactiveFlags = Math.max(0, flagsData.items.length - activeFlags);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Paramètres"
        description="Configuration plateforme et déploiement des fonctionnalités."
        icon={<Settings className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{settingsData.pagination.total} réglages</Badge>
            <Badge variant="secondary">{flagsData.pagination.total} flags</Badge>
            <Badge variant={canWrite ? 'success' : 'secondary'}>
              {canWrite ? 'Écriture' : 'Lecture seule'}
            </Badge>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/admin/audit">Journal d’audit</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/integrations">Intégrations</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Réglages plateforme</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{settingsData.pagination.total}</div>
            <Badge variant="secondary">{settingsData.items.length} chargés</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feature flags</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{flagsData.pagination.total}</div>
            <Badge variant="secondary">{flagsData.items.length} chargés</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flags actifs</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{activeFlags}</div>
            <Badge variant="secondary">Sur la page</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flags désactivés</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{inactiveFlags}</div>
            <Badge variant="secondary">Sur la page</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Shield className="h-5 w-5" />}
          title="Sécurité admin"
          subtitle="MFA (Google Authenticator) pour l’accès à l’interface admin."
          badges={<Badge variant={canWrite ? 'success' : 'secondary'}>{canWrite ? 'Gérable' : 'Lecture seule'}</Badge>}
        />
        <Card>
          <CardContent className="pt-6">
            <AdminMfaSettings canWrite={canWrite} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<SlidersHorizontal className="h-5 w-5" />}
          title="Réglages plateforme"
          subtitle="Configuration clé-valeur pour le comportement de la plateforme."
          badges={<Badge variant="secondary">{settingsData.items.length} items</Badge>}
        />
        <Card>
          <CardContent className="pt-6">
            <AdminPlatformSettings settings={settingsData.items} canWrite={canWrite} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Feature flags"
          subtitle="Activer/désactiver des fonctionnalités et auditer les changements."
          badges={
            <>
              <Badge variant="secondary">Actifs {activeFlags}</Badge>
              <Badge variant="secondary">Désactivés {inactiveFlags}</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <AdminFeatureFlags flags={flagsData.items} canWrite={canWrite} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
