/**
 * Audit Logger Utility
 * Utilitaire pour enregistrer les actions sensibles dans audit_logs
 */

import { getServerSupabase } from './supabase/server';
import { getAdminSupabase } from './supabase/admin';

export type AuditAction = 
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT_DATA'
  | 'DELETE_DATA_REQUEST'
  | 'DELETE_DATA_COMPLETED'
  | 'DELETE_DATA_FAILED'
  | 'submission_create'
  | 'submission_approve'
  | 'submission_update'
  | 'submission_reject'
  | 'submission_automod'
  | 'moderation_assign'
  | 'moderation_unassign'
  | 'admin_action'
  | 'security_violation'
  | 'rate_limit_exceeded'
  | 'xss_attempt'
  | 'validation_violation';

export interface AuditLogData {
  actor_id?: string;
  action: AuditAction;
  entity: string;
  entity_id?: string;
  data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Enregistre une action dans les logs d'audit
 */
export async function logAuditEvent(
  action: AuditAction,
  entity: string,
  options: {
    entityId?: string;
    data?: Record<string, any>;
    request?: Request;
    actorId?: string;
  } = {}
): Promise<void> {
  try {
    // Extraire les informations de la requête si fournie
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    
    if (options.request) {
      ipAddress = options.request.headers.get('x-forwarded-for')?.split(',')[0] || 
                 options.request.headers.get('x-real-ip') || 
                 'unknown';
      userAgent = options.request.headers.get('user-agent') || undefined;
    }
    
    // Obtenir l'ID de l'acteur si non fourni
    let actorId = options.actorId;
    if (!actorId) {
      const supabase = await getServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      actorId = user?.id || '00000000-0000-0000-0000-000000000000'; // System user
    }
    
    // Utiliser le client admin pour garantir l'insertion
    const adminSupabase = getAdminSupabase();
    
    // Enregistrer l'événement via RPC sécurisée
    const { error } = await (adminSupabase as any).rpc('insert_audit_log', {
      p_actor_id: actorId,
      p_action: action as string,
      p_entity: entity,
      p_entity_id: options.entityId || null,
      p_data: options.data || {},
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent || null
    });
    
    if (error) {
      console.error('Erreur lors de l\'enregistrement de l\'audit log:', error);
    }
  } catch (error) {
    console.error('Erreur dans logAuditEvent:', error);
  }
}

/**
 * Enregistre une tentative de connexion
 */
export async function logLoginAttempt(
  email: string,
  success: boolean,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    'LOGIN',
    'auth',
    {
      data: {
        email,
        success,
        timestamp: new Date().toISOString()
      },
      request
    }
  );
}

/**
 * Enregistre une tentative de déconnexion
 */
export async function logLogout(
  userId: string,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    'LOGOUT',
    'auth',
    {
      entityId: userId,
      data: {
        timestamp: new Date().toISOString()
      },
      request
    }
  );
}

/**
 * Enregistre une action d'administration
 */
export async function logAdminAction(
  action: string,
  targetEntity: string,
  targetId: string,
  adminId: string,
  data?: Record<string, any>,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    'admin_action',
    targetEntity,
    {
      entityId: targetId,
      data: {
        admin_action: action,
        admin_id: adminId,
        ...data
      },
      request,
      actorId: adminId
    }
  );
}

/**
 * Enregistre une violation de sécurité
 */
export async function logSecurityViolation(
  violationType: 'rate_limit_exceeded' | 'xss_attempt' | 'validation_violation' | 'invalid_auth',
  details: Record<string, any>,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    'security_violation',
    'security',
    {
      data: {
        violation_type: violationType,
        details,
        timestamp: new Date().toISOString()
      },
      request
    }
  );
}

/**
 * Enregistre une action de modération
 */
export async function logModerationAction(
  action: 'submission_approve' | 'submission_reject' | 'submission_automod',
  submissionId: string,
  moderatorId: string,
  data?: Record<string, any>,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    action,
    'submissions',
    {
      entityId: submissionId,
      data: {
        moderator_id: moderatorId,
        ...data
      },
      request,
      actorId: moderatorId
    }
  );
}

/**
 * Enregistre une action RGPD
 */
export async function logGdprAction(
  action: 'EXPORT_DATA' | 'DELETE_DATA_REQUEST' | 'DELETE_DATA_COMPLETED' | 'DELETE_DATA_FAILED',
  userId: string,
  data?: Record<string, any>,
  request?: Request
): Promise<void> {
  await logAuditEvent(
    action,
    'user_data',
    {
      entityId: userId,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      request,
      actorId: userId
    }
  );
}

/**
 * Middleware pour enregistrer automatiquement les actions sensibles
 */
export function withAuditLogging(
  action: AuditAction,
  entity: string,
  getEntityId?: (request: Request) => string | undefined
) {
  return function auditMiddleware(
    handler: (request: Request) => Promise<Response>
  ) {
    return async function auditedHandler(request: Request): Promise<Response> {
      try {
        // Exécuter le handler original
        const response = await handler(request);
        
        // Enregistrer l'action si elle a réussi
        if (response.status < 400) {
          const entityId = getEntityId ? getEntityId(request) : undefined;
          await logAuditEvent(action, entity, {
            entityId,
            request
          });
        }
        
        return response;
      } catch (error) {
        // Enregistrer l'erreur
        await logSecurityViolation('invalid_auth', {
          error: error instanceof Error ? error.message : 'Unknown error',
          action,
          entity
        }, request);
        
        throw error;
      }
    };
  };
}

/**
 * Obtient les statistiques d'audit pour un utilisateur
 */
export async function getAuditStats(userId: string, days: number = 30): Promise<{
  total_actions: number;
  actions_by_type: Record<string, number>;
  recent_actions: Array<{
    action: string;
    entity: string;
    created_at: string;
  }>;
}> {
  try {
    const supabase = await getServerSupabase();
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    // Compter les actions totales
    const { count: totalActions } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .gte('created_at', since.toISOString());
    
    // Actions par type
    const { data: actionsByType } = await supabase
      .from('audit_logs')
      .select('action')
      .eq('actor_id', userId)
      .gte('created_at', since.toISOString());
    
    const actionsByTypeMap: Record<string, number> = {};
    actionsByType?.forEach(action => {
      actionsByTypeMap[action.action] = (actionsByTypeMap[action.action] || 0) + 1;
    });
    
    // Actions récentes
    const { data: recentActions } = await supabase
      .from('audit_logs')
      .select('action, entity, created_at')
      .eq('actor_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    return {
      total_actions: totalActions || 0,
      actions_by_type: actionsByTypeMap,
      recent_actions: recentActions || []
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des stats d\'audit:', error);
    return {
      total_actions: 0,
      actions_by_type: {},
      recent_actions: []
    };
  }
}


