import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { MessagingError, getThreadMessages } from '@/services/messaging';

const ThreadIdSchema = z.string().uuid();

const MessageThreadQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform(value => Number(value ?? 50))
    .pipe(z.number().min(1).max(100)),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform(value => Number(value ?? 0))
    .pipe(z.number().min(0))
});

export async function GET(
  request: NextRequest,
  context: { params: { threadId: string } }
) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const threadId = ThreadIdSchema.parse(context.params.threadId);
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { limit, offset } = MessageThreadQuerySchema.parse(queryParams);

    const result = await getThreadMessages(supabase, user.id, threadId, limit, offset);

    return NextResponse.json({
      success: true,
      data: result.messages,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erreur dans GET /api/messages/[threadId]:', error);

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
