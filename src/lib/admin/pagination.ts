import { z } from 'zod';

/**
 * Schema pour keyset pagination
 */
export const KeysetPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type KeysetPaginationInput = z.infer<typeof KeysetPaginationSchema>;

/**
 * Décode un cursor (format: base64 JSON {created_at, id})
 */
export function decodeCursor(cursor?: string): { created_at: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') {
      return { created_at: parsed.created_at, id: parsed.id };
    }
  } catch {
    // Invalid cursor, ignore
  }
  return null;
}

/**
 * Encode un cursor (format: base64 JSON {created_at, id})
 */
export function encodeCursor(created_at: string, id: string): string {
  return Buffer.from(JSON.stringify({ created_at, id })).toString('base64');
}

/**
 * Helper pour construire une query Supabase avec keyset pagination
 * 
 * Utilise une approche en deux étapes pour Supabase :
 * 1. created_at < cursor.created_at
 * 2. OU (created_at = cursor.created_at ET id < cursor.id)
 */
export function applyKeysetPagination(
  query: UnsafeAny,
  cursor: { created_at: string; id: string } | null,
  limit: number
) {
  let q = query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);

  if (cursor) {
    // Pagination keyset : created_at < cursor.created_at OU (created_at = cursor.created_at ET id < cursor.id)
    // Supabase PostgREST syntax pour OR avec conditions
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  return q;
}

/**
 * Extrait le nextCursor depuis les résultats
 */
export function extractNextCursor<T extends { created_at: string; id: string }>(
  items: T[],
  limit: number
): string | null {
  if (items.length > limit) {
    const lastItem = items[limit - 1];
    return encodeCursor(lastItem.created_at, lastItem.id);
  }
  return null;
}


