import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminUserActions } from '@/components/admin/admin-user-actions';
import { formatDateTime } from '@/lib/formatters';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

type UserDetailResponse = {
  profile: {
    id: string;
    email: string;
    display_name: string | null;
    role: 'admin' | 'brand' | 'creator';
    avatar_url: string | null;
    bio: string | null;
    country: string | null;
    is_active: boolean;
    onboarding_complete: boolean;
    created_at: string;
    updated_at: string;
  };
  brand_profile: {
    company_name: string;
    website: string | null;
    industry: string | null;
    vat_number: string | null;
    address_line1: string | null;
    address_line2: string | null;
    address_city: string | null;
    address_postal_code: string | null;
    address_country: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  creator_profile: {
    first_name: string | null;
    last_name: string | null;
    handle: string | null;
    primary_platform: string | null;
    followers: number | null;
    avg_views: number | null;
    created_at: string;
    updated_at: string;
  } | null;
  org_memberships: Array<{
    org_id: string;
    role_in_org: string;
    org: { id: string; name: string | null; billing_email: string | null } | null;
  }>;
  kyc: {
    provider: string;
    status: string;
    reason: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  risk_flags: Array<{
    id: number;
    reason: string;
    severity: string;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let canWrite = false;
  try {
    const { access } = await requireAdminPermission('users.read');
    canWrite = hasAdminPermission(access, 'users.write');
  } catch {
    redirect('/forbidden');
  }

  const res = await fetchAdminApi(`/api/admin/users/${id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    notFound();
  }

  const data: UserDetailResponse = await res.json();
  const profile = data.profile;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display-2">{profile.display_name || profile.email}</h1>
          <div className="text-sm text-muted-foreground">{profile.email}</div>
          <div className="text-xs text-muted-foreground">{profile.id}</div>
        </div>
        <AdminUserActions userId={profile.id} role={profile.role} isActive={profile.is_active} canWrite={canWrite} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Rôle</div>
                <Badge variant={profile.role === 'admin' ? 'info' : 'secondary'}>{profile.role}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Statut</div>
                <Badge variant={profile.is_active ? 'success' : 'danger'}>
                  {profile.is_active ? 'actif' : 'inactif'}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Onboarding</div>
                <div>{profile.onboarding_complete ? 'terminé' : 'en attente'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Pays</div>
                <div>{profile.country || '-'}</div>
              </div>
            </div>
            {profile.bio ? <div className="text-muted-foreground">{profile.bio}</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Créé</div>
              <div>{formatDateTime(profile.created_at)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mis à jour</div>
              <div>{formatDateTime(profile.updated_at)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil marque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.brand_profile ? (
              <>
                <div className="font-medium">{data.brand_profile.company_name}</div>
                <div className="text-xs text-muted-foreground">{data.brand_profile.website || '-'}</div>
                <div className="text-xs text-muted-foreground">{data.brand_profile.industry || '-'}</div>
                <div className="text-xs text-muted-foreground">{data.brand_profile.vat_number || '-'}</div>
                <div className="text-xs text-muted-foreground">
                  {[
                    data.brand_profile.address_line1,
                    data.brand_profile.address_line2,
                    data.brand_profile.address_city,
                    data.brand_profile.address_postal_code,
                    data.brand_profile.address_country,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun profil marque.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Profil créateur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.creator_profile ? (
              <>
                <div className="font-medium">
                  {[data.creator_profile.first_name, data.creator_profile.last_name]
                    .filter(Boolean)
                    .join(' ') || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  @{data.creator_profile.handle || '-'} · {data.creator_profile.primary_platform || '-'}
                </div>
                <div className="text-xs text-muted-foreground">Abonnés : {data.creator_profile.followers ?? 0}</div>
                <div className="text-xs text-muted-foreground">Vues moy. : {data.creator_profile.avg_views ?? 0}</div>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun profil créateur.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organisations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.org_memberships.length === 0 ? (
              <p className="text-muted-foreground">Aucune appartenance à une organisation.</p>
            ) : (
              data.org_memberships.map((org) => (
                <div key={org.org_id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{org.org?.name || org.org_id}</div>
                    <div className="text-xs text-muted-foreground">{org.org?.billing_email || '-'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{org.role_in_org}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>KYC & risque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">KYC</div>
              {data.kyc ? (
                <div className="space-y-1">
                  <div className="font-medium">
                    {data.kyc.provider} · {data.kyc.status}
                  </div>
                  {data.kyc.reason ? (
                    <div className="text-xs text-muted-foreground">{data.kyc.reason}</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground">Aucun KYC.</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Risk flags</div>
              {data.risk_flags.length === 0 ? (
                <div className="text-muted-foreground">Aucun signal de risque.</div>
              ) : (
                data.risk_flags.map((flag) => (
                  <div key={flag.id} className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{flag.reason}</div>
                      <div className="text-xs text-muted-foreground">{flag.severity}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {flag.resolved_at ? 'résolu' : 'ouvert'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="secondary">
          <Link href="/app/admin/users">Retour à la liste</Link>
        </Button>
      </div>
    </section>
  );
}
