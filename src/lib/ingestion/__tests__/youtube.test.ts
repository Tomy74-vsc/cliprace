import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractYoutubeId, fetchYoutubeMetrics } from '../youtube';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extractYoutubeId', () => {
  it('extracts from watch?v= URL', () => {
    expect(
      extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be short URL', () => {
    expect(
      extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts from /shorts/ URL', () => {
    expect(
      extractYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('ignores extra query params', () => {
    expect(
      extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=30'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('returns null for invalid URL', () => {
    expect(
      extractYoutubeId('https://tiktok.com/@user/video/123'),
    ).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractYoutubeId('')).toBeNull();
  });
});

describe('fetchYoutubeMetrics', () => {
  it('returns parsed metrics on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              statistics: {
                viewCount: '1500',
                likeCount: '80',
                commentCount: '12',
              },
            },
          ],
        }),
      }),
    );

    const result = await fetchYoutubeMetrics('dQw4w9WgXcQ');
    expect(result.views).toBe(1500);
    expect(result.likes).toBe(80);
    expect(result.comments).toBe(12);
    expect(result.shares).toBe(0);
  });

  it('throws YOUTUBE_VIDEO_NOT_FOUND when items is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      }),
    );

    await expect(fetchYoutubeMetrics('DELETED')).rejects.toThrow(
      'YOUTUBE_VIDEO_NOT_FOUND',
    );
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(fetchYoutubeMetrics('ID')).rejects.toThrow(
      'YOUTUBE_API_HTTP_ERROR',
    );
  });
}
);

