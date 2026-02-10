// Source: Validation Zod pour concours
import { z } from 'zod';
import {
  contestTypeEnum,
  productDetailsSchema,
  shippingInfoSchema,
} from './contest-wizard';

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
        message: 'amount_cents ou percentage doit Ãªtre renseignÃ©',
        path: ['amount_cents'],
      });
    }

    if (value.rank_to !== undefined && value.rank_to < value.rank_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rank_to doit Ãªtre supÃ©rieur ou Ã©gal Ã  rank_from',
        path: ['rank_to'],
      });
    }
  });

const contestAssetSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video', 'pdf']).default('image'),
});


// SchÃ©ma de base sans les refinements (pour pouvoir utiliser .partial())
const contestCreateBaseSchema = z.object({
  title: z.string().min(1).max(120, 'Le titre ne peut pas dÃ©passer 120 caractÃ¨res'),
  brief_md: z.string().min(1).max(5000, 'Le brief ne peut pas dÃ©passer 5000 caractÃ¨res'),
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

  // Nouveau modèle cash vs produit
  contest_type: contestTypeEnum.default('cash'),
  product_details: productDetailsSchema.optional(),
  shipping_info: shippingInfoSchema.optional(),

  // Pour compatibilité, on garde total_prize_pool_cents comme champ principal de pool cash
  total_prize_pool_cents: z.number().int().min(0),
  // Frais plateforme (en cents) pour les concours produit
  platform_fee: z.number().int().min(0).default(0),

  prizes: z.array(prizeRangeSchema).max(30).optional(),
  assets: z.array(contestAssetSchema).max(10).optional(),
  terms_markdown: z.string().max(20000).optional(),
  terms_url: z.string().url().optional(),
  terms_version: z.string().max(64).optional(),
  currency: z.string().length(3).default('EUR'),
  brand_id: z.string().uuid().optional(),
  // TODO: ajouter colonne product_brief JSONB dans la table contests
  // product_brief: productBriefSchema,
});

// SchÃ©ma de crÃ©ation avec validations supplÃ©mentaires
export const contestCreateSchema = contestCreateBaseSchema
  .refine(
    (data) => new Date(data.end_at) > new Date(data.start_at),
    { message: 'La date de fin doit Ãªtre aprÃ¨s la date de dÃ©but', path: ['end_at'] }
  )
  .superRefine((data, ctx) => {
    // RÃ¨gles spÃ©cifiques par type de concours
    if (data.contest_type === 'cash') {
      if (data.total_prize_pool_cents < 100 * 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le montant du lot cash doit Ãªtre au moins de 100€',
          path: ['total_prize_pool_cents'],
        });
      }
    }

    if (data.contest_type === 'product') {
      if (!data.product_details) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Les dÃ©tails du produit sont requis pour un concours produit',
          path: ['product_details'],
        });
      }
      if (!data.shipping_info) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Les informations de livraison sont requises pour un concours produit',
          path: ['shipping_info'],
        });
      }
      if ((data.platform_fee ?? 0) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Les frais plateforme doivent Ãªtre supÃ©rieurs Ã  0 pour un concours produit',
          path: ['platform_fee'],
        });
      }
    }

    // CohÃ©rence prize pool / prizes pour les concours cash
    if (data.contest_type === 'cash' && data.prizes && data.prizes.length > 0) {
      const total = data.prizes.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
      if (total > data.total_prize_pool_cents) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La somme des prix ne peut pas dÃ©passer le total du prize pool',
          path: ['prizes'],
        });
      }
    }
  });

// SchÃ©ma de mise Ã  jour : tous les champs sont optionnels
export const contestUpdateSchema = contestCreateBaseSchema.partial();

export type ContestCreateInput = z.infer<typeof contestCreateSchema>;
export type ContestUpdateInput = z.infer<typeof contestUpdateSchema>;

