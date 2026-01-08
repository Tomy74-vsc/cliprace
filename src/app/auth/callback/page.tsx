/*
Source: Generic auth callback used for magic links / admin impersonation links.
Purpose: Parse access_token/refresh_token from URL and sync Supabase session.
*/
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type SessionTokens = { access_token: string; refresh_token: string };

function parseTokens(raw: string | null): SessionTokens | null {
  if (!raw) return null;
  const serialized = raw.startsWith('#') ? raw.slice(1) : raw.startsWith('?') ? raw.slice(1) : raw;
  const params = new URLSearchParams(serialized);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { access_token: accessToken, refresh_token: refreshToken };
  return null;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const hashTokens = parseTokens(window.location.hash);
        const searchTokens = parseTokens(window.location.search);
        const tokens = hashTokens || searchTokens;
        if (!tokens) {
          if (mounted) setStatus('error');
          return;
        }

        await supabase.auth.setSession(tokens);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

        if (next && next.startsWith('/')) {
          router.replace(next);
          return;
        }

        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const me = await meRes.json().catch(() => null);
        if (meRes.ok && me?.ok && me?.user?.role) {
          const role = me.user.role as string;
          if (role === 'admin') router.replace('/app/admin/dashboard');
          else if (role === 'brand') router.replace('/app/brand/dashboard');
          else router.replace('/app/creator/dashboard');
          return;
        }

        router.replace('/app/creator/dashboard');
      } catch {
        if (mounted) setStatus('error');
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [next, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {status === 'loading' ? (
        <div className="text-sm text-muted-foreground">Connexion en cours...</div>
      ) : (
        <div className="text-sm text-muted-foreground">
          Lien invalide ou expiré. Recommence la connexion.
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-sm text-muted-foreground">Connexion en cours...</div>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
