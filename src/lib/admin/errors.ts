import type { PostgrestError } from '@supabase/supabase-js';
import { createError, type AppError } from '@/lib/errors';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export function mapPostgrestError(
  error: PostgrestError | null | undefined,
  message: string
): AppError | null {
  if (!error) return null;

  if (error.code === POSTGRES_UNIQUE_VIOLATION) {
    return createError('CONFLICT', message, 409, error.message);
  }

  if (error.code === 'PGRST116') {
    return createError('NOT_FOUND', message, 404, error.message);
  }

  return createError('DATABASE_ERROR', message, 500, error.message);
}
