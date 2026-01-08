import { ReactNode } from 'react';

/*
Source:
- Root admin layout.
- Security is enforced in `app/admin/(protected)/layout.tsx` to avoid redirect loops and exclude `/app/admin/mfa/*`.
*/
export default async function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
