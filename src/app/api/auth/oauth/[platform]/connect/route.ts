import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { buildRateLimitKey } from '@/lib/safe-ip';
import { buildAuthUrl, type OAuthPlatform, OAUTH_CONFIG } from '@/lib/oauth/platforms';

const OAUTH_STATE_COOKIE_PREFIX = 'oauth_state_';

function isValidPlatform(value: string): value is OAuthPlatform {
  return value === 'youtube' || value === 'tiktok' || value === 'instagram';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } },
) {
  try {
    const platformParam = params.platform?.toLowerCase();

    if (!platformParam || !isValidPlatform(platformParam)) {
      return NextResponse.json({ ok: false, message: 'Plateforme invalide' }, { status: 400 });
    }

    const { user, error } = await getSession();
    if (error || !user) {
      return NextResponse.json({ ok: false, message: 'Non authentifié' }, { status: 401 });
    }

    const rlKey = buildRateLimitKey(
      `auth:oauth:${platformParam}:connect`,
      user.id,
      req,
    );

    const allowed = await rateLimit({
      key: rlKey,
      route: 'auth:oauth:connect',
      windowMs: 60_000,
      max: 10,
    });

    if (!allowed) {
      return NextResponse.json(
        { ok: false, message: 'Trop de tentatives, réessaie dans une minute.' },
        { status: 429 },
      );
    }

    const origin = new URL(req.url).origin;

    const platform = platformParam satisfies OAuthPlatform;
    const platformConfig = OAUTH_CONFIG[platform];

    if (!platformConfig.clientId || !platformConfig.clientSecret) {
      console.error(
        `[OAuth][${platform}] Missing env vars: clientId or clientSecret`,
      );
      return NextResponse.redirect(
        new URL(
          `/app/onboarding?error=oauth_misconfigured&platform=${platform}`,
          req.url,
        ),
      );
    }

    console.log(`[OAuth][${platform}] Initiating auth flow`);

    const redirectUri = `${origin}/api/auth/oauth/${platform}/callback`;

    const state = crypto.randomUUID();

    const authorizationUrl = buildAuthUrl(platform, state, redirectUri);

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(`${OAUTH_STATE_COOKIE_PREFIX}${platform}`, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 5 * 60, // 5 minutes
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('OAuth connect error', err);
    return NextResponse.json(
      { ok: false, message: 'Erreur lors de la connexion OAuth' },
      { status: 500 },
    );
  }
}

