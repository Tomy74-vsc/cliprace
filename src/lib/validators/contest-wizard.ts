import { z } from 'zod';

export const contestTypeEnum = z.enum(['cash', 'product']);

export const productDetailsSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis'),
  value: z.number().int().min(0, 'La valeur perçue doit être positive'),
  image_url: z.string().url('URL d’image invalide'),
  brand_url: z.string().url('URL de marque invalide').optional(),
});

export const shippingInfoSchema = z.object({
  shipping_type: z.literal('brand_managed'),
  regions: z.array(z.string().min(2)).min(1, 'Au moins une région est requise'),
});

// Étape 1 : type de concours + produit éventuel
export const step1Schema = z.object({
  contest_type: contestTypeEnum,
  product_details: productDetailsSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.contest_type === 'product' && !data.product_details) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['product_details'],
      message: 'Les détails du produit sont requis pour un concours produit',
    });
  }
});

// Étape 2 : brief / contenu créatif
export const step2Schema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),
});

// Étape 3 : récompense
export const step3Schema = z.object({
  contest_type: contestTypeEnum,
  prize_amount: z.number().int().min(0).optional(), // en cents
  shipping_info: shippingInfoSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.contest_type === 'cash') {
    if (data.prize_amount === undefined || data.prize_amount < 100 * 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prize_amount'],
        message: 'Le montant du lot cash doit être au moins de 100€',
      });
    }
  }

  if (data.contest_type === 'product') {
    if (!data.shipping_info) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shipping_info'],
        message: 'Les informations de livraison sont requises pour un concours produit',
      });
    }
  }
});

// Étape 4 : règles (dates + plateformes)
export const step4Schema = z.object({
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube'])).min(1, 'Au moins une plateforme est requise'),
}).superRefine((data, ctx) => {
  const now = new Date();
  const start = new Date(data.start_at);
  const end = new Date(data.end_at);

  if (isNaN(start.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_at'],
      message: 'Date de début invalide',
    });
  } else if (start <= now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_at'],
      message: 'La date de début doit être dans le futur',
    });
  }

  if (isNaN(end.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_at'],
      message: 'Date de fin invalide',
    });
  } else if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_at'],
      message: 'La date de fin doit être après la date de début',
    });
  }
});

// Schéma global du wizard
export const wizardSchema = z.object({
  // Étape 1
  contest_type: contestTypeEnum,
  product_details: productDetailsSchema.optional(),

  // Étape 2
  title: z.string(),
  description: z.string(),

  // Étape 3
  prize_amount: z.number().int().optional(),
  shipping_info: shippingInfoSchema.optional(),

  // Étape 4
  start_at: z.string(),
  end_at: z.string(),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube'])),
});

export type ContestWizardData = z.infer<typeof wizardSchema>;

