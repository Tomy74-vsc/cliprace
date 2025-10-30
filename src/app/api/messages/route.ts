import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { MessagingError, createMessageThread, listMessageThreads } from '@/services/messaging';
import { sanitizeRequestData, escapeHtml } from '@/lib/xss-protection';

const MessageQuerySchema = z.object({
  brand_id: z.string().uuid().optional(),
  creator_id: z.string().uuid().optional(),
  unread_only: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(value => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return ['true', '1', 'yes'].includes(value.toLowerCase());
      }
      return false;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform(value => Number(value ?? 20))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform(value => Number(value ?? 0))
    .pipe(z.number().min(0))
});

const CreateMessageSchema = z.object({
  brand_id: z.string().uuid(),
  creator_id: z.string().uuid(),
  subject: z.string().min(1).max(200).transform(escapeHtml),
  initial_message: z.string().min(1).max(1000).optional().transform(val => val ? escapeHtml(val) : val)
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { brand_id, creator_id, unread_only, limit, offset } = MessageQuerySchema.parse(queryParams);

    const result = await listMessageThreads(supabase, user.id, {
      brandId: brand_id,
      creatorId: creator_id,
      unreadOnly: unread_only ?? false,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      data: result.threads,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erreur dans GET /api/messages:', error);

    if (error instanceof MessagingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Paramètres invalides',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const payload = await request.json();
    const sanitizedPayload = sanitizeRequestData(payload);
    const { brand_id, creator_id, subject, initial_message } = CreateMessageSchema.parse(sanitizedPayload);

    const thread = await createMessageThread(supabase, user.id, {
      brandId: brand_id,
      creatorId: creator_id,
      subject,
      initialMessage: initial_message
    });

    return NextResponse.json({
      success: true,
      data: thread
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur dans POST /api/messages:', error);

    if (error instanceof MessagingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Données invalides',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
