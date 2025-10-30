/**
 * API pour rejeter une submission
 * 
 * Endpoint: POST /api/moderation/submissions/[id]/reject
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit-logger';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const RejectSchema = z.object({
  reason: z.string().min(1, 'Reason is required')
});

/**
 * POST /api/moderation/submissions/[id]/reject
 * Rejeter une submission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'brand'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { reason } = RejectSchema.parse(body);

    // Vérifier que l'utilisateur peut rejeter cette submission
    const { data: existingSubmission } = await supabase
      .from('submissions')
      .select('contest_id, contests!inner(brand_id)')
      .eq('id', id)
      .single();

    if (profile.role === 'brand' && existingSubmission?.contests?.[0]?.brand_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rejeter la submission
    const { data: submission, error: updateError } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        moderated_at: new Date().toISOString(),
        moderated_by: user.id,
        reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error rejecting submission:', updateError);
      return NextResponse.json({ error: 'Failed to reject submission' }, { status: 500 });
    }

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found or already processed' }, { status: 404 });
    }

    // Logger l'action avec logAuditEvent
    await logAuditEvent('submission_reject', 'submissions', {
      entityId: id,
      data: { reason, rejected_at: new Date().toISOString() },
      actorId: user.id
    });

    // Marquer comme complété dans la queue
    await supabase
      .from('moderation_queue')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('submission_id', id);

    return NextResponse.json({ 
      success: true, 
      message: 'Submission rejected successfully',
      data: submission
    });

  } catch (error) {
    logger.error('Reject submission error:', error instanceof Error ? error : new Error(String(error)));
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
