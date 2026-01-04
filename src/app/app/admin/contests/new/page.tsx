import Link from 'next/link';
import { fetchAdminApi } from '@/lib/admin/request';
import { ContestWizardClient } from '@/components/brand/contest-wizard-client';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';

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
      <section className="space-y-4">
        <div>
          <h1 className="display-2">Créer un concours (admin)</h1>
          <p className="text-muted-foreground text-sm">Sélectionne d’abord une marque.</p>
        </div>
        <Button asChild variant="primary">
          <Link href="/app/admin/brands">Aller aux marques</Link>
        </Button>
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display-2">Créer un concours</h1>
          <p className="text-muted-foreground text-sm">Pour la marque: {label}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/admin/brands">Retour marques</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <ContestWizardClient brandId={brandId} />
      </div>
    </section>
  );
}
