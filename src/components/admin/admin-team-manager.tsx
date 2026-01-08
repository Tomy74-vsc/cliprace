'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminTable } from '@/components/admin/admin-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCsrfToken } from '@/lib/csrf-client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

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

function roleBadgeVariant(roleKey: string) {
  if (roleKey === 'finance') return 'warning' as const;
  if (roleKey === 'marketing') return 'info' as const;
  if (roleKey === 'support') return 'secondary' as const;
  if (roleKey === 'ops') return 'default' as const;
  if (roleKey === 'read_only') return 'outline' as const;
  if (roleKey === 'super_admin') return 'success' as const;
  return 'secondary' as const;
}

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

export function AdminTeamManager({ data }: { data: TeamResponse }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>(['ops']);

  const roles = useMemo(() => (data.ok && data.mode !== 'disabled' ? data.roles : []), [data]);
  const staff = useMemo(() => (data.ok && data.mode !== 'disabled' ? data.staff : []), [data]);

  const rolesByKey = useMemo(() => new Map(roles.map((r) => [r.key, r])), [roles]);
  const sortedRoles = useMemo(
    () =>
      [...roles].sort((a, b) => {
        if (a.key === 'super_admin') return -1;
        if (b.key === 'super_admin') return 1;
        return a.name.localeCompare(b.name, 'en');
      }),
    [roles]
  );

  const showBootstrap = data.ok && data.mode === 'bootstrap';
  const missingTables = data.ok && data.mode === 'disabled' && data.missing_table;

  const totalAdmins = staff.length;
  const activeAdmins = staff.filter((row) => row.is_active).length;
  const superAdmins = staff.filter((row) => row.is_super_admin).length;
  const assignedRoles = staff.reduce((count, row) => count + (row.role_keys?.length ?? 0), 0);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch('/api/admin/team/bootstrap', { method: 'POST', headers: { 'x-csrf': token } });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.ok === false) {
        window.alert(payload?.message || 'Bootstrap failed');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify({
          email: e,
          display_name: displayName.trim() || undefined,
          send_invite: sendInvite,
          is_super_admin: isSuperAdmin,
          role_keys: selectedRoleKeys,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.ok === false) {
        window.alert(payload?.message || 'Create failed');
        return;
      }
      setEmail('');
      setDisplayName('');
      setIsSuperAdmin(false);
      setSelectedRoleKeys(['ops']);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const patchAdmin = async (userId: string, patch: Record<string, unknown>) => {
    setLoading(true);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-csrf': token },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.ok === false) {
        window.alert(payload?.message || 'Update failed');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (missingTables) {
    return (
      <section className="space-y-6">
        <AdminPageHeader
          title="Team"
          description="RBAC is disabled. Apply `db_refonte/42_admin_rbac.sql` to enable team management."
          icon={<Users className="h-5 w-5" />}
          badges={<Badge variant="secondary">RBAC disabled</Badge>}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Setup required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The admin RBAC tables are missing. Run the SQL migration and refresh this page.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title="Team"
        description="Manage admin access, roles, and permissions."
        icon={<Users className="h-5 w-5" />}
        badges={
          <>
            <Badge variant="secondary">{totalAdmins} admins</Badge>
            <Badge variant="secondary">{activeAdmins} active</Badge>
            <Badge variant="secondary">{roles.length} roles</Badge>
          </>
        }
        actions={
          showBootstrap ? (
            <Button variant="primary" onClick={bootstrap} loading={loading}>
              Bootstrap RBAC (make me super admin)
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{totalAdmins}</div>
            <Badge variant="secondary">{activeAdmins} active</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Super admins</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{superAdmins}</div>
            <Badge variant="secondary">Admins</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Roles available</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{roles.length}</div>
            <Badge variant="secondary">{assignedRoles} assigned</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">RBAC mode</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{data.mode}</div>
            <Badge variant="secondary">Mode</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Add admin"
          subtitle="Invite new admins and assign roles."
        />
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="admin@company.com"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Display name</div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  placeholder="First Last"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
                Send Supabase invite
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} />
                Super admin
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Roles</div>
              <div className="flex flex-wrap gap-2">
                {sortedRoles
                  .filter((r) => r.key !== 'super_admin')
                  .map((role) => {
                    const checked = selectedRoleKeys.includes(role.key);
                    return (
                      <label
                        key={role.key}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedRoleKeys((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(role.key);
                              else next.delete(role.key);
                              return Array.from(next);
                            });
                          }}
                        />
                        {role.name}
                      </label>
                    );
                  })}
              </div>
              <div className="text-xs text-muted-foreground">
                Tip: pick read_only for admins that should not change data.
              </div>
            </div>

            <Button variant="primary" onClick={createAdmin} loading={loading}>
              Add admin
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<Users className="h-5 w-5" />}
          title="Admin roster"
          subtitle="Toggle access and assign roles per admin."
          badges={
            <>
              <Badge variant="secondary">{activeAdmins} active</Badge>
              <Badge variant="secondary">{superAdmins} super admin</Badge>
            </>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <AdminTable>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No admins configured yet.
                    </td>
                  </tr>
                ) : (
                  staff.map((row) => {
                    const rowRoleKeys = row.role_keys ?? [];
                    const active = row.is_active;
                    return (
                      <tr key={row.user_id} className="hover:bg-muted/30">
                        <td className="px-4 py-4">
                          <div className="font-medium">{row.display_name || row.email || row.user_id}</div>
                          <div className="text-xs text-muted-foreground">{row.email || row.user_id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={loading}
                                onChange={(e) => patchAdmin(row.user_id, { is_active: e.target.checked })}
                              />
                              Active
                            </label>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={row.is_super_admin}
                                disabled={loading}
                                onChange={(e) => patchAdmin(row.user_id, { is_super_admin: e.target.checked })}
                              />
                              Super admin
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {row.is_super_admin ? (
                              <Badge variant="success">Super admin</Badge>
                            ) : rowRoleKeys.length === 0 ? (
                              <Badge variant="outline">None</Badge>
                            ) : (
                              rowRoleKeys.map((rk) => (
                                <Badge key={rk} variant={roleBadgeVariant(rk)}>
                                  {rolesByKey.get(rk)?.name || rk}
                                </Badge>
                              ))
                            )}
                          </div>
                          {!row.is_super_admin ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {sortedRoles
                                .filter((r) => r.key !== 'super_admin')
                                .map((role) => {
                                  const checked = rowRoleKeys.includes(role.key);
                                  return (
                                    <label
                                      key={role.key}
                                      className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={loading || !active}
                                        onChange={(e) => {
                                          const next = new Set(rowRoleKeys);
                                          if (e.target.checked) next.add(role.key);
                                          else next.delete(role.key);
                                          patchAdmin(row.user_id, { role_keys: Array.from(next) });
                                        }}
                                      />
                                      {role.name}
                                    </label>
                                  );
                                })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-muted-foreground">ID: {row.user_id}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </AdminTable>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
