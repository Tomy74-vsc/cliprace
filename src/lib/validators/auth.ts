import { z } from 'zod';

// Signup schema used both on client (form validation) and server (API payload).
// - Client: includes passwordConfirm (string, default "") for confirmation.
// - Server: le client ne renvoie pas passwordConfirm, donc le champ doit être optionnel.
const signupSchemaBase = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial'),
  // Optionnel côté serveur (le client ne l'envoie pas),
  // mais présent côté client avec valeur par défaut "" pour la validation.
  passwordConfirm: z.string().min(1, 'La confirmation du mot de passe est requise').optional(),
  role: z.enum(['creator', 'brand']),
  profileFields: z
    .object({
      display_name: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).optional(),
      country: z.string().length(2).optional(),
      username: z.string().min(2).max(50).optional(),
      primary_platform: z.enum(['tiktok', 'instagram', 'youtube']).optional(),
      company_name: z.string().min(1).max(200).optional(),
      vat_number: z.string().max(50).optional(),
    })
    .optional(),
});

export const signupSchema = signupSchemaBase.refine(
  (data) =>
    // Côté client, passwordConfirm est une string ("" ou plus) et on impose l'égalité.
    // Côté serveur, il est undefined et on ne bloque pas.
    data.passwordConfirm === undefined || data.password === data.passwordConfirm,
  {
    message: 'Les mots de passe ne correspondent pas',
    path: ['passwordConfirm'],
  }
);
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Le mot de passe est requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileCompleteSchema = z.object({
  bio: z
    .string()
    .min(5, 'La bio doit contenir au moins 5 caractères')
    .max(500, 'La bio est trop longue'),
  // creator
  username: z.string().min(2).max(50).optional(),
  primary_platform: z.enum(['tiktok', 'instagram', 'youtube']).optional(),
  followers: z.number().int().min(0).optional(),
  avg_views: z.number().int().min(0).optional(),
  platform_links: z
    .object({
      tiktok: z.string().max(255).optional(),
      instagram: z.string().max(255).optional(),
      youtube: z.string().max(255).optional(),
    })
    .partial()
    .optional(),
  // brand
  company_name: z.string().min(1).max(200).optional(),
  vat_number: z.string().max(50).optional(),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  address_city: z.string().max(120).optional(),
  address_postal_code: z.string().max(30).optional(),
  address_country: z.string().length(2).optional(),
});
export type ProfileCompleteInput = z.infer<typeof profileCompleteSchema>;

