export type VideoIdResult =
  | { ok: true; videoId: string }
  | { ok: false; error: string };

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isValidId(id: string, minLength = 5): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id) && id.length >= minLength;
}

export function extractYouTubeVideoId(url: string): VideoIdResult {
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return { ok: false, error: 'URL YouTube invalide' };
  }

  const host = parsed.hostname.toLowerCase();
  let id: string | null = null;

  if (host === 'youtu.be') {
    const segments = parsed.pathname.split('/').filter(Boolean);
    id = segments[0] ?? null;
  } else if (host.endsWith('youtube.com')) {
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);

    if (pathname.startsWith('/watch')) {
      id = parsed.searchParams.get('v');
    } else if (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'v') {
      id = segments[1] ?? null;
    }
  }

  if (!id || !isValidId(id, 8)) {
    return { ok: false, error: "Impossible de déterminer l'ID vidéo YouTube" };
  }

  return { ok: true, videoId: id };
}

export function extractTikTokVideoId(url: string): VideoIdResult {
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return { ok: false, error: 'URL TikTok invalide' };
  }

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  // Short links: https://vm.tiktok.com/SHORT_CODE
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    const code = segments[0] ?? null;
    if (!code || !isValidId(code, 4)) {
      return { ok: false, error: "Impossible de déterminer le code vidéo TikTok" };
    }
    return { ok: true, videoId: code };
  }

  // Standard links: https://www.tiktok.com/@user/video/VIDEO_ID
  if (host.endsWith('tiktok.com')) {
    const videoIndex = segments.findIndex((seg) => seg === 'video');
    if (videoIndex !== -1 && segments[videoIndex + 1]) {
      const id = segments[videoIndex + 1];
      if (!/^\d{5,}$/.test(id)) {
        return { ok: false, error: "ID vidéo TikTok introuvable" };
      }
      return { ok: true, videoId: id };
    }
  }

  return { ok: false, error: "Impossible de déterminer l'ID vidéo TikTok" };
}

export function extractInstagramMediaId(url: string): VideoIdResult {
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return { ok: false, error: 'URL Instagram invalide' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith('instagram.com')) {
    return { ok: false, error: 'Domaine Instagram invalide' };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, error: 'Chemin Instagram invalide' };
  }

  const [type, code] = segments;
  if ((type === 'reel' || type === 'p') && code && isValidId(code, 5)) {
    return { ok: true, videoId: code };
  }

  return { ok: false, error: "Impossible de déterminer l'ID media Instagram" };
}

