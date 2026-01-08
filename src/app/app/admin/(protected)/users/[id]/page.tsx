import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { notFound, redirect } from 'next/navigation';
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminUserActions } from '@/components/admin/admin-user-actions';
import { AdminViewAsButton } from '@/components/admin/admin-view-as-button';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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

function kycVariant(status: string | null): BadgeProps['variant'] {
  if (status === 'verified' || status === 'approved') return 'success';
  if (status === 'pending' || status === 'reviewing') return 'warning';
  if (status === 'failed' || status === 'rejected') return 'danger';
  return 'secondary';
}

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
  const orgCount = data.org_memberships.length;
  const openRiskFlags = data.risk_flags.filter((flag) => !flag.resolved_at).length;
  const resolvedRiskFlags = data.risk_flags.length - openRiskFlags;
  const onboardingLabel = profile.onboarding_complete ? 'Complete' : 'Pending';
  const creatorName = data.creator_profile
    ? [data.creator_profile.first_name, data.creator_profile.last_name].filter(Boolean).join(' ')
    : null;

  return (
    <section className="space-y-8">
      <AdminPageHeader
        title={profile.display_name || profile.email}
        description={profile.email}
        icon={<User className="h-5 w-5" />}
        badges={
          <>
            <Badge variant={profile.role === 'admin' ? 'info' : 'secondary'}>{profile.role}</Badge>
            <Badge variant={profile.is_active ? 'success' : 'danger'}>
              {profile.is_active ? 'active' : 'inactive'}
            </Badge>
            <Badge variant="secondary">ID: {profile.id}</Badge>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {profile.role === 'brand' && (
              <AdminViewAsButton userId={profile.id} targetRole="brand" />
            )}
            {profile.role === 'creator' && (
              <AdminViewAsButton userId={profile.id} targetRole="creator" />
            )}
            <AdminUserActions userId={profile.id} role={profile.role} isActive={profile.is_active} canWrite={canWrite} />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Account status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{profile.is_active ? 'Active' : 'Inactive'}</div>
            <Badge variant={profile.is_active ? 'success' : 'danger'}>{profile.role}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{onboardingLabel}</div>
            <Badge variant={profile.onboarding_complete ? 'success' : 'secondary'}>Status</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{orgCount}</div>
            <Badge variant="secondary">Memberships</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk flags</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{openRiskFlags}</div>
            <Badge variant="secondary">{resolvedRiskFlags} resolved</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <SectionHeader
          icon={<User className="h-5 w-5" />}
          title="Profile"
          subtitle="Identity, account status, and onboarding details."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-muted-foreground">Role</div>
                  <Badge variant={profile.role === 'admin' ? 'info' : 'secondary'}>{profile.role}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={profile.is_active ? 'success' : 'danger'}>
                    {profile.is_active ? 'active' : 'inactive'}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Onboarding</div>
                  <div>{onboardingLabel}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Country</div>
                  <div>{profile.country || '-'}</div>
                </div>
              </div>
              {profile.bio ? <div className="text-muted-foreground">{profile.bio}</div> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Account timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div>{formatDateTime(profile.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Updated</div>
                <div>{formatDateTime(profile.updated_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">User ID</div>
                <div className="text-xs text-muted-foreground">{profile.id}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Brand profile</CardTitle>
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
              <p className="text-muted-foreground">No brand profile.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Creator profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.creator_profile ? (
              <>
                <div className="font-medium">{creatorName || '-'}</div>
                <div className="text-xs text-muted-foreground">
                  @{data.creator_profile.handle || '-'} on {data.creator_profile.primary_platform || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Followers: {data.creator_profile.followers ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Avg views: {data.creator_profile.avg_views ?? 0}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No creator profile.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.org_memberships.length === 0 ? (
              <p className="text-muted-foreground">No organization memberships.</p>
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
            <CardTitle>Compliance and risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">KYC</div>
              {data.kyc ? (
                <div className="space-y-1">
                  <div className="font-medium">
                    {data.kyc.provider} - {data.kyc.status}
                  </div>
                  <Badge variant={kycVariant(data.kyc.status)}>{data.kyc.status}</Badge>
                  {data.kyc.reason ? (
                    <div className="text-xs text-muted-foreground">{data.kyc.reason}</div>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground">No KYC record.</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Risk flags</div>
              {data.risk_flags.length === 0 ? (
                <div className="text-muted-foreground">No risk flags.</div>
              ) : (
                data.risk_flags.map((flag) => (
                  <div key={flag.id} className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{flag.reason}</div>
                      <div className="text-xs text-muted-foreground">{flag.severity}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {flag.resolved_at ? 'resolved' : 'open'}
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
          <Link href="/app/admin/users">Back to users</Link>
        </Button>
      </div>
    </section>
  );
}
