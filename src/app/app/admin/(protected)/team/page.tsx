import { redirect } from 'next/navigation';
import { fetchAdminApi } from '@/lib/admin/request';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminTeamManager } from '@/components/admin/admin-team-manager';

type TeamResponse =
  | { ok: true; mode: 'disabled'; missing_table: true }
  | {
      ok: true;
      missing_table: false;
      mode: 'bootstrap' | 'enforced';
      roles: Array<{ id: string; key: string; name: string; description: string | null }>;
      permissions: Array<{ key: string; description: string }>;
      staff: Array<{
        user_id: string;
        email: string | null;
        display_name: string | null;
        is_active: boolean;
        is_super_admin: boolean;
        role_keys: string[];
        created_at: string;
        updated_at: string;
      }>;
    };

export default async function AdminTeamPage() {
  try {
    await requireAdminPermission('admin.team.read');
  } catch {
    redirect('/forbidden');
  }

  const res = await fetchAdminApi('/api/admin/team', { cache: 'no-store' });
  const data: TeamResponse = res.ok ? await res.json() : { ok: true, mode: 'disabled', missing_table: true };

  return <AdminTeamManager data={data} />;
}

