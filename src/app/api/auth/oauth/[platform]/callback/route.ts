import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/oauth/encryption';
import {
  exchangeCodeForTokens,
  type OAuthPlatform,
} from '@/lib/oauth/platforms';

const OAUTH_STATE_COOKIE_PREFIX = 'oauth_state_';

function isValidPlatform(value: string): value is OAuthPlatform {
  return value === 'youtube' || value === 'tiktok' || value === 'instagram';
}

function buildOnboardingUrl(origin: string, platform: OAuthPlatform, params: URLSearchParams) {
  const url = new URL(`/app/creator/onboarding`, origin);
  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function buildSettingsUrl(origin: string, platform: OAuthPlatform, params: URLSearchParams) {
  const url = new URL(`/app/creator/settings/platforms`, origin);
  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function clearStateCookie(
  res: NextResponse,
  platform: OAuthPlatform,
) {
  res.cookies.set(`${OAUTH_STATE_COOKIE_PREFIX}${platform}`, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } },
) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const origin = url.origin;

  const platformParamRaw = params.platform?.toLowerCase();

  const providerError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (providerError) {
    const platformForLog = isValidPlatform(platformParamRaw ?? '')
      ? (platformParamRaw as OAuthPlatform)
      : 'unknown';

    console.error(
      `[OAuth][${platformForLog}] Provider error: ${providerError} — ${errorDescription ?? ''}`,
    );

    const redirectUrl = new URL(
      `/app/creator/onboarding?error=oauth_provider_error&platform=${encodeURIComponent(
        platformForLog,
      )}&reason=${encodeURIComponent(providerError)}`,
      origin,
    );

    return NextResponse.redirect(redirectUrl.toString());
  }

  const platformParam = platformParamRaw;
  if (!platformParam || !isValidPlatform(platformParam)) {
    return NextResponse.redirect(
      `${origin}/app/creator/onboarding?error=oauth_failed`,
    );
  }

  const platform = platformParam;

  const code = url.searchParams.get('code');
  const state = searchParams.get('state');

  const stateCookieName = `${OAUTH_STATE_COOKIE_PREFIX}${platform}`;
  const storedState = req.cookies.get(stateCookieName)?.value;

  const errorParams = new URLSearchParams({
    error: 'oauth_failed',
    platform,
  });

  if (!state || !storedState || state !== storedState) {
    const res = NextResponse.redirect(
      buildOnboardingUrl(origin, platform, errorParams),
    );
    clearStateCookie(res, platform);
    return res;
  }

  if (!code) {
    const res = NextResponse.redirect(
      buildOnboardingUrl(origin, platform, errorParams),
    );
    clearStateCookie(res, platform);
    return res;
  }

  const { user, error: sessionError } = await getSession();
  if (sessionError || !user) {
    const res = NextResponse.redirect(
      buildOnboardingUrl(origin, platform, errorParams),
    );
    clearStateCookie(res, platform);
    return res;
  }

  try {
    const redirectUri = `${origin}/api/auth/oauth/${platform}/callback`;
    const tokens = await exchangeCodeForTokens(platform, code, redirectUri);

    const admin = getSupabaseAdmin();

    const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
      encryptToken(tokens.access_token),
      tokens.refresh_token ? encryptToken(tokens.refresh_token) : Promise.resolve<string | null>(null),
    ]);

    const expiresAt =
      typeof tokens.expires_in === 'number'
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

    const scopesArray = tokens.scope
      ? tokens.scope.split(/[ ,]/).filter(Boolean)
      : [];

    const { data: account, error: accountError } = await admin
      .from('platform_accounts')
      .upsert(
        {
          user_id: user.id,
          platform,
          platform_user_id: tokens.platform_user_id ?? null,
          handle: tokens.platform_username ?? null,
        },
        {
          onConflict: 'user_id,platform',
        },
      )
      .select('id')
      .single();

    if (accountError || !account) {
      console.error(
        `[OAuth][${platform}] Callback failed: upsert platform_accounts`,
        accountError,
      );
      const res = NextResponse.redirect(
        buildOnboardingUrl(origin, platform, errorParams),
      );
      clearStateCookie(res, platform);
      return res;
    }

    const { error: tokenError } = await admin.from('platform_oauth_tokens').upsert(
      {
        account_id: account.id,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: expiresAt,
        scopes: scopesArray,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'account_id',
      },
    );

    if (tokenError) {
      console.error(
        `[OAuth][${platform}] Callback failed: upsert platform_oauth_tokens`,
        tokenError,
      );
      const res = NextResponse.redirect(
        buildOnboardingUrl(origin, platform, errorParams),
      );
      clearStateCookie(res, platform);
      return res;
    }

    const successParams = new URLSearchParams({
      connected: 'true',
      platform,
    });

    const targetUrl = user.onboarding_complete
      ? buildSettingsUrl(origin, platform, successParams)
      : buildOnboardingUrl(origin, platform, successParams);

    const res = NextResponse.redirect(targetUrl);
    clearStateCookie(res, platform);
    return res;
  } catch (err) {
    console.error(`[OAuth][${platform}] Callback failed:`, err);
    const res = NextResponse.redirect(
      buildOnboardingUrl(origin, platform, errorParams),
    );
    clearStateCookie(res, platform);
    return res;
  }
}

