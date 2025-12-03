// Source: Validation pour mise à jour du profil (phase 2 settings)
import { z } from 'zod';

export const notificationEventOptions = ['submission_approved', 'submission_rejected', 'message_new'] as const;
export const notificationChannelOptions = ['email', 'inapp'] as const;

const notificationPreferenceSchema = z.object({
  event: z.enum(notificationEventOptions),
  channel: z.enum(notificationChannelOptions),
  enabled: z.boolean(),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().min(2).max(80, 'Le nom doit contenir moins de 80 caractères'),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  first_name: z.string().max(80).nullable().optional(),
  last_name: z.string().max(80).nullable().optional(),
  handle: z.string().max(60).nullable().optional(),
  primary_platform: z.enum(['tiktok', 'instagram', 'youtube']).optional(),
  followers: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  avg_views: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  notification_preferences: z.array(notificationPreferenceSchema).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

// Brand profile update schema
export const brandProfileUpdateSchema = z.object({
  display_name: z.string().min(2).max(80, 'Le nom doit contenir moins de 80 caractères'),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  company_name: z.string().min(1).max(200, 'Le nom de l\'entreprise doit contenir moins de 200 caractères'),
  website: z
    .string()
    .refine((val) => val === '' || z.string().url().safeParse(val).success, {
      message: 'URL invalide',
    })
    .transform((val) => (val === '' ? null : val))
    .nullable()
    .optional(),
  industry: z.string().max(100).nullable().optional(),
  vat_number: z.string().max(50).nullable().optional(),
  address_line1: z.string().max(200).nullable().optional(),
  address_line2: z.string().max(200).nullable().optional(),
  address_city: z.string().max(120).nullable().optional(),
  address_postal_code: z.string().max(30).nullable().optional(),
  address_country: z.string().length(2).nullable().optional(),
  notification_preferences: z.array(notificationPreferenceSchema).optional(),
});

export type BrandProfileUpdateInput = z.infer<typeof brandProfileUpdateSchema>;
