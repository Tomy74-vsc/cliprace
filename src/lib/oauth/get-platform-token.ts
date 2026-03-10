import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from './encryption';
import { OAuthPlatform, refreshAccessToken } from './platforms';

type PlatformTokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

type PlatformAccountWithToken = {
  id: string;
  platform_oauth_tokens: PlatformTokenRow | PlatformTokenRow[] | null;
};

export async function getPlatformToken(
  userId: string,
  platform: OAuthPlatform,
): Promise<string | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('platform_accounts')
    .select('id, platform_oauth_tokens(access_token, refresh_token, expires_at)')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single<PlatformAccountWithToken>();

  if (error || !data) {
    console.error('getPlatformToken: failed to load platform account', error);
    return null;
  }

  const tokensRaw = data.platform_oauth_tokens;
  const tokenRow: PlatformTokenRow | null = Array.isArray(tokensRaw)
    ? tokensRaw[0] ?? null
    : tokensRaw;

  if (!tokenRow) {
    return null;
  }

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;

  let encryptedAccessToken = tokenRow.access_token;
  let encryptedRefreshToken = tokenRow.refresh_token;

  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() <= bufferMs;

  if (needsRefresh) {
    if (!encryptedRefreshToken) {
      return null;
    }

    try {
      const refreshToken = await decryptToken(encryptedRefreshToken);
      const refreshed = await refreshAccessToken(platform, refreshToken);

      encryptedAccessToken = await encryptToken(refreshed.access_token);

      if (refreshed.refresh_token) {
        encryptedRefreshToken = await encryptToken(refreshed.refresh_token);
      }

      const newExpiresAt =
        typeof refreshed.expires_in === 'number'
          ? new Date(now.getTime() + refreshed.expires_in * 1000).toISOString()
          : null;

      const { error: updateError } = await admin
        .from('platform_oauth_tokens')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', data.id);

      if (updateError) {
        console.error('getPlatformToken: failed to update refreshed token', updateError);
      }
    } catch (err) {
      console.error('getPlatformToken: failed to refresh token', err);
      return null;
    }
  }

  try {
    return await decryptToken(encryptedAccessToken);
  } catch (err) {
    console.error('getPlatformToken: failed to decrypt access token', err);
    return null;
  }
}

