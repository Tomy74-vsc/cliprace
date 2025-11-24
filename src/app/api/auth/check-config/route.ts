// Source: GET /api/auth/check-config
// Purpose: Diagnostic endpoint to check Supabase configuration
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const checks: Record<string, { status: 'ok' | 'error' | 'warning'; message: string; value?: string }> = {};

    // Check environment variables
    checks.supabaseUrl = {
      status: env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'error',
      message: env.NEXT_PUBLIC_SUPABASE_URL ? 'Supabase URL configurée' : 'NEXT_PUBLIC_SUPABASE_URL manquante',
      value: env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌',
    };

    checks.supabaseAnonKey = {
      status: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'error',
      message: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Clé ANON configurée' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY manquante',
      value: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌',
    };

    checks.serviceRoleKey = {
      status: env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'warning',
      message: env.SUPABASE_SERVICE_ROLE_KEY ? 'Clé Service Role configurée' : 'SUPABASE_SERVICE_ROLE_KEY manquante (nécessaire pour certaines opérations)',
      value: env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '⚠️',
    };

    checks.siteUrl = {
      status: env.NEXT_PUBLIC_SITE_URL || env.APP_URL ? 'ok' : 'warning',
      message: env.NEXT_PUBLIC_SITE_URL || env.APP_URL 
        ? `Site URL configurée: ${env.NEXT_PUBLIC_SITE_URL || env.APP_URL}` 
        : 'NEXT_PUBLIC_SITE_URL ou APP_URL manquante (utilisera http://localhost:3000 par défaut)',
      value: env.NEXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3000',
    };

    // Test Supabase connection
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const testClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Test simple connection
        const { data: healthCheck, error: healthError } = await testClient.from('profiles').select('count').limit(1);

        checks.supabaseConnection = {
          status: healthError ? 'error' : 'ok',
          message: healthError 
            ? `Erreur de connexion: ${healthError.message}` 
            : 'Connexion à Supabase réussie',
          value: healthError ? '❌' : '✅',
        };
      } catch (error) {
        checks.supabaseConnection = {
          status: 'error',
          message: `Erreur lors du test de connexion: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          value: '❌',
        };
      }
    } else {
      checks.supabaseConnection = {
        status: 'error',
        message: 'Impossible de tester la connexion (variables manquantes)',
        value: '❌',
      };
    }

    // Check redirect URL format
    const siteUrl = env.NEXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/auth/verify?email=test@example.com`;
    
    checks.redirectUrl = {
      status: 'ok',
      message: `URL de redirection qui sera utilisée: ${redirectUrl}`,
      value: redirectUrl,
    };

    // Summary
    const allOk = Object.values(checks).every(c => c.status === 'ok');
    const hasErrors = Object.values(checks).some(c => c.status === 'error');
    const hasWarnings = Object.values(checks).some(c => c.status === 'warning');

    return NextResponse.json({
      ok: allOk,
      summary: {
        allOk,
        hasErrors,
        hasWarnings,
        totalChecks: Object.keys(checks).length,
      },
      checks,
      recommendations: hasErrors ? [
        'Vérifiez vos variables d\'environnement dans .env.local',
        'Assurez-vous que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont définies',
        'Vérifiez la configuration dans Supabase Dashboard',
      ] : hasWarnings ? [
        'Certaines configurations sont manquantes mais non critiques',
        'Vérifiez SUPABASE_SERVICE_ROLE_KEY si vous avez des erreurs lors de certaines opérations',
      ] : [
        'Toutes les configurations semblent correctes',
        'Si les emails ne sont toujours pas envoyés, vérifiez:',
        '1. Les Redirect URLs dans Supabase Dashboard (Authentication → URL Configuration)',
        '2. Les Email Templates sont activés (Authentication → Email Templates)',
        '3. Le rate limit email n\'est pas atteint (3 emails/heure en dev)',
        '4. Les logs Supabase (Logs → Auth Logs) pour voir si l\'email a été envoyé',
      ],
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}

