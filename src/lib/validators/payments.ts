// Source: Validation Zod pour paiements (§19, §520-521)
import { z } from 'zod';

export const cashoutSchema = z.object({
  amount_cents: z.number().int().min(1, 'Le montant doit être supérieur à 0'),
});

export const brandFundSchema = z.object({
  contest_id: z.string().uuid('ID de concours invalide'),
});

export type CashoutInput = z.infer<typeof cashoutSchema>;
export type BrandFundInput = z.infer<typeof brandFundSchema>;

