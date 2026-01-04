'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AdminTable } from '@/components/admin/admin-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf');
  const data = await res.json();
  return data.token || '';
}

function roleBadgeVariant(roleKey: string) {
  if (roleKey === 'finance') return 'warning' as const;
  if (roleKey === 'marketing') return 'info' as const;
  if (roleKey === 'support') return 'secondary' as const;
  if (roleKey === 'ops') return 'default' as const;
  if (roleKey === 'read_only') return 'outline' as const;
  if (roleKey === 'super_admin') return 'success' as const;
  return 'secondary' as const;
}

export function AdminTeamManager({ data }: { data: TeamResponse }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>(['ops']);

  const roles = data.ok && data.mode !== 'disabled' ? data.roles : [];
  const staff = data.ok && data.mode !== 'disabled' ? data.staff : [];

  const rolesByKey = useMemo(() => new Map(roles.map((r) => [r.key, r])), [roles]);
  const sortedRoles = useMemo(
    () =>
      [...roles].sort((a, b) => {
        if (a.key === 'super_admin') return -1;
        if (b.key === 'super_admin') return 1;
        return a.name.localeCompare(b.name, 'fr');
      }),
    [roles]
  );

  const showBootstrap = data.ok && data.mode === 'bootstrap';
  const missingTables = data.ok && data.mode === 'disabled' && data.missing_table;

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
        <div>
          <h1 className="display-2">Équipe admin</h1>
          <p className="text-muted-foreground text-sm">
            RBAC non activé : applique le SQL `db_refonte/42_admin_rbac.sql` pour gérer les accès par module.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display-2">Équipe admin</h1>
          <p className="text-muted-foreground text-sm">
            Gère qui a accès à quoi (lecture/écriture) dans l’interface administrateur.
          </p>
        </div>
        {showBootstrap ? (
          <Button variant="primary" onClick={bootstrap} loading={loading}>
            Initialiser RBAC (me rendre super admin)
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ajouter un admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="admin@exemple.com"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Nom (optionnel)</div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Prénom Nom"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} />
              Envoyer une invitation Supabase
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} />
              Super admin
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Rôles</div>
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
              Astuce : coche seulement “Lecture seule” pour un admin qui ne doit rien modifier.
            </div>
          </div>

          <Button variant="primary" onClick={createAdmin} loading={loading}>
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTable>
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Rôles</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Aucun admin configuré
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
                            Actif
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
                            <Badge variant="outline">Aucun</Badge>
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
                                  <label key={role.key} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
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
    </section>
  );
}

