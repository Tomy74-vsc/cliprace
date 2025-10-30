/**
 * API pour la queue de modération
 * 
 * Endpoints:
 * - GET /api/moderation/queue - Lister la queue de modération
 * - POST /api/moderation/queue/process - Traiter la queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const GetQueueSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  assigned_to: z.string().uuid().optional(),
  priority: z.coerce.number().min(0).max(2).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

const ProcessQueueSchema = z.object({
  batch_size: z.coerce.number().min(1).max(50).default(10),
  assigned_to: z.string().uuid().optional()
});

/**
 * GET /api/moderation/queue
 * Lister la queue de modération
 */
export async function GET(request: NextRequest) {
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

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const params = GetQueueSchema.parse({
      status: searchParams.get('status'),
      assigned_to: searchParams.get('assigned_to'),
      priority: searchParams.get('priority'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit')
    });

    // Construire la requête
    let query = supabase
      .from('moderation_queue')
      .select(`
        *,
        submissions!inner(
          id,
          contest_id,
          creator_id,
          network,
          video_url,
          status as submission_status,
          created_at as submission_created_at,
          contests!inner(
            id,
            title,
            brand_id
          ),
          profiles!submissions_creator_id_fkey(
            id,
            email,
            display_name
          )
        )
      `);

    // Filtres selon le rôle
    if (profile.role === 'brand') {
      query = query.eq('submissions.contests.brand_id', user.id);
    }

    // Appliquer les filtres
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.assigned_to) {
      query = query.eq('assigned_to', params.assigned_to);
    }
    if (params.priority !== undefined) {
      query = query.eq('priority', params.priority);
    }

    // Tri par priorité et date
    query = query.order('priority', { ascending: false });
    query = query.order('created_at', { ascending: true });

    // Pagination
    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data: queue, error } = await query;

    if (error) {
      console.error('Error fetching moderation queue:', error);
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }

    // Compter le total
    let countQuery = supabase
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true });

    if (profile.role === 'brand') {
      countQuery = countQuery.eq('submissions.contests.brand_id', user.id);
    }
    if (params.status) {
      countQuery = countQuery.eq('status', params.status);
    }
    if (params.assigned_to) {
      countQuery = countQuery.eq('assigned_to', params.assigned_to);
    }
    if (params.priority !== undefined) {
      countQuery = countQuery.eq('priority', params.priority);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting queue items:', countError);
    }

    return NextResponse.json({
      data: queue || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / params.limit)
      }
    });

  } catch (error) {
    console.error('Moderation queue API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/moderation/queue/process
 * Traiter la queue de modération
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier les permissions (admin seulement pour le processing)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const params = ProcessQueueSchema.parse(body);

    // Récupérer les items en attente
    const { data: queueItems, error: fetchError } = await supabase
      .from('moderation_queue')
      .select(`
        *,
        submissions!inner(
          id,
          contest_id,
          creator_id,
          network,
          video_url,
          status
        )
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(params.batch_size);

    if (fetchError) {
      console.error('Error fetching queue items:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 });
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items to process',
        processed: 0
      });
    }

    const results = [];

    for (const item of queueItems) {
      try {
        // Marquer comme en cours de traitement
        await supabase
          .from('moderation_queue')
          .update({ 
            status: 'processing',
            assigned_to: params.assigned_to || user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Traiter la submission avec l'automod
        const { data: submission } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', item.submission_id)
          .single();

        if (!submission) {
          throw new Error('Submission not found');
        }

        // Simulation de l'automod (en attendant l'Edge Function)
        const automodResult = {
          submission_id: item.submission_id,
          status: 'approved',
          violations: [],
          automod_data: { processed_at: new Date().toISOString() },
          processing_time_ms: 100
        };

        // Mettre à jour le statut de la submission
        await supabase
          .from('submissions')
          .update({
            status: automodResult.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.submission_id);

        // Marquer comme complété
        await supabase
          .from('moderation_queue')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.push({
          queue_id: item.id,
          submission_id: item.submission_id,
          success: true,
          automod_result: automodResult
        });

      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        
        // Marquer comme failed
        await supabase
          .from('moderation_queue')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.push({
          queue_id: item.id,
          submission_id: item.submission_id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    console.error('Process queue error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid parameters', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
