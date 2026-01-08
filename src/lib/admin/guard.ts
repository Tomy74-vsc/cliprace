import { getSession, type SessionUser } from '@/lib/auth';
import { createError } from '@/lib/errors';

export async function requireAdminUser(): Promise<SessionUser> {
  const { user, error } = await getSession();
  if (error || !user) {
    throw createError('UNAUTHORIZED', 'Authentification requise', 401);
  }
  if (user.role !== 'admin') {
    throw createError('FORBIDDEN', 'Accès admin requis', 403);
  }
  return user;
}
