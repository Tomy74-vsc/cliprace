import { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

/*
Source:
- Guard: any authenticated user for (app) section
*/
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, error } = await getSession();
  if (error || !user) {
    redirect('/auth/login');
  }
  return <>{children}</>;
}

