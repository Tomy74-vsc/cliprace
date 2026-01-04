import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminGuideClient } from '@/components/admin/admin-guide-client';
import {
  ADMIN_GUIDE_MODULES,
  ADMIN_GUIDE_GLOSSARY,
  ADMIN_GUIDE_ONBOARDING_CHECKLIST,
} from '@/lib/admin/guide-content';

export default async function AdminGuidePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  try {
    await requireAdminPermission('guide.read');
  } catch {
    redirect('/forbidden');
  }

  const moduleKey = typeof searchParams.module === 'string' ? searchParams.module : null;
  const route = typeof searchParams.route === 'string' ? searchParams.route : null;

  return (
    <AdminGuideClient
      modules={ADMIN_GUIDE_MODULES}
      glossary={ADMIN_GUIDE_GLOSSARY}
      checklist={ADMIN_GUIDE_ONBOARDING_CHECKLIST}
      initialModuleKey={moduleKey}
      initialRoute={route}
    />
  );
}

