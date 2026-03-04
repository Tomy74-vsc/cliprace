import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { rateLimit } from '@/lib/rateLimit';
import { assertCsrf } from '@/lib/csrf';
import { buildRateLimitKey } from '@/lib/safe-ip';
import type { OAuthPlatform } from '@/lib/oauth/platforms';

function isValidPlatform(value: string): value is OAuthPlatform {
  return value === 'youtube' || value === 'tiktok' || value === 'instagram';
}

export async function POST(
  req: NextRequest,
  { params }: { params: { platform: string } },
) {
  try {
    const platformParam = params.platform?.toLowerCase();

    if (!platformParam || !isValidPlatform(platformParam)) {
      return NextResponse.json({ ok: false, message: 'Plateforme invalide' }, { status: 400 });
    }

    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      return NextResponse.json(
        { ok: false, message: 'Token CSRF invalide' },
        { status: 403 },
      );
    }

    const { user, error } = await getSession();
    if (error || !user) {
      return NextResponse.json({ ok: false, message: 'Non authentifié' }, { status: 401 });
    }

    const rlKey = buildRateLimitKey(
      `auth:oauth:${platformParam}:disconnect`,
      user.id,
      req,
    );

    const allowed = await rateLimit({
      key: rlKey,
      route: 'auth:oauth:disconnect',
      windowMs: 60_000,
      max: 5,
    });

    if (!allowed) {
      return NextResponse.json(
        { ok: false, message: 'Trop de tentatives, réessaie dans une minute.' },
        { status: 429 },
      );
    }

    const supabase = await getSupabaseSSR();

    const { error: deleteError } = await supabase
      .from('platform_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platformParam);

    if (deleteError) {
      console.error('OAuth disconnect: failed to delete platform account', deleteError);
      return NextResponse.json(
        { ok: false, message: 'Erreur lors de la déconnexion de la plateforme' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('OAuth disconnect error', err);
    return NextResponse.json(
      { ok: false, message: 'Erreur interne lors de la déconnexion' },
      { status: 500 },
    );
  }
}

