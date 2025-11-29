// Source: Validation Zod pour concours
import { z } from 'zod';

const prizeRangeSchema = z
  .object({
    rank_from: z.number().int().min(1),
    rank_to: z.number().int().min(1).optional(),
    amount_cents: z.number().int().min(0).optional(),
    percentage: z.number().min(0).max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.amount_cents === undefined || value.amount_cents === null) &&
      (value.percentage === undefined || value.percentage === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amount_cents ou percentage doit être renseigné',
        path: ['amount_cents'],
      });
    }

    if (value.rank_to !== undefined && value.rank_to < value.rank_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rank_to doit être supérieur ou égal à rank_from',
        path: ['rank_to'],
      });
    }
  });

const contestAssetSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video', 'pdf']).default('image'),
});

export const contestCreateSchema = z
  .object({
    title: z.string().min(1).max(120, 'Le titre ne peut pas dépasser 120 caractères'),
    brief_md: z.string().min(1).max(5000, 'Le brief ne peut pas dépasser 5000 caractères'),
    cover_url: z.string().url().optional(),
    allowed_platforms: z
      .object({
        tiktok: z.boolean().optional(),
        instagram: z.boolean().optional(),
        youtube: z.boolean().optional(),
      })
      .optional(),
    visibility: z.enum(['public', 'unlisted']).default('public'),
    start_at: z.string().datetime(), // ISO 8601
    end_at: z.string().datetime(),
    min_followers: z.number().int().min(0).optional(),
    min_views: z.number().int().min(0).optional(),
    country: z.string().length(2).optional(), // ISO 3166-1 alpha-2
    category: z.string().max(50).optional(),
    total_prize_pool_cents: z.number().int().min(0),
    prizes: z.array(prizeRangeSchema).max(30).optional(),
    assets: z.array(contestAssetSchema).max(10).optional(),
    terms_markdown: z.string().max(20000).optional(),
    terms_url: z.string().url().optional(),
    terms_version: z.string().max(64).optional(),
    currency: z.string().length(3).default('EUR'),
    brand_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => new Date(data.end_at) > new Date(data.start_at),
    { message: 'La date de fin doit être après la date de début', path: ['end_at'] }
  )
  .refine(
    (data) => {
      if (!data.prizes) return true;
      const total = data.prizes.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
      return total <= data.total_prize_pool_cents;
    },
    { message: 'La somme des prix ne peut pas dépasser le total du prize pool', path: ['prizes'] }
  );

export const contestUpdateSchema = contestCreateSchema.partial();

export type ContestCreateInput = z.infer<typeof contestCreateSchema>;
export type ContestUpdateInput = z.infer<typeof contestUpdateSchema>;

