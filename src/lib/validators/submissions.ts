// Source: Validation Zod pour soumissions (§19, §514-515)
import { z } from 'zod';
import { validateVideoUrl } from './platforms';

export const submissionCreateSchema = z
  .object({
    contest_id: z.string().uuid('ID de concours invalide'),
    platform: z.enum(['tiktok', 'instagram', 'youtube'], {
      errorMap: () => ({ message: 'La plateforme doit être tiktok, instagram ou youtube' }),
    }),
    video_url: z.string().url('URL invalide'),
    caption: z.string().max(2200, 'La description ne peut pas dépasser 2200 caractères').optional(),
  })
  .superRefine((value, ctx) => {
    if (!validateVideoUrl(value.video_url, value.platform)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL invalide pour cette plateforme',
        path: ['video_url'],
      });
    }
  });

export const moderateSubmissionSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'Le statut doit être "approved" ou "rejected"' }),
  }),
  note: z.string().max(500, 'La note ne peut pas dépasser 500 caractères').optional(),
});

export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>;
export type ModerateSubmissionInput = z.infer<typeof moderateSubmissionSchema>;

