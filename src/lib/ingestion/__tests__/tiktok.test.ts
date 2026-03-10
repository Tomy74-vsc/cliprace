import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTiktokMetrics } from '../tiktok';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTiktokMetrics', () => {
  it('returns parsed metrics on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          data: {
            play_count: 15000,
            digg_count: 820,
            comment_count: 43,
            share_count: 12,
          },
        }),
      }),
    );
    const result = await fetchTiktokMetrics(
      'https://tiktok.com/@user/video/123',
    );
    expect(result.views).toBe(15000);
    expect(result.likes).toBe(820);
    expect(result.comments).toBe(43);
    expect(result.shares).toBe(12);
  });

  it('throws TIKTOK_RATE_LIMIT on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );
    await expect(
      fetchTiktokMetrics('https://tiktok.com/@u/video/1'),
    ).rejects.toThrow('TIKTOK_RATE_LIMIT');
  });

  it('throws TIKTOK_VIDEO_UNAVAILABLE on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(
      fetchTiktokMetrics('https://tiktok.com/@u/video/1'),
    ).rejects.toThrow('TIKTOK_VIDEO_UNAVAILABLE');
  });

  it('throws TIKTOK_VIDEO_UNAVAILABLE when code !== 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: -1, msg: 'video not found' }),
      }),
    );
    await expect(
      fetchTiktokMetrics('https://tiktok.com/@u/video/1'),
    ).rejects.toThrow('TIKTOK_VIDEO_UNAVAILABLE');
  });

  it('throws TIKTOK_VIDEO_UNAVAILABLE when all metrics are zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 0,
          data: {
            play_count: 0,
            digg_count: 0,
            comment_count: 0,
            share_count: 0,
          },
        }),
      }),
    );
    await expect(
      fetchTiktokMetrics('https://tiktok.com/@u/video/1'),
    ).rejects.toThrow('TIKTOK_VIDEO_UNAVAILABLE');
  });

  it('throws TIKTOK_TIMEOUT on AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('aborted'), { name: 'AbortError' }),
        ),
    );
    await expect(
      fetchTiktokMetrics('https://tiktok.com/@u/video/1'),
    ).rejects.toThrow('TIKTOK_TIMEOUT');
  });
});

