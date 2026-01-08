import { NextRequest } from 'next/server';
import { assertNotReadOnly } from './read-only';
import { createError } from '@/lib/errors';

/**
 * Middleware pour vérifier read-only mode sur routes mutatives
 * À appeler dans les routes POST/PUT/PATCH/DELETE
 */
export async function enforceNotReadOnly(req: NextRequest, userId: string): Promise<void> {
  try {
    await assertNotReadOnly(userId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('read-only')) {
      throw createError('FORBIDDEN', error.message, 503, { read_only: true });
    }
    throw error;
  }
}

