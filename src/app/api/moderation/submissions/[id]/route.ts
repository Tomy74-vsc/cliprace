/**
 * API pour les actions individuelles sur les submissions
 * 
 * Endpoints:
 * - GET /api/moderation/submissions/[id] - Récupérer une submission
 * - PUT /api/moderation/submissions/[id] - Modifier une submission
 * 
 * Endpoints séparés:
 * - POST /api/moderation/submissions/[id]/approve - Approuver une submission
 * - POST /api/moderation/submissions/[id]/reject - Rejeter une submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit-logger';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const UpdateSchema = z.object({
  status: z.enum(['pending_review', 'approved', 'rejected']).optional(),
  reason: z.string().optional(),
  assigned_to: z.string().uuid().optional()
});

/**
 * GET /api/moderation/submissions/[id]
 * Récupérer une submission avec tous les détails
 */
export async function GET(
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

    // Récupérer la submission avec tous les détails
    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        contests!inner(
          id,
          title,
          description,
          brand_id,
          status,
          starts_at,
          ends_at
        ),
        profiles!submissions_creator_id_fkey(
          id,
          email,
          display_name,
          avatar_url,
          role
        ),
        moderation_queue(
          id,
          status,
          priority,
          assigned_to,
          automod_result,
          created_at,
          updated_at
        ),
        audit_logs(
          id,
          action,
          actor_id,
          data,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Error fetching submission:', error);
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Vérifier que l'utilisateur peut voir cette submission
    if (profile.role === 'brand' && submission.contests?.brand_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: submission });

  } catch (error) {
    logger.error('Get submission error:', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/moderation/submissions/[id]
 * Modifier une submission
 */
export async function PUT(
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
    const updateData = UpdateSchema.parse(body);

    // Vérifier que l'utilisateur peut modifier cette submission
    const { data: submission } = await supabase
      .from('submissions')
      .select('contest_id, contests!inner(brand_id)')
      .eq('id', id)
      .single();

    if (profile.role === 'brand' && submission?.contests?.[0]?.brand_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mettre à jour la submission
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (updateData.status) {
      updatePayload.status = updateData.status;
      if (updateData.status === 'approved' || updateData.status === 'rejected') {
        updatePayload.moderated_at = new Date().toISOString();
        updatePayload.moderated_by = user.id;
      }
    }

    if (updateData.reason) {
      updatePayload.reason = updateData.reason;
    }

    const { data, error } = await supabase
      .from('submissions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating submission:', error);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    // Mettre à jour la queue de modération si nécessaire
    if (updateData.assigned_to !== undefined) {
      await supabase
        .from('moderation_queue')
        .update({ assigned_to: updateData.assigned_to })
        .eq('submission_id', id);
    }

    // Logger l'action avec logAuditEvent
    await logAuditEvent('submission_update', 'submissions', {
      entityId: id,
      data: updateData,
      actorId: user.id
    });

    return NextResponse.json({ data });

  } catch (error) {
    logger.error('Update submission error:', error as Error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

