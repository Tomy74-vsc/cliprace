/**
 * Tests RLS (Row Level Security) effectifs
 * Vérification que les politiques RLS fonctionnent correctement
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { 
  createPgClient, 
  createCreatorClient, 
  createAdminClient, 
  createAnonClient, 
  createServiceRoleClient,
  createAndConnectCreatorClient,
  createAndConnectAdminClient,
  createAndConnectAnonClient,
  createAndConnectServiceRoleClient,
  expectRLSFailure,
  expectRLSPass
} from '../utils/pgClient';

describe('RLS Tests - Moderation Tables', () => {
  let creatorClient: any;
  let adminClient: any;
  let anonClient: any;
  let serviceRoleClient: any;
  
  const testSubmissionId = '00000000-0000-0000-0000-000000000001';
  const testCreatorId = 'creator-user-id';
  const testAdminId = 'admin-user-id';

  beforeAll(async () => {
    // Créer et connecter les clients de test
    creatorClient = await createAndConnectCreatorClient(testCreatorId);
    adminClient = await createAndConnectAdminClient(testAdminId);
    anonClient = await createAndConnectAnonClient();
    serviceRoleClient = await createAndConnectServiceRoleClient();
  });

  afterAll(async () => {
    // Fermer toutes les connexions
    await Promise.all([
      creatorClient?.end(),
      adminClient?.end(),
      anonClient?.end(),
      serviceRoleClient?.end()
    ]);
  });

  beforeEach(async () => {
    // Nettoyer les données de test avant chaque test
    await serviceRoleClient.query('DELETE FROM moderation_queue WHERE submission_id = $1', [testSubmissionId]);
    await serviceRoleClient.query('DELETE FROM moderation_rules WHERE name LIKE $1', ['Test Rule%']);
  });

  describe('moderation_queue RLS', () => {
    it('should deny anon access to moderation_queue', async () => {
      // Anon ne peut pas voir la queue - doit échouer avec erreur RLS
      const canSelect = await expectRLSFailure(anonClient, 'SELECT * FROM moderation_queue LIMIT 1');
      expect(canSelect).toBe(true);

      // Anon ne peut pas insérer - doit échouer avec erreur RLS
      const canInsert = await expectRLSFailure(
        anonClient, 
        'INSERT INTO moderation_queue (submission_id, status) VALUES ($1, $2)',
        [testSubmissionId, 'pending']
      );
      expect(canInsert).toBe(true);
    });

    it('should deny creator access to moderation_queue', async () => {
      // Creator ne peut pas voir la queue - doit échouer avec erreur RLS
      const canSelect = await expectRLSFailure(creatorClient, 'SELECT * FROM moderation_queue LIMIT 1');
      expect(canSelect).toBe(true);

      // Creator ne peut pas insérer - doit échouer avec erreur RLS
      const canInsert = await expectRLSFailure(
        creatorClient, 
        'INSERT INTO moderation_queue (submission_id, status) VALUES ($1, $2)',
        [testSubmissionId, 'pending']
      );
      expect(canInsert).toBe(true);
    });

    it('should allow admin access to moderation_queue', async () => {
      // Admin peut voir la queue
      const canSelect = await expectRLSPass(adminClient, 'SELECT * FROM moderation_queue LIMIT 1');
      expect(canSelect).toBe(true);

      // Admin peut insérer
      const canInsert = await expectRLSPass(
        adminClient, 
        'INSERT INTO moderation_queue (submission_id, status) VALUES ($1, $2)',
        [testSubmissionId, 'pending']
      );
      expect(canInsert).toBe(true);

      // Admin peut modifier
      const canUpdate = await expectRLSPass(
        adminClient, 
        'UPDATE moderation_queue SET status = $1 WHERE submission_id = $2',
        ['processing', testSubmissionId]
      );
      expect(canUpdate).toBe(true);
    });

    it('should allow service role full access to moderation_queue', async () => {
      // Service role peut tout faire
      const canSelect = await expectRLSPass(serviceRoleClient, 'SELECT * FROM moderation_queue LIMIT 1');
      expect(canSelect).toBe(true);

      const canInsert = await expectRLSPass(
        serviceRoleClient, 
        'INSERT INTO moderation_queue (submission_id, status) VALUES ($1, $2)',
        [testSubmissionId, 'pending']
      );
      expect(canInsert).toBe(true);
    });
  });

  describe('moderation_rules RLS', () => {
    it('should deny anon access to moderation_rules', async () => {
      // Anon ne peut pas voir les règles - doit échouer avec erreur RLS
      const canSelect = await expectRLSFailure(anonClient, 'SELECT * FROM moderation_rules LIMIT 1');
      expect(canSelect).toBe(true);

      // Anon ne peut pas insérer - doit échouer avec erreur RLS
      const canInsert = await expectRLSFailure(
        anonClient, 
        'INSERT INTO moderation_rules (name, rule_type, config, created_by) VALUES ($1, $2, $3, $4)',
        ['Test Rule Anon', 'test', '{}', testCreatorId]
      );
      expect(canInsert).toBe(true);
    });

    it('should deny creator access to moderation_rules', async () => {
      // Creator ne peut pas voir les règles - doit échouer avec erreur RLS
      const canSelect = await expectRLSFailure(creatorClient, 'SELECT * FROM moderation_rules LIMIT 1');
      expect(canSelect).toBe(true);

      // Creator ne peut pas insérer - doit échouer avec erreur RLS
      const canInsert = await expectRLSFailure(
        creatorClient, 
        'INSERT INTO moderation_rules (name, rule_type, config, created_by) VALUES ($1, $2, $3, $4)',
        ['Test Rule Creator', 'test', '{}', testCreatorId]
      );
      expect(canInsert).toBe(true);
    });

    it('should allow admin access to moderation_rules', async () => {
      // Admin peut voir les règles
      const canSelect = await expectRLSPass(adminClient, 'SELECT * FROM moderation_rules LIMIT 1');
      expect(canSelect).toBe(true);

      // Admin peut insérer
      const canInsert = await expectRLSPass(
        adminClient, 
        'INSERT INTO moderation_rules (name, rule_type, config, created_by) VALUES ($1, $2, $3, $4)',
        ['Test Rule Admin', 'test', '{}', testAdminId]
      );
      expect(canInsert).toBe(true);

      // Admin peut modifier
      const canUpdate = await expectRLSPass(
        adminClient, 
        'UPDATE moderation_rules SET name = $1 WHERE name = $2',
        ['Test Rule Admin Updated', 'Test Rule Admin']
      );
      expect(canUpdate).toBe(true);
    });

    it('should allow service role full access to moderation_rules', async () => {
      // Service role peut tout faire
      const canSelect = await expectRLSPass(serviceRoleClient, 'SELECT * FROM moderation_rules LIMIT 1');
      expect(canSelect).toBe(true);

      const canInsert = await expectRLSPass(
        serviceRoleClient, 
        'INSERT INTO moderation_rules (name, rule_type, config, created_by) VALUES ($1, $2, $3, $4)',
        ['Test Rule Service', 'test', '{}', testAdminId]
      );
      expect(canInsert).toBe(true);
    });
  });

  describe('audit_logs RLS', () => {
    it('should allow service role to insert audit logs', async () => {
      const canInsert = await expectRLSPass(
        serviceRoleClient,
        'INSERT INTO audit_logs (actor_id, action, entity, data) VALUES ($1, $2, $3, $4)',
        [testAdminId, 'test_action', 'test_entity', '{}']
      );
      expect(canInsert).toBe(true);
    });

    it('should allow RPC insert_audit_log for service role', async () => {
      const canRPC = await expectRLSPass(
        serviceRoleClient,
        'SELECT insert_audit_log($1, $2, $3, $4, $5, $6, $7)',
        [testAdminId, 'test_action', 'test_entity', null, '{}', null, null]
      );
      expect(canRPC).toBe(true);
    });

    it('should deny direct insert for non-service role', async () => {
      const canInsert = await expectRLSFailure(
        adminClient,
        'INSERT INTO audit_logs (actor_id, action, entity, data) VALUES ($1, $2, $3, $4)',
        [testAdminId, 'test_action', 'test_entity', '{}']
      );
      expect(canInsert).toBe(true);
    });
  });

  describe('RLS Policy Verification', () => {
    it('should verify RLS is enabled on moderation tables', async () => {
      const result = await serviceRoleClient.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename IN ('moderation_queue', 'moderation_rules')
        AND schemaname = 'public'
      `);

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((row: any) => row.rowsecurity)).toBe(true);
    });

    it('should verify policies exist for moderation tables', async () => {
      const result = await serviceRoleClient.query(`
        SELECT tablename, policyname, cmd
        FROM pg_policies
        WHERE tablename IN ('moderation_queue', 'moderation_rules')
        AND schemaname = 'public'
        ORDER BY tablename, policyname
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Vérifier qu'il y a des politiques pour les admins
      const adminPolicies = result.rows.filter((row: any) => 
        row.policyname.includes('Admins')
      );
      expect(adminPolicies.length).toBeGreaterThan(0);
    });
  });
});
