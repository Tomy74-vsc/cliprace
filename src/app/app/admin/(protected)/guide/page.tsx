import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';

import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminGuideClient } from '@/components/admin/admin-guide-client';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
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
    <section className="space-y-6">
      <AdminPageHeader
        title="Admin guide"
        description="Playbooks, glossary, and onboarding checklist."
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/admin/dashboard">Back to dashboard</Link>
          </Button>
        }
      />

      <AdminGuideClient
        modules={ADMIN_GUIDE_MODULES}
        glossary={ADMIN_GUIDE_GLOSSARY}
        checklist={ADMIN_GUIDE_ONBOARDING_CHECKLIST}
        initialModuleKey={moduleKey}
        initialRoute={route}
      />
    </section>
  );
}
