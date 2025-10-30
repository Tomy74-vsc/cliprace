import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { MessagingError, flagThreadMessage } from '@/services/messaging';

const ThreadIdSchema = z.string().uuid();

const FlagSchema = z.object({
  message_id: z.string().uuid(),
  reason: z.string().max(500).optional()
});

export async function POST(
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
    const payload = await request.json();
    const { message_id, reason } = FlagSchema.parse(payload);

    const result = await flagThreadMessage(supabase, user.id, threadId, {
      messageId: message_id,
      reason
    });

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur dans POST /api/messages/[threadId]/flag:', error);

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
