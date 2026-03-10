export type VideoMetrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type PlatformErrorCode =
  | 'TOKEN_EXPIRED'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'VIDEO_NOT_FOUND'
  | 'API_ERROR';

export class PlatformApiError extends Error {
  code: PlatformErrorCode;
  status?: number;

  constructor(code: PlatformErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function handleApiResponse(
  res: Response,
  provider: string,
): Promise<unknown> {
  if (res.ok) {
    return parseJsonSafe(res);
  }

  const status = res.status;
  const body = await res.text().catch(() => '');
  const baseMessage = body || res.statusText || 'Erreur API distante';

  if (status === 401) {
    throw new PlatformApiError(
      'TOKEN_EXPIRED',
      `${provider}: token expiré ou invalide (${baseMessage})`,
      status,
    );
  }

  if (status === 403) {
    throw new PlatformApiError(
      'AUTH_ERROR',
      `${provider}: accès refusé (${baseMessage})`,
      status,
    );
  }

  if (status === 404) {
    throw new PlatformApiError(
      'VIDEO_NOT_FOUND',
      `${provider}: contenu introuvable (${baseMessage})`,
      status,
    );
  }

  if (status === 429) {
    throw new PlatformApiError(
      'RATE_LIMIT',
      `${provider}: limite de taux atteinte (${baseMessage})`,
      status,
    );
  }

  throw new PlatformApiError(
    'API_ERROR',
    `${provider}: erreur API (${status}) ${baseMessage}`,
    status,
  );
}

export async function fetchYouTubeMetrics(
  videoId: string,
  accessToken: string,
): Promise<VideoMetrics> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'statistics');
  url.searchParams.set('id', videoId);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const json = (await handleApiResponse(res, 'YouTube')) as {
    items?: Array<{ statistics?: Record<string, string | number> }>;
  } | null;

  const stats = json?.items?.[0]?.statistics;
  if (!stats) {
    throw new PlatformApiError(
      'VIDEO_NOT_FOUND',
      'YouTube: statistiques vidéo introuvables',
    );
  }

  const views = Number(stats.viewCount ?? stats.views ?? 0);
  const likes = Number(stats.likeCount ?? stats.likes ?? 0);
  const comments = Number(stats.commentCount ?? stats.comments ?? 0);

  return {
    views: Number.isFinite(views) ? views : 0,
    likes: Number.isFinite(likes) ? likes : 0,
    comments: Number.isFinite(comments) ? comments : 0,
    shares: 0,
  };
}

export async function fetchTikTokMetrics(
  videoId: string,
  accessToken: string,
): Promise<VideoMetrics> {
  const url = 'https://open.tiktokapis.com/v2/video/query/';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      filters: { video_ids: [videoId] },
      fields: ['view_count', 'like_count', 'comment_count', 'share_count'],
    }),
  });

  const json = (await handleApiResponse(res, 'TikTok')) as
    | {
        data?: {
          videos?: Array<{
            statistics?: Record<string, number>;
          }>;
        };
      }
    | null;

  const video = json?.data?.videos?.[0] ?? json?.data?.video_list?.[0];
  const stats = video?.statistics;

  if (!stats) {
    throw new PlatformApiError(
      'VIDEO_NOT_FOUND',
      'TikTok: statistiques vidéo introuvables',
    );
  }

  const views = Number(stats.view_count ?? 0);
  const likes = Number(stats.like_count ?? 0);
  const comments = Number(stats.comment_count ?? 0);
  const shares = Number(stats.share_count ?? 0);

  return {
    views: Number.isFinite(views) ? views : 0,
    likes: Number.isFinite(likes) ? likes : 0,
    comments: Number.isFinite(comments) ? comments : 0,
    shares: Number.isFinite(shares) ? shares : 0,
  };
}

export async function fetchInstagramMetrics(
  mediaId: string,
  accessToken: string,
): Promise<VideoMetrics> {
  const url = new URL(`https://graph.instagram.com/${encodeURIComponent(mediaId)}`);
  url.searchParams.set('fields', 'like_count,comments_count,video_views,media_type');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const json = (await handleApiResponse(res, 'Instagram')) as
    | {
        like_count?: number;
        comments_count?: number;
        video_views?: number;
      }
    | null;

  if (!json) {
    throw new PlatformApiError(
      'VIDEO_NOT_FOUND',
      'Instagram: métriques média introuvables',
    );
  }

  const views = Number(json.video_views ?? 0);
  const likes = Number(json.like_count ?? 0);
  const comments = Number(json.comments_count ?? 0);

  return {
    views: Number.isFinite(views) ? views : 0,
    likes: Number.isFinite(likes) ? likes : 0,
    comments: Number.isFinite(comments) ? comments : 0,
    shares: 0,
  };
}

