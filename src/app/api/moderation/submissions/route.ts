/**
 * API pour la modération des submissions
 * 
 * Endpoints:
 * - GET /api/moderation/submissions - Lister les submissions à modérer
 * - POST /api/moderation/submissions/bulk - Actions en lot
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-logger';
import { z } from 'zod';

// Schémas de validation
const GetSubmissionsSchema = z.object({
  status: z.enum(['pending_automod', 'pending_review', 'rejected', 'approved']).optional(),
  contest_id: z.string().uuid().optional(),
  creator_id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

const BulkActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'assign', 'unassign']),
  submission_ids: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().optional(),
  comment: z.string().optional(),
  assigned_to: z.string().uuid().optional()
});

/**
 * GET /api/moderation/submissions
 * Lister les submissions à modérer
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier les permissions (admin ou brand)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'brand'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parser les paramètres de requête
    const { searchParams } = new URL(request.url);
    const params = GetSubmissionsSchema.parse({
      status: searchParams.get('status'),
      contest_id: searchParams.get('contest_id'),
      creator_id: searchParams.get('creator_id'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      sort_by: searchParams.get('sort_by'),
      sort_order: searchParams.get('sort_order')
    });

    // Construire la requête
    let query = supabase
      .from('submissions')
      .select(`
        *,
        contests!inner(
          id,
          title,
          brand_id,
          status as contest_status
        ),
        profiles!submissions_creator_id_fkey(
          id,
          email,
          display_name,
          avatar_url
        ),
        moderation_queue(
          id,
          status as queue_status,
          priority,
          assigned_to,
          automod_result,
          created_at as queue_created_at
        )
      `);

    // Filtres selon le rôle
    if (profile.role === 'brand') {
      // Les brands ne peuvent voir que leurs propres contests
      query = query.eq('contests.brand_id', user.id);
    }

    // Appliquer les filtres
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.contest_id) {
      query = query.eq('contest_id', params.contest_id);
    }
    if (params.creator_id) {
      query = query.eq('creator_id', params.creator_id);
    }

    // Tri
    query = query.order(params.sort_by, { ascending: params.sort_order === 'asc' });

    // Pagination
    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data: submissions, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    // Compter le total pour la pagination
    let countQuery = supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true });

    if (profile.role === 'brand') {
      countQuery = countQuery.eq('contests.brand_id', user.id);
    }
    if (params.status) {
      countQuery = countQuery.eq('status', params.status);
    }
    if (params.contest_id) {
      countQuery = countQuery.eq('contest_id', params.contest_id);
    }
    if (params.creator_id) {
      countQuery = countQuery.eq('creator_id', params.creator_id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting submissions:', countError);
    }

    return NextResponse.json({
      data: submissions || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / params.limit)
      }
    });

  } catch (error) {
    console.error('Moderation API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * POST /api/moderation/submissions/bulk
 * Actions en lot sur les submissions
 */
export const POST = withRateLimit('/api/moderation/submissions')(async (request: Request) => {
  try {
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

    // Parser le body
    const body = await request.json();
    const params = BulkActionSchema.parse(body);

    const results = [];

    for (const submissionId of params.submission_ids) {
      try {
        let result;

        switch (params.action) {
          case 'approve':
            result = await approveSubmission(supabase, submissionId, user.id, params.comment);
            break;
          case 'reject':
            if (!params.reason) {
              throw new Error('Reason is required for rejection');
            }
            result = await rejectSubmission(supabase, submissionId, user.id, params.reason);
            break;
          case 'assign':
            if (!params.assigned_to) {
              throw new Error('assigned_to is required for assignment');
            }
            result = await assignSubmission(supabase, submissionId, params.assigned_to);
            break;
          case 'unassign':
            result = await unassignSubmission(supabase, submissionId);
            break;
          default:
            throw new Error(`Unknown action: ${params.action}`);
        }

        results.push({
          submission_id: submissionId,
          success: true,
          result
        });

      } catch (error) {
        results.push({
          submission_id: submissionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: params.submission_ids.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    console.error('Bulk moderation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
});

// Fonctions utilitaires pour les actions de modération

async function approveSubmission(supabase: any, submissionId: string, moderatorId: string, comment?: string) {
  // Mettre à jour la submission
  const { data: submission, error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'approved',
      moderated_at: new Date().toISOString(),
      moderated_by: moderatorId,
      reason: comment || 'Approved by moderator',
      updated_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to approve submission: ${updateError.message}`);
  }

  // Logger l'action avec logAuditEvent
  await logAuditEvent('submission_approve', 'submissions', {
    entityId: submissionId,
    data: { comment, approved_at: new Date().toISOString() },
    actorId: moderatorId
  });

  // Marquer comme complété dans la queue
  await supabase
    .from('moderation_queue')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('submission_id', submissionId);

  return submission;
}

async function rejectSubmission(supabase: any, submissionId: string, moderatorId: string, reason: string) {
  // Mettre à jour la submission
  const { data: submission, error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'rejected',
      moderated_at: new Date().toISOString(),
      moderated_by: moderatorId,
      reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to reject submission: ${updateError.message}`);
  }

  // Logger l'action avec logAuditEvent
  await logAuditEvent('submission_reject', 'submissions', {
    entityId: submissionId,
    data: { reason, rejected_at: new Date().toISOString() },
    actorId: moderatorId
  });

  // Marquer comme complété dans la queue
  await supabase
    .from('moderation_queue')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('submission_id', submissionId);

  return submission;
}

async function assignSubmission(supabase: any, submissionId: string, assignedTo: string) {
  const { error } = await supabase
    .from('moderation_queue')
    .update({ assigned_to: assignedTo })
    .eq('submission_id', submissionId);

  if (error) {
    throw new Error(`Failed to assign submission: ${error.message}`);
  }

  return { assigned_to: assignedTo };
}

async function unassignSubmission(supabase: any, submissionId: string) {
  const { error } = await supabase
    .from('moderation_queue')
    .update({ assigned_to: null })
    .eq('submission_id', submissionId);

  if (error) {
    throw new Error(`Failed to unassign submission: ${error.message}`);
  }

  return { assigned_to: null };
}
