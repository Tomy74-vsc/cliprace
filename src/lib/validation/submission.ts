import { z } from 'zod';

// Platform enum validation
export const platformSchema = z.enum(['youtube', 'tiktok', 'instagram', 'facebook']);

// Submission creation schema
export const createSubmissionSchema = z.object({
  video_url: z.string().url('Invalid video URL format'),
  platform: platformSchema.optional(), // Will be auto-detected if not provided
  platform_video_id: z.string().optional(), // Will be auto-extracted if not provided
  meta: z.record(z.string(), z.any()).optional().default({})
});

// Signature schema
export const signSubmissionSchema = z.object({
  accept_terms: z.boolean().refine(val => val === true, {
    message: 'Terms must be accepted to sign the contract'
  }),
  legal_name: z.string().min(2, 'Legal name must be at least 2 characters').max(100, 'Legal name too long')
});

// Response schemas
export const submissionResponseSchema = z.object({
  submission_id: z.string().uuid(),
  contract_url: z.string().url(),
  next_steps: z.array(z.string())
});

export const signatureResponseSchema = z.object({
  submission_id: z.string().uuid(),
  status: z.enum(['submitted', 'pending_automod']),
  signed_at: z.string().datetime(),
  contract_url: z.string().url()
});

// Platform URL patterns for auto-detection
export const PLATFORM_PATTERNS = {
  youtube: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ],
  tiktok: [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/([a-zA-Z0-9]+)/
  ],
  instagram: [
    /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/
  ],
  facebook: [
    /facebook\.com\/.*\/videos\/(\d+)/,
    /facebook\.com\/watch\/\?v=(\d+)/,
    /fb\.watch\/([a-zA-Z0-9]+)/
  ]
} as const;

// Extract platform video ID from URL
export function extractPlatformVideoId(url: string, platform: string): string | null {
  const patterns = PLATFORM_PATTERNS[platform as keyof typeof PLATFORM_PATTERNS];
  if (!patterns) return null;

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Auto-detect platform from URL
export function detectPlatformFromUrl(url: string): 'youtube' | 'tiktok' | 'instagram' | 'facebook' | null {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return platform as 'youtube' | 'tiktok' | 'instagram' | 'facebook';
      }
    }
  }
  return null;
}
