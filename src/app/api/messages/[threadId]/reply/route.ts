import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { MessagingError, addThreadReply } from '@/services/messaging';
import { withAntivirusProtection } from '@/lib/antivirus';
import type { AttachmentPayload } from '@/services/messaging';

const ThreadIdSchema = z.string().uuid();

const ReplySchema = z.object({
  body: z.string().max(2000).optional()
});

function asAttachmentPayload(file: File): AttachmentPayload {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    arrayBuffer: () => file.arrayBuffer()
  };
}

export async function POST(
  request: NextRequest,
  context: { params: { threadId: string } }
) {
  return withAntivirusProtection(async (req: NextRequest) => {
    try {
      const supabase = await getServerSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }

      const threadId = ThreadIdSchema.parse(context.params.threadId);
      const contentType = req.headers.get('content-type') || '';

    let bodyText: string | undefined;
    let attachments: AttachmentPayload[] = [];

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
      const rawBody = formData.get('body') ?? formData.get('message');
      if (typeof rawBody === 'string') {
        bodyText = rawBody;
      }

      const attachmentEntries = [
        ...formData.getAll('attachments'),
        ...formData.getAll('files')
      ];

      attachments = attachmentEntries
        .filter((entry): entry is File => entry instanceof File)
        .map(file => asAttachmentPayload(file));
      } else {
        const payload = await req.json().catch(() => null);
      if (!payload) {
        throw new MessagingError('Corps de requête invalide', 400);
      }

      const { body } = ReplySchema.parse(payload);
      bodyText = body;
    }

    const message = await addThreadReply(supabase, user.id, threadId, {
      body: bodyText || '',
      attachments
    });

    return NextResponse.json({
      success: true,
      data: message
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur dans POST /api/messages/[threadId]/reply:', error);

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
  })(request);
}
