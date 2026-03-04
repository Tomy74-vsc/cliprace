export type OAuthPlatform = 'youtube' | 'tiktok' | 'instagram';

export const OAUTH_CONFIG = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.list'],
    clientId: process.env.TIKTOK_CLIENT_ID!,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    longLivedTokenUrl: 'https://graph.instagram.com/access_token',
    scopes: ['instagram_graph_user_profile', 'instagram_graph_user_media'],
    clientId: process.env.INSTAGRAM_APP_ID!,
    clientSecret: process.env.INSTAGRAM_APP_SECRET!,
  },
} as const;

function getConfig(platform: OAuthPlatform) {
  const config = OAUTH_CONFIG[platform];
  if (!config) {
    throw new Error(`Unsupported OAuth platform: ${platform}`);
  }
  return config;
}

export function buildAuthUrl(
  platform: OAuthPlatform,
  state: string,
  redirectUri: string,
): string {
  const config = getConfig(platform);
  const url = new URL(config.authUrl);

  if (!config.clientId) {
    throw new Error(`Missing clientId for platform ${platform}`);
  }

  switch (platform) {
    case 'youtube': {
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config.scopes.join(' '));
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('include_granted_scopes', 'true');
      url.searchParams.set('state', state);
      break;
    }
    case 'tiktok': {
      url.searchParams.set('client_key', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config.scopes.join(','));
      url.searchParams.set('state', state);
      break;
    }
    case 'instagram': {
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', config.scopes.join(','));
      url.searchParams.set('state', state);
      break;
    }
    default:
      throw new Error(`Unsupported platform: ${platform satisfies never}`);
  }

  return url.toString();
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth HTTP error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function exchangeCodeForTokens(
  platform: OAuthPlatform,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  platform_user_id?: string;
  platform_username?: string;
}> {
  const config = getConfig(platform);

  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing OAuth client configuration for ${platform}`);
  }

  if (platform === 'youtube') {
    type GoogleTokenResponse = {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const token = await fetchJson<GoogleTokenResponse>(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    // Optionally fetch channel info to get user id/handle
    let platform_user_id: string | undefined;
    let platform_username: string | undefined;
    try {
      type ChannelsResponse = {
        items?: Array<{
          id?: string;
          snippet?: { title?: string; customUrl?: string };
        }>;
      };
      const meRes = await fetchJson<ChannelsResponse>(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        },
      );
      const channel = meRes.items?.[0];
      if (channel) {
        platform_user_id = channel.id;
        platform_username = channel.snippet?.customUrl || channel.snippet?.title;
      }
    } catch {
      // best-effort only
    }

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in,
      scope: token.scope,
      platform_user_id,
      platform_username,
    };
  }

  if (platform === 'tiktok') {
    type TikTokTokenResponse = {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      open_id?: string;
      scope?: string;
      token_type?: string;
    };

    const body = new URLSearchParams({
      client_key: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const token = await fetchJson<TikTokTokenResponse>(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    // For now we only store open_id as platform_user_id; username is optional
    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in,
      scope: token.scope,
      platform_user_id: token.open_id,
    };
  }

  if (platform === 'instagram') {
    type InstagramShortLivedResponse = {
      access_token: string;
      user_id: string;
    };

    type InstagramLongLivedResponse = {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const shortLived = await fetchJson<InstagramShortLivedResponse>(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const longLived = await fetchJson<InstagramLongLivedResponse>(
      `${config.longLivedTokenUrl}?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
        config.clientSecret,
      )}&access_token=${encodeURIComponent(shortLived.access_token)}`,
    );

    let platform_username: string | undefined;
    try {
      type MeResponse = {
        id: string;
        username?: string;
      };
      const me = await fetchJson<MeResponse>(
        `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(
          longLived.access_token,
        )}`,
      );
      platform_username = me.username;
    } catch {
      // best-effort only
    }

    return {
      access_token: longLived.access_token,
      refresh_token: undefined,
      expires_in: longLived.expires_in,
      scope: OAUTH_CONFIG.instagram.scopes.join(','),
      platform_user_id: String(shortLived.user_id),
      platform_username,
    };
  }

  throw new Error(`Unsupported OAuth platform: ${platform satisfies never}`);
}

export async function refreshAccessToken(
  platform: OAuthPlatform,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const config = getConfig(platform);

  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing OAuth client configuration for ${platform}`);
  }

  if (platform === 'youtube') {
    type GoogleRefreshResponse = {
      access_token: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const token = await fetchJson<GoogleRefreshResponse>(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    return {
      access_token: token.access_token,
      expires_in: token.expires_in,
    };
  }

  if (platform === 'tiktok') {
    type TikTokRefreshResponse = {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    const body = new URLSearchParams({
      client_key: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const token = await fetchJson<TikTokRefreshResponse>(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in,
    };
  }

  if (platform === 'instagram') {
    type InstagramRefreshResponse = {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    const refreshed = await fetchJson<InstagramRefreshResponse>(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
        refreshToken,
      )}`,
    );

    return {
      access_token: refreshed.access_token,
      expires_in: refreshed.expires_in,
    };
  }

  throw new Error(`Unsupported OAuth platform: ${platform satisfies never}`);
}

