/**
 * Automod Worker - Edge Function
 * 
 * Traite la modération automatique des submissions avec :
 * - Détection de doublons
 * - Validation des domaines autorisés
 * - Vérification de la durée des vidéos
 * - Détection de flood
 * - Intégration optionnelle avec APIs externes de modération
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomodRequest {
  submission_id: string;
  action: 'process' | 'retry' | 'bulk_process';
  batch_size?: number;
}

interface AutomodResult {
  submission_id: string;
  status: 'approved' | 'rejected' | 'pending_review';
  violations: string[];
  automod_data: Record<string, any>;
  processing_time_ms: number;
}

interface VideoMetadata {
  duration?: number;
  title?: string;
  description?: string;
  thumbnail_url?: string;
}

class AutomodWorker {
  private supabase: any;
  
  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }

  /**
   * Traite une submission individuelle
   */
  async processSubmission(submissionId: string): Promise<AutomodResult> {
    const startTime = Date.now();
    
    try {
      // Récupérer les données de la submission
      const { data: submission, error: submissionError } = await this.supabase
        .from('submissions')
        .select(`
          *,
          contests!inner(title, brand_id, rules),
          profiles!submissions_creator_id_fkey(role, email)
        `)
        .eq('id', submissionId)
        .single();

      if (submissionError || !submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      const violations: string[] = [];
      const automodData: Record<string, any> = {};

      // 1. Détection de doublons
      const duplicateCheck = await this.checkDuplicates(submission);
      if (duplicateCheck.isDuplicate) {
        violations.push('duplicate');
        automodData.duplicate_info = duplicateCheck.details;
      }

      // 2. Validation du domaine
      const domainCheck = await this.validateDomain(submission.video_url);
      if (!domainCheck.isValid) {
        violations.push('invalid_domain');
        automodData.domain_info = domainCheck.details;
      }

      // 3. Vérification de la durée (si disponible)
      const durationCheck = await this.checkVideoDuration(submission);
      if (durationCheck.violation) {
        violations.push('duration_too_short');
        automodData.duration_info = durationCheck.details;
      }

      // 4. Détection de flood
      const floodCheck = await this.checkFlood(submission.creator_id);
      if (floodCheck.isFlood) {
        violations.push('flood');
        automodData.flood_info = floodCheck.details;
      }

      // 5. Modération de contenu (optionnel - stub vers API externe)
      const contentCheck = await this.checkContent(submission);
      if (contentCheck.violation) {
        violations.push('content_violation');
        automodData.content_info = contentCheck.details;
      }

      // Déterminer le statut final
      let finalStatus: 'approved' | 'rejected' | 'pending_review';
      let shouldHumanReview = false;

      if (violations.length === 0) {
        finalStatus = 'approved';
      } else if (violations.includes('duplicate') || violations.includes('invalid_domain')) {
        finalStatus = 'rejected';
      } else {
        // Pour les autres violations, passer en review humaine
        finalStatus = 'pending_review';
        shouldHumanReview = true;
      }

      // Mettre à jour la submission
      const updateData: any = {
        status: finalStatus,
        updated_at: new Date().toISOString(),
        automod_data: automodData
      };

      if (finalStatus === 'rejected') {
        updateData.reason = `Automod violations: ${violations.join(', ')}`;
        updateData.moderated_at = new Date().toISOString();
      }

      const { error: updateError } = await this.supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (updateError) {
        throw new Error(`Failed to update submission: ${updateError.message}`);
      }

      // Ajouter à la queue de modération si nécessaire
      if (shouldHumanReview) {
        await this.addToModerationQueue(submissionId, automodData);
      }

      // Logger l'action
      await this.logAutomodAction(submissionId, finalStatus, violations, automodData);

      const processingTime = Date.now() - startTime;

      return {
        submission_id: submissionId,
        status: finalStatus,
        violations,
        automod_data: automodData,
        processing_time_ms: processingTime
      };

    } catch (error) {
      console.error('Error processing submission:', error);
      
      // Marquer comme failed dans la queue
      await this.markAsFailed(submissionId, error.message);
      
      throw error;
    }
  }

  /**
   * Détecte les doublons
   */
  private async checkDuplicates(submission: any): Promise<{isDuplicate: boolean, details: any}> {
    const { data: duplicates, error } = await this.supabase
      .from('submissions')
      .select('id, created_at, status')
      .eq('contest_id', submission.contest_id)
      .eq('platform_video_id', submission.platform_video_id)
      .eq('network', submission.network)
      .neq('id', submission.id)
      .neq('status', 'rejected');

    if (error) {
      throw new Error(`Duplicate check failed: ${error.message}`);
    }

    return {
      isDuplicate: duplicates && duplicates.length > 0,
      details: {
        duplicate_count: duplicates?.length || 0,
        duplicate_ids: duplicates?.map(d => d.id) || []
      }
    };
  }

  /**
   * Valide le domaine de l'URL vidéo
   */
  private async validateDomain(videoUrl: string): Promise<{isValid: boolean, details: any}> {
    const allowedDomains = [
      'youtube.com',
      'youtu.be',
      'tiktok.com',
      'vm.tiktok.com',
      'instagram.com',
      'facebook.com',
      'fb.watch'
    ];

    try {
      const url = new URL(videoUrl);
      const domain = url.hostname.toLowerCase();
      
      // Vérifier les domaines autorisés
      const isValid = allowedDomains.some(allowedDomain => 
        domain === allowedDomain || domain.endsWith('.' + allowedDomain)
      );

      return {
        isValid,
        details: {
          domain,
          allowed_domains: allowedDomains,
          url: videoUrl
        }
      };
    } catch (error) {
      return {
        isValid: false,
        details: {
          error: 'Invalid URL format',
          url: videoUrl
        }
      };
    }
  }

  /**
   * Vérifie la durée de la vidéo
   */
  private async checkVideoDuration(submission: any): Promise<{violation: boolean, details: any}> {
    // Pour l'instant, on ne peut pas récupérer la durée sans API externe
    // Ceci est un stub pour l'implémentation future
    const minDurationSeconds = 10;
    
    // Si on a des métadonnées de durée dans le meta field
    const meta = submission.meta || {};
    const duration = meta.duration || meta.video_duration;
    
    if (duration && duration < minDurationSeconds) {
      return {
        violation: true,
        details: {
          duration_seconds: duration,
          min_required_seconds: minDurationSeconds,
          violation_type: 'duration_too_short'
        }
      };
    }

    return {
      violation: false,
      details: {
        duration_seconds: duration || 'unknown',
        min_required_seconds: minDurationSeconds
      }
    };
  }

  /**
   * Détecte le flood de submissions
   */
  private async checkFlood(creatorId: string): Promise<{isFlood: boolean, details: any}> {
    const timeframeMinutes = 1;
    const maxSubmissions = 3;

    const { data: recentSubmissions, error } = await this.supabase
      .from('submissions')
      .select('id, created_at')
      .eq('creator_id', creatorId)
      .gte('created_at', new Date(Date.now() - timeframeMinutes * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Flood check failed: ${error.message}`);
    }

    const isFlood = recentSubmissions && recentSubmissions.length >= maxSubmissions;

    return {
      isFlood,
      details: {
        recent_submissions_count: recentSubmissions?.length || 0,
        max_allowed: maxSubmissions,
        timeframe_minutes: timeframeMinutes,
        recent_submission_ids: recentSubmissions?.map(s => s.id) || []
      }
    };
  }

  /**
   * Vérifie le contenu (stub vers API externe)
   */
  private async checkContent(submission: any): Promise<{violation: boolean, details: any}> {
    // Stub pour intégration future avec APIs de modération externes
    // (NSFW detection, hate speech, etc.)
    
    const externalModerationEnabled = Deno.env.get('EXTERNAL_MODERATION_ENABLED') === 'true';
    
    if (!externalModerationEnabled) {
      return {
        violation: false,
        details: {
          external_moderation: 'disabled',
          reason: 'External moderation APIs not configured'
        }
      };
    }

    // Ici on pourrait intégrer avec des services comme:
    // - Google Cloud Vision API
    // - AWS Rekognition
    // - Azure Content Moderator
    // - Moderation APIs tierces

    return {
      violation: false,
      details: {
        external_moderation: 'enabled',
        status: 'not_implemented'
      }
    };
  }

  /**
   * Ajoute une submission à la queue de modération
   */
  private async addToModerationQueue(submissionId: string, automodData: any): Promise<void> {
    const { error } = await this.supabase
      .from('moderation_queue')
      .insert({
        submission_id: submissionId,
        status: 'pending',
        automod_result: automodData,
        human_review_required: true
      });

    if (error) {
      console.error('Failed to add to moderation queue:', error);
    }
  }

  /**
   * Log l'action d'automod
   */
  private async logAutomodAction(submissionId: string, status: string, violations: string[], data: any): Promise<void> {
    try {
      // Utiliser logAuditEvent via RPC
      const { error } = await this.supabase.rpc('insert_audit_log', {
        p_actor_id: '00000000-0000-0000-0000-000000000000', // System user
        p_action: 'submission_automod',
        p_entity: 'submissions',
        p_entity_id: submissionId,
        p_data: {
          status,
          violations,
          automod_data: data,
          processed_at: new Date().toISOString()
        },
        p_ip_address: null,
        p_user_agent: null
      });

      if (error) {
        console.error('Failed to log automod action via RPC:', error);
      }
    } catch (error) {
      console.error('Error in logAutomodAction:', error);
    }
  }

  /**
   * Marque une submission comme failed
   */
  private async markAsFailed(submissionId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('moderation_queue')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('submission_id', submissionId);
  }

  /**
   * Traite un batch de submissions
   */
  async processBatch(batchSize: number = 10): Promise<AutomodResult[]> {
    // Récupérer les submissions en attente
    const { data: pendingSubmissions, error } = await this.supabase
      .from('submissions')
      .select('id')
      .eq('status', 'pending_automod')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      throw new Error(`Failed to fetch pending submissions: ${error.message}`);
    }

    const results: AutomodResult[] = [];

    for (const submission of pendingSubmissions || []) {
      try {
        const result = await this.processSubmission(submission.id);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process submission ${submission.id}:`, error);
        results.push({
          submission_id: submission.id,
          status: 'pending_review',
          violations: ['processing_error'],
          automod_data: { error: error.message },
          processing_time_ms: 0
        });
      }
    }

    return results;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const worker = new AutomodWorker();
    const body: AutomodRequest = await req.json();

    let result: AutomodResult | AutomodResult[];

    switch (body.action) {
      case 'process':
        if (!body.submission_id) {
          throw new Error('submission_id is required for process action');
        }
        result = await worker.processSubmission(body.submission_id);
        break;

      case 'bulk_process':
        result = await worker.processBatch(body.batch_size || 10);
        break;

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Automod worker error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

