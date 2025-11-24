import { ReactNode } from 'react';
import { getSession, getUserRole } from '@/lib/auth';
import { redirect } from 'next/navigation';

/*
Source:
- Guard: role = admin
*/
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) redirect('/auth/login');
  const role = await getUserRole(user.id);
  if (role !== 'admin') redirect('/forbidden');
  return <>{children}</>;
}

