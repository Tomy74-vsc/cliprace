import { redirect } from 'next/navigation';
import { fetchAdminApi } from '@/lib/admin/request';
import { AdminFeatureFlags } from '@/components/admin/admin-feature-flags';
import { AdminPlatformSettings } from '@/components/admin/admin-platform-settings';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

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

  return (
    <section className="space-y-8">
      <div>
        <h1 className="display-2">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Platform configuration and feature flags.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Platform settings</h2>
        <AdminPlatformSettings settings={settingsData.items} canWrite={canWrite} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Feature flags</h2>
        <AdminFeatureFlags flags={flagsData.items} canWrite={canWrite} />
      </div>
    </section>
  );
}
