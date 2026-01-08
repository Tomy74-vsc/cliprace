import { redirect } from 'next/navigation';

// Legacy route kept for backward-compat. Admin MFA is now handled under `/app/admin/mfa/*`.
export default async function AdminMfaPage() {
  redirect('/app/admin/mfa/setup');
}

