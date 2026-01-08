import { z } from 'zod';
import { createError } from '@/lib/errors';

/**
 * Schema pour reason obligatoire sur mutations admin
 */
export const ReasonSchema = z.object({
  reason: z.string().min(8, 'La raison doit contenir au moins 8 caractères').max(500, 'La raison est trop longue'),
  reason_code: z
    .enum([
      'other',
      'fraud',
      'policy_violation',
      'quality_issue',
      'duplicate',
      'spam',
      'user_request',
      'system_error',
      'maintenance',
    ])
    .optional(),
});

export type ReasonInput = z.infer<typeof ReasonSchema>;

/**
 * Valide et extrait reason depuis le body d'une requête
 * 
 * @throws {Error} Si reason manquant ou invalide
 */
export function assertReason(body: unknown): ReasonInput {
  const parsed = ReasonSchema.safeParse(body);
  if (!parsed.success) {
    throw createError(
      'VALIDATION_ERROR',
      'Reason obligatoire pour cette action (min 8 caractères)',
      400,
      parsed.error.flatten()
    );
  }
  return parsed.data;
}

/**
 * Helper pour extraire reason avec fallback
 */
export function getReason(body: unknown): { reason: string; reason_code?: string } {
  try {
    const validated = assertReason(body);
    return {
      reason: validated.reason,
      reason_code: validated.reason_code,
    };
  } catch {
    // Fallback pour compatibilité ascendante
    if (typeof body === 'object' && body !== null && 'reason' in body) {
      const reason = String((body as UnsafeAny).reason || '');
      if (reason.length >= 8) {
        return { reason };
      }
    }
    throw createError('VALIDATION_ERROR', 'Reason obligatoire pour cette action (min 8 caractères)', 400);
  }
}


