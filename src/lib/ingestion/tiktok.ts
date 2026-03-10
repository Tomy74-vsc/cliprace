import type { VideoMetrics } from '@/lib/ingestion/types';

interface TiktokApiResponse {
  code?: number;
  msg?: string;
  data?: {
    play_count?: number;
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
  };
}

export async function fetchTiktokMetrics(
  videoUrl: string,
): Promise<VideoMetrics> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('TIKTOK_API_HTTP_ERROR: missing API key');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const encodedUrl = encodeURIComponent(videoUrl);
    const endpoint = `https://tiktok-scraper7.p.rapidapi.com/video/info?url=${encodedUrl}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'tiktok-scraper7.p.rapidapi.com',
      },
    });

    if (response.status === 429) {
      throw new Error('TIKTOK_RATE_LIMIT');
    }

    if (response.status === 404) {
      throw new Error('TIKTOK_VIDEO_UNAVAILABLE');
    }

    if (!response.ok) {
      throw new Error(`TIKTOK_API_HTTP_ERROR: status ${response.status}`);
    }

    const data = (await response.json()) as TiktokApiResponse;

    if (data.code !== 0) {
      throw new Error('TIKTOK_VIDEO_UNAVAILABLE');
    }

    if (!data.data) {
      throw new Error('TIKTOK_VIDEO_UNAVAILABLE');
    }

    const views = data.data.play_count ?? 0;
    const likes = data.data.digg_count ?? 0;
    const comments = data.data.comment_count ?? 0;
    const shares = data.data.share_count ?? 0;

    if (views === 0 && likes === 0 && comments === 0) {
      throw new Error('TIKTOK_VIDEO_UNAVAILABLE');
    }

    return {
      views,
      likes,
      comments,
      shares,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIKTOK_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

