import type { VideoMetrics } from './types';

interface YoutubeApiResponse {
  items?: Array<{
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const id = segments[0];
    return id || null;
  }

  if (host === 'youtube.com') {
    const pathname = parsed.pathname;

    if (pathname.startsWith('/watch')) {
      const v = parsed.searchParams.get('v');
      return v || null;
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'shorts') {
      const id = segments[1];
      return id || null;
    }
  }

  return null;
}

export async function fetchYoutubeMetrics(videoId: string): Promise<VideoMetrics> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_HTTP_ERROR: missing API key');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`YOUTUBE_API_HTTP_ERROR: status ${response.status}`);
    }

    const data = (await response.json()) as YoutubeApiResponse;
    const item = data.items?.[0];
    if (!item) {
      throw new Error('YOUTUBE_VIDEO_NOT_FOUND');
    }
    const stats = item.statistics ?? {};

    const views = Number(stats.viewCount ?? 0);
    const likes = Number(stats.likeCount ?? 0);
    const comments = Number(stats.commentCount ?? 0);

    return {
      views: Number.isFinite(views) ? views : 0,
      likes: Number.isFinite(likes) ? likes : 0,
      comments: Number.isFinite(comments) ? comments : 0,
      shares: 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('YOUTUBE_API_HTTP_ERROR: request aborted');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

