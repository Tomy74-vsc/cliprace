import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { logSecurityViolation } from '@/lib/audit-logger';
import { z } from 'zod';

const RecaptchaSchema = z.object({
  token: z.string().min(10),
});

export const POST = withRateLimit('/api/auth/recaptcha')(async (request: Request) => {
  const nextRequest = request as NextRequest;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('Recaptcha payload parse error:', error);
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = RecaptchaSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET_KEY non configurée');
    return NextResponse.json(
      { error: 'Service reCAPTCHA indisponible' },
      { status: 503 }
    );
  }

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', parsed.data.token);

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(`Google reCAPTCHA responded with ${response.status}`);
    }

    const verification = await response.json() as {
      success: boolean;
      score?: number;
      action?: string;
      challenge_ts?: string;
      hostname?: string;
      'error-codes'?: string[];
    };

    if (!verification.success) {
      await logSecurityViolation('validation_violation', {
        reason: 'recaptcha_failed',
        errors: verification['error-codes'] ?? [],
      }, nextRequest);

      return NextResponse.json(
        {
          error: 'Vérification reCAPTCHA échouée',
          details: verification['error-codes'] ?? [],
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      score: verification.score ?? null,
      action: verification.action ?? null,
    });
  } catch (error) {
    console.error('Erreur reCAPTCHA:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification reCAPTCHA' },
      { status: 500 }
    );
  }
});

