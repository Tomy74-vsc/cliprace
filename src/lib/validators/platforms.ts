// Source: Validation URLs vidéo par plateforme (§19, §523-552)
export type Platform = 'tiktok' | 'instagram' | 'youtube';

export const PLATFORM_URL_PATTERNS = {
  tiktok: /^https:\/\/(www\.)?(tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com\/[\w-]+)/,
  instagram: /^https:\/\/(www\.)?instagram\.com\/(reel|p)\/[\w-]+\/?/,
  youtube: /^https:\/\/(www\.)?(youtube\.com\/shorts\/[\w-]+|youtu\.be\/[\w-]+)/,
} as const;

export function validateVideoUrl(url: string, platform: Platform): boolean {
  const pattern = PLATFORM_URL_PATTERNS[platform];
  if (!pattern) return false;
  return pattern.test(url);
}

// Helper pour extraire l'ID vidéo depuis l'URL (optionnel)
export function extractVideoId(url: string, platform: Platform): string | null {
  if (!validateVideoUrl(url, platform)) return null;
  
  switch (platform) {
    case 'tiktok':
      const tiktokMatch = url.match(/\/video\/(\d+)/);
      return tiktokMatch ? tiktokMatch[1] : null;
    case 'instagram':
      const instagramMatch = url.match(/\/(reel|p)\/([\w-]+)/);
      return instagramMatch ? instagramMatch[2] : null;
    case 'youtube':
      const youtubeMatch = url.match(/(?:shorts\/|youtu\.be\/)([\w-]+)/);
      return youtubeMatch ? youtubeMatch[1] : null;
    default:
      return null;
  }
}

