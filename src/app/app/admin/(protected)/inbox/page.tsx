import { redirect } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { AdminInboxPageClient } from '@/components/admin/admin-inbox-page-client';

export default async function AdminInboxPage() {
  try {
    await requireAdminPermission('inbox.read');
  } catch {
    redirect('/forbidden');
  }

  return <AdminInboxPageClient />;
}

