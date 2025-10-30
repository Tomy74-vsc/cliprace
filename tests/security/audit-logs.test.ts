/**
 * Tests pour vérifier que les audit logs sont correctement créés
 * Vérification que toutes les actions sensibles sont loggées
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { logAuditEvent, logModerationAction } from '@/lib/audit-logger';

describe('Audit Logs Tests', () => {
  let supabase: any;
  const testUserId = 'test-audit-user-id';
  const testSubmissionId = 'test-submission-id';

  beforeAll(async () => {
    supabase = getAdminSupabase();
  });

  afterAll(async () => {
    // Nettoyer les logs de test
    await supabase
      .from('audit_logs')
      .delete()
      .eq('actor_id', testUserId);
  });

  it('should log audit event via RPC', async () => {
    const { data, error } = await supabase.rpc('insert_audit_log', {
      p_actor_id: testUserId,
      p_action: 'test_action',
      p_entity: 'test_entity',
      p_entity_id: 'test-id',
      p_data: { test: 'data' },
      p_ip_address: '127.0.0.1',
      p_user_agent: 'test-agent'
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should log moderation action', async () => {
    await logModerationAction(
      'submission_approve',
      testSubmissionId,
      testUserId,
      { comment: 'Test approval' }
    );

    // Vérifier que le log a été créé
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('actor_id', testUserId)
      .eq('action', 'submission_approve')
      .eq('entity_id', testSubmissionId);

    expect(error).toBeNull();
    expect(logs).toHaveLength(1);
    expect(logs[0].entity).toBe('submissions');
    expect(logs[0].data).toHaveProperty('moderator_id', testUserId);
  });

  it('should log GDPR action', async () => {
    await logAuditEvent('EXPORT_DATA', 'user_data', {
      entityId: testUserId,
      data: { format: 'json' },
      actorId: testUserId
    });

    // Vérifier que le log a été créé
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('actor_id', testUserId)
      .eq('action', 'EXPORT_DATA')
      .eq('entity', 'user_data');

    expect(error).toBeNull();
    expect(logs).toHaveLength(1);
    expect(logs[0].entity_id).toBe(testUserId);
  });

  it('should log security violation', async () => {
    await logAuditEvent('security_violation', 'security', {
      data: {
        violation_type: 'rate_limit_exceeded',
        details: { endpoint: '/api/test', ip: '127.0.0.1' }
      },
      actorId: testUserId
    });

    // Vérifier que le log a été créé
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('actor_id', testUserId)
      .eq('action', 'security_violation')
      .eq('entity', 'security');

    expect(error).toBeNull();
    expect(logs).toHaveLength(1);
    expect(logs[0].data).toHaveProperty('violation_type', 'rate_limit_exceeded');
  });

  it('should handle audit log failures gracefully', async () => {
    // Tester avec des données invalides
    const { error } = await supabase.rpc('insert_audit_log', {
      p_actor_id: null, // Actor ID invalide
      p_action: 'test_action',
      p_entity: 'test_entity',
      p_entity_id: null,
      p_data: null,
      p_ip_address: null,
      p_user_agent: null
    });

    // L'erreur devrait être gérée gracieusement
    expect(error).toBeDefined();
  });

  it('should verify audit log structure', async () => {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('actor_id', testUserId)
      .limit(1);

    expect(error).toBeNull();
    expect(logs).toHaveLength(1);
    
    const log = logs[0];
    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('actor_id');
    expect(log).toHaveProperty('action');
    expect(log).toHaveProperty('entity');
    expect(log).toHaveProperty('created_at');
    expect(log).toHaveProperty('data');
  });

  it('should verify RLS policies on audit_logs', async () => {
    // Tester que seuls les service roles peuvent insérer
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        actor_id: testUserId,
        action: 'test_direct_insert',
        entity: 'test',
        data: {}
      });

    // L'insertion directe devrait échouer pour les non-service roles
    expect(error).toBeDefined();
    expect(error.message).toContain('permission denied');
  });
});
