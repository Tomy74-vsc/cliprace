import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { ContestWizardClient } from '@/components/brand/contest-wizard-client';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { Trophy } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent } from '@/components/ui/card';

type BrandDetail = {
  profile: { id: string; email: string; display_name: string | null };
  brand_profile: { company_name: string } | null;
};

export default async function AdminCreateContestForBrandPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let canReadBrand = false;
  try {
    const { access } = await requireAdminPermission('contests.write');
    canReadBrand = hasAdminPermission(access, 'brands.read');
  } catch {
    redirect('/forbidden');
  }

  const brandId = typeof searchParams.brand_id === 'string' ? searchParams.brand_id : '';

  if (!brandId) {
    return (
      <section className="space-y-6">
        <AdminPageHeader
          title="Create contest (admin)"
          description="Select a brand before starting the contest wizard."
          icon={<Trophy className="h-5 w-5" />}
        />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick a brand to associate with the contest so budget, billing, and ownership are correct.
            </p>
            <Button asChild variant="primary">
              <Link href="/app/admin/brands">Go to brands</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const brandRes = canReadBrand
    ? await fetchAdminApi(`/api/admin/brands/${brandId}`, { cache: 'no-store' })
    : null;
  const brandData: BrandDetail | null = brandRes?.ok ? await brandRes.json() : null;

  const label =
    brandData?.brand_profile?.company_name ||
    brandData?.profile?.display_name ||
    brandData?.profile?.email ||
    brandId;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        title="Create contest"
        description={`For brand: ${label}`}
        icon={<Trophy className="h-5 w-5" />}
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/admin/brands">Back to brands</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ContestWizardClient brandId={brandId} mode="admin" />
        </CardContent>
      </Card>
    </section>
  );
}
