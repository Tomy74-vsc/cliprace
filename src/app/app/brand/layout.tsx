import { ReactNode } from 'react';
import { getSession, getUserRole } from '@/lib/auth';
import { redirect } from 'next/navigation';

/*
Source:
- Guard: role = brand
- Onboarding: utilise le flag profiles.onboarding_complete, mis à jour via /api/profile/complete
*/
export default async function BrandLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) redirect('/auth/login');
  const role = await getUserRole(user.id);
  if (role !== 'brand' && role !== 'admin') redirect('/forbidden');
  return <>{children}</>;
}
