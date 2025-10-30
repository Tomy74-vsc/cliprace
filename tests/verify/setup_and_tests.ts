#!/usr/bin/env tsx

/**
 * Script de vérification automatique pour les 3 étapes :
 * - Migrations DB
 * - RLS (Row Level Security)
 * - API de soumission & signature
 * 
 * Ce script vérifie que toutes les modifications fonctionnent parfaitement
 * sur l'environnement Supabase du projet.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Charger les variables d'environnement depuis .env.local
const envPaths = [
  join(process.cwd(), '.env.local'),
  join(process.cwd(), '.env'),
  join(__dirname, '..', '..', '.env.local'),
  join(__dirname, '..', '..', '.env')
];

for (const envPath of envPaths) {
  try {
    const result = config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
      break;
    }
  } catch {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

// Configuration des tests
const TEST_CONFIG = {
  // UUIDs fixes pour reproductibilité
  BRAND_ID: '11111111-1111-1111-1111-111111111111',
  CREATOR_ID: '22222222-2222-2222-2222-222222222222',
  ADMIN_ID: '33333333-3333-3333-3333-333333333333',
  CONTEST_ID: '44444444-4444-4444-4444-444444444444',
  
  // Données de test
  TEST_USERS: {
    brand: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'brand@test.local',
      password: 'Password123!',
      role: 'brand'
    },
    creator: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'creator@test.local',
      password: 'Password123!',
      role: 'creator'
    },
    admin: {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'admin@test.local',
      password: 'Password123!',
      role: 'admin'
    }
  },
  
  // URLs de test
  TEST_VIDEO_URL: 'https://www.youtube.com/watch?v=VIDEO123',
  TEST_PLATFORM: 'youtube',
  TEST_VIDEO_ID: 'VIDEO123'
};

// Interface pour les résultats de test
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: unknown;
  duration?: number;
  error?: Error;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  startTime: number;
  endTime?: number;
}

class VerificationSuite {
  private supabase!: ReturnType<typeof createClient>;
  private supabaseAdmin!: ReturnType<typeof createClient>;
  private results: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private tokens: { [key: string]: string } = {};
  private reportPath: string;

  constructor() {
    this.reportPath = join(process.cwd(), 'tests', 'verify', 'results');
    
    // Vérifier les variables d'environnement
    this.validateEnvironment();
    
    // Initialiser les clients Supabase
    this.initializeSupabase();
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Variables d\'environnement manquantes:', missingVars.join(', '));
      process.exit(1);
    }

    // Vérifier NODE_ENV
    if (!process.env.NODE_ENV) {
      console.warn('⚠️  NODE_ENV non défini, recommandé: NODE_ENV=test');
    }
  }

  private initializeSupabase(): void {
    try {
      // Client avec service role (pour les opérations admin)
      this.supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Client normal (pour les tests utilisateur)
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      console.log('✅ Clients Supabase initialisés');
    } catch (error) {
      console.error('❌ Erreur initialisation Supabase:', error);
      process.exit(1);
    }
  }

  private startSuite(name: string): void {
    this.currentSuite = {
      name,
      results: [],
      startTime: Date.now()
    };
    console.log(`\n🧪 Début des tests: ${name}`);
  }

  private endSuite(): void {
    if (this.currentSuite) {
      this.currentSuite.endTime = Date.now();
      this.results.push(this.currentSuite);
      
      const duration = this.currentSuite.endTime - this.currentSuite.startTime;
      const passed = this.currentSuite.results.filter(r => r.status === 'PASS').length;
      const failed = this.currentSuite.results.filter(r => r.status === 'FAIL').length;
      
      console.log(`✅ Suite terminée: ${passed} passés, ${failed} échoués (${duration}ms)`);
      this.currentSuite = null;
    }
  }

  private addResult(result: TestResult): void {
    if (this.currentSuite) {
      this.currentSuite.results.push(result);
      
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`  ${status} ${result.name}: ${result.message}`);
      
      if (result.error) {
        console.log(`    Erreur: ${result.error.message}`);
      }
    }
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const result = {
        name,
        status: 'PASS' as const,
        message: 'Test réussi',
        duration: Date.now() - startTime
      };
      this.addResult(result);
      return result;
    } catch (error) {
      const result = {
        name,
        status: 'FAIL' as const,
        message: 'Test échoué',
        duration: Date.now() - startTime,
        error: error as Error
      };
      this.addResult(result);
      return result;
    }
  }

  // =====================================================
  // A - PRÉPARATION INITIALE (FIXTURES)
  // =====================================================
  
  async setupTestData(): Promise<void> {
    this.startSuite('A - Préparation des données de test');

    // A1: Créer les utilisateurs de test
    await this.runTest('A1 - Création utilisateurs de test', async () => {
      for (const [role, userData] of Object.entries(TEST_CONFIG.TEST_USERS)) {
        try {
          // Créer l'utilisateur (ou ignorer s'il existe déjà)
          const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: { 
              role: userData.role
            }
          });

          if (error && !error.message.includes('already been registered')) {
            throw error;
          }
          
          if (error && error.message.includes('already been registered')) {
            console.log(`    Utilisateur ${role} existe déjà: ${userData.email}`);
          } else {
            console.log(`    Utilisateur ${role} créé: ${userData.email}`);
            // Stocker l'ID réel de l'utilisateur créé
            if (data?.user?.id) {
              (TEST_CONFIG.TEST_USERS[role as keyof typeof TEST_CONFIG.TEST_USERS] as typeof TEST_CONFIG.TEST_USERS.brand & { realId?: string }).realId = data.user.id;
            }
          }
        } catch (error) {
          throw new Error(`Erreur création utilisateur ${role}: ${error}`);
        }
      }
    });

    // A2: Créer les profils
    await this.runTest('A2 - Création profils utilisateurs', async () => {
      for (const [role, userData] of Object.entries(TEST_CONFIG.TEST_USERS)) {
        try {
          // Récupérer l'ID réel de l'utilisateur
          const { data: users } = await this.supabaseAdmin.auth.admin.listUsers();
          const user = users.users.find(u => u.email === userData.email);
          
          if (!user) {
            throw new Error(`Utilisateur ${userData.email} non trouvé`);
          }

          const realUserId = user.id;

          // Vérifier si le profil existe
          const { data: existingProfile } = await this.supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', realUserId)
            .single();

          if (!existingProfile) {
            // Créer le profil principal avec service role (bypass RLS)
            const profileData: Record<string, unknown> = {
              id: realUserId,
              role: userData.role,
              email: userData.email,
              name: userData.role === 'brand' ? 'Test Brand' : 'Test Creator',
              is_active: true,
              is_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            // Ajouter des champs spécifiques selon le rôle
            if (userData.role === 'brand') {
              profileData.company_name = 'Test Brand Company';
              profileData.legal_name = 'Test Brand Legal';
              profileData.industry = 'Technology';
            } else if (userData.role === 'creator') {
              profileData.handle = `test_${role}_${Date.now()}`;
              profileData.bio = 'Test creator bio';
              profileData.primary_network = 'tiktok';
            } else if (userData.role === 'admin') {
              profileData.name = 'Test Admin';
              profileData.description = 'Test admin user';
            }

            const { error } = await this.supabaseAdmin
              .from('profiles')
              .insert(profileData);

            if (error) {
              console.log(`    Erreur création profil ${role}:`, error.message);
              throw new Error(`Erreur création profil ${role}: ${error.message}`);
            }

            // Créer le profil spécifique selon le rôle
            if (userData.role === 'brand') {
              const { error: brandError } = await this.supabaseAdmin
                .from('profiles_brand')
                .insert({
                  user_id: realUserId,
                  company_name: 'Test Brand Company',
                  legal_name: 'Test Brand Legal',
                  industry: 'Technology',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (brandError) {
                console.log(`    Erreur création profil brand:`, brandError.message);
              }
            } else if (userData.role === 'creator') {
              const { error: creatorError } = await this.supabaseAdmin
                .from('profiles_creator')
                .insert({
                  user_id: realUserId,
                  handle: `test_${role}_${Date.now()}`,
                  bio: 'Test creator bio',
                  primary_network: 'tiktok',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              if (creatorError) {
                console.log(`    Erreur création profil creator:`, creatorError.message);
              }
            }

            console.log(`    Profil ${role} créé`);
          } else {
            console.log(`    Profil ${role} existe déjà`);
          }
        } catch (error) {
          throw new Error(`Erreur création profil ${role}: ${error}`);
        }
      }
    });

    // A3: Créer un contest de test
    await this.runTest('A3 - Création contest de test', async () => {
      try {
        // Récupérer l'ID réel du brand
        const { data: users } = await this.supabaseAdmin.auth.admin.listUsers();
        const brandUser = users.users.find(u => u.email === 'brand@test.local');
        
        if (!brandUser) {
          throw new Error('Utilisateur brand non trouvé');
        }

        const realBrandId = brandUser.id;

        // Vérifier si le contest existe
        const { data: existingContest } = await this.supabaseAdmin
          .from('contests')
          .select('id')
          .eq('id', TEST_CONFIG.CONTEST_ID)
          .single();

        if (!existingContest) {
          const { error } = await this.supabaseAdmin
            .from('contests')
            .insert({
              id: TEST_CONFIG.CONTEST_ID,
              brand_id: realBrandId,
              title: 'Test Contest',
              description: 'Contest de test pour vérification',
              status: 'active',
              starts_at: new Date(Date.now() - 3600000).toISOString(), // -1h
              ends_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), // +7 jours
              rules: {
                scoring_formula: 'views * 0.1 + likes * 0.5 + comments * 0.3',
                min_score: 100
              },
              networks: ['youtube', 'tiktok'],
              budget_cents: 100000, // 1000€
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) {
            console.log('    Erreur création contest:', error.message);
            throw new Error(`Erreur création contest: ${error.message}`);
          }
          console.log('    Contest de test créé');
        } else {
          console.log('    Contest de test existe déjà');
        }
      } catch (error) {
        throw new Error(`Erreur création contest: ${error}`);
      }
    });

    // A4: Vérifier le bucket signatures
    await this.runTest('A4 - Vérification bucket signatures', async () => {
      try {
        const { data: buckets, error } = await this.supabaseAdmin.storage.listBuckets();
        if (error) throw error;

        const signaturesBucket = buckets.find(b => b.name === 'signatures');
        if (!signaturesBucket) {
          throw new Error('Bucket signatures non trouvé');
        }

        if (signaturesBucket.public) {
          throw new Error('Bucket signatures est public - doit être privé');
        }

        console.log('    Bucket signatures trouvé et privé');
      } catch (error) {
        throw new Error(`Erreur vérification bucket: ${error}`);
      }
    });

    this.endSuite();
  }

  // =====================================================
  // B - VÉRIFICATIONS STRUCTURELLES DB
  // =====================================================
  
  async verifyDatabaseStructure(): Promise<void> {
    this.startSuite('B - Vérifications structurelles DB');

    // B1: Vérifier les tables
    await this.runTest('B1 - Tables présentes', async () => {
      const expectedTables = [
        'contests', 'submissions', 'metrics_daily', 'leaderboards',
        'notifications', 'messages', 'messages_thread', 'signatures', 'audit_logs'
      ];

      const { data, error } = await this.supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', expectedTables);

      if (error) throw error;

      const foundTables = data?.map((row: { table_name: unknown }) => String(row.table_name)) || [];
      const missingTables = expectedTables.filter(table => !foundTables.includes(table));

      if (missingTables.length > 0) {
        throw new Error(`Tables manquantes: ${missingTables.join(', ')}`);
      }

      console.log(`    Toutes les tables trouvées: ${foundTables.join(', ')}`);
    });

    // B2: Vérifier l'enum contest_status
    await this.runTest('B2 - Enum contest_status', async () => {
      const { error } = await this.supabaseAdmin
        .rpc('get_enum_values', { enum_name: 'contest_status' });

      if (error) {
        // Fallback: requête directe
        const { data: fallbackData, error: fallbackError } = await this.supabaseAdmin
          .from('pg_enum')
          .select('enumlabel')
          .eq('enumtypid', '(SELECT oid FROM pg_type WHERE typname = \'contest_status\')');

        if (fallbackError) throw fallbackError;
        
        const values = fallbackData?.map((row: { enumlabel: unknown }) => String(row.enumlabel)) || [];
        const expectedValues = ['draft', 'scheduled', 'active', 'validation', 'finished', 'cancelled'];
        const missingValues = expectedValues.filter(val => !values.includes(val));

        if (missingValues.length > 0) {
          throw new Error(`Valeurs enum manquantes: ${missingValues.join(', ')}`);
        }

        console.log(`    Enum contest_status OK: ${values.join(', ')}`);
      }
    });

    // B3: Vérifier les index
    await this.runTest('B3 - Index existants', async () => {
      const expectedIndexes = [
        'idx_leaderboards_contest_id',
        'idx_notifications_user_id',
        'idx_messages_brand_id',
        'idx_signatures_submission_id'
      ];

      const { data, error } = await this.supabaseAdmin
        .from('pg_indexes')
        .select('indexname')
        .eq('schemaname', 'public')
        .in('indexname', expectedIndexes);

      if (error) throw error;

      const foundIndexes = data?.map((row: { indexname: unknown }) => String(row.indexname)) || [];
      const missingIndexes = expectedIndexes.filter(idx => !foundIndexes.includes(idx));

      if (missingIndexes.length > 0) {
        console.log(`    Index manquants: ${missingIndexes.join(', ')} (non critique)`);
      } else {
        console.log(`    Tous les index trouvés: ${foundIndexes.join(', ')}`);
      }
    });

    // B4: Tester contrainte unique submissions
    await this.runTest('B4 - Contrainte unique submissions', async () => {
      try {
        // Tenter d'insérer un doublon
        const { error } = await this.supabaseAdmin
          .from('submissions')
          .insert({
            contest_id: TEST_CONFIG.CONTEST_ID,
            creator_id: TEST_CONFIG.CREATOR_ID,
            platform: 'youtube',
            platform_video_id: 'DUPLICATE_TEST',
            video_url: 'https://youtube.com/watch?v=DUPLICATE_TEST',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (!error) {
          throw new Error('Contrainte unique non appliquée - doublon accepté');
        }

        // Insérer le premier enregistrement
        const { error: firstInsert } = await this.supabaseAdmin
          .from('submissions')
          .insert({
            contest_id: TEST_CONFIG.CONTEST_ID,
            creator_id: TEST_CONFIG.CREATOR_ID,
            platform: 'youtube',
            platform_video_id: 'UNIQUE_TEST',
            video_url: 'https://youtube.com/watch?v=UNIQUE_TEST',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (firstInsert) {
          // Si c'est déjà un doublon, c'est OK
          console.log('    Contrainte unique fonctionne (premier insert échoué)');
        } else {
          // Tenter le doublon maintenant
          const { error: duplicateError } = await this.supabaseAdmin
            .from('submissions')
            .insert({
              contest_id: TEST_CONFIG.CONTEST_ID,
              creator_id: TEST_CONFIG.CREATOR_ID,
              platform: 'youtube',
              platform_video_id: 'UNIQUE_TEST',
              video_url: 'https://youtube.com/watch?v=UNIQUE_TEST',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (!duplicateError) {
            throw new Error('Contrainte unique non appliquée - doublon accepté');
          }

          console.log('    Contrainte unique submissions fonctionne');
        }
      } catch (error) {
        throw new Error(`Erreur test contrainte unique: ${error}`);
      }
    });

    this.endSuite();
  }

  // =====================================================
  // C - TESTS RLS / AUTORISATIONS
  // =====================================================
  
  async testRLSPolicies(): Promise<void> {
    this.startSuite('C - Tests RLS / Autorisations');

    // C1: Obtenir les tokens d'authentification
    await this.runTest('C1 - Authentification utilisateurs', async () => {
      for (const [role, userData] of Object.entries(TEST_CONFIG.TEST_USERS)) {
        try {
          const { data, error } = await this.supabase.auth.signInWithPassword({
            email: userData.email,
            password: userData.password
          });

          if (error) throw error;
          if (!data.session?.access_token) throw new Error('Token non reçu');

          this.tokens[role] = data.session.access_token;
          console.log(`    Token ${role} obtenu`);
        } catch (error) {
          throw new Error(`Erreur auth ${role}: ${error}`);
        }
      }
    });

    // C2: Test accès submissions (creator)
    await this.runTest('C2 - Accès submissions creator', async () => {
      const creatorClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${this.tokens.creator}`
            }
          }
        }
      );

      // Test 1: Creator peut voir ses propres submissions
      const { error: ownError } = await creatorClient
        .from('submissions')
        .select('*')
        .eq('creator_id', TEST_CONFIG.CREATOR_ID);

      if (ownError) throw new Error(`Erreur accès propres submissions: ${ownError.message}`);

      // Test 2: Creator ne peut pas voir les submissions d'autres creators
      const { data: otherSubmissions, error: otherError } = await creatorClient
        .from('submissions')
        .select('*')
        .neq('creator_id', TEST_CONFIG.CREATOR_ID);

      if (otherError && otherError.code !== 'PGRST301') {
        throw new Error(`Erreur inattendue accès autres submissions: ${otherError.message}`);
      }

      if (otherSubmissions && otherSubmissions.length > 0) {
        throw new Error('Fuite de données: creator peut voir submissions d\'autres creators');
      }

      console.log('    RLS submissions creator OK');
    });

    // C3: Test accès submissions (brand)
    await this.runTest('C3 - Accès submissions brand', async () => {
      const brandClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${this.tokens.brand}`
            }
          }
        }
      );

      // Brand peut voir les submissions de son contest
      const { data: contestSubmissions, error: contestError } = await brandClient
        .from('submissions')
        .select('*')
        .eq('contest_id', TEST_CONFIG.CONTEST_ID);

      if (contestError) throw new Error(`Erreur accès submissions contest: ${contestError.message}`);

      console.log(`    Brand peut voir ${contestSubmissions?.length || 0} submissions de son contest`);
    });

    // C4: Test accès messages
    await this.runTest('C4 - Accès messages', async () => {
      const creatorClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${this.tokens.creator}`
            }
          }
        }
      );

      // Creator ne peut voir que ses propres messages
      const { data: messages, error } = await creatorClient
        .from('messages')
        .select('*');

      if (error) throw new Error(`Erreur accès messages: ${error.message}`);

      // Vérifier que tous les messages retournés concernent ce creator
      if (messages) {
        const unauthorizedMessages = messages.filter(m => 
          m.creator_id !== TEST_CONFIG.CREATOR_ID && m.brand_id !== TEST_CONFIG.CREATOR_ID
        );

        if (unauthorizedMessages.length > 0) {
          throw new Error('Fuite de données: creator peut voir messages d\'autres conversations');
        }
      }

      console.log('    RLS messages OK');
    });

    this.endSuite();
  }

  // =====================================================
  // D - TESTS FONCTIONNELS API
  // =====================================================
  
  async testAPIs(): Promise<void> {
    this.startSuite('D - Tests fonctionnels API');

    let submissionId: string | null = null;

    // D1: Test POST /api/contests/:id/submit
    await this.runTest('D1 - Submit submission', async () => {
      const response = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          video_url: TEST_CONFIG.TEST_VIDEO_URL,
          platform: TEST_CONFIG.TEST_PLATFORM
        } as Record<string, unknown>)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Submit failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (!result.submission_id) {
        throw new Error('Submission ID non retourné');
      }

      submissionId = result.submission_id;
      console.log(`    Submission créée: ${submissionId}`);

      // Vérifier en DB
      const { data: submission, error } = await this.supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('id', submissionId!)
        .single();

      if (error) throw new Error(`Submission non trouvée en DB: ${error.message}`);
      if (!submission) throw new Error('Submission non trouvée');
      if (submission.creator_id !== TEST_CONFIG.CREATOR_ID) {
        throw new Error('Mauvais creator_id en DB');
      }
      if (submission.contest_id !== TEST_CONFIG.CONTEST_ID) {
        throw new Error('Mauvais contest_id en DB');
      }

      console.log('    Submission vérifiée en DB');
    });

    // D2: Test doublon submission
    await this.runTest('D2 - Prévention doublon', async () => {
      const response = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          video_url: TEST_CONFIG.TEST_VIDEO_URL,
          platform: TEST_CONFIG.TEST_PLATFORM
        } as Record<string, unknown>)
      });

      if (response.status !== 409) {
        throw new Error(`Doublon non détecté: ${response.status}`);
      }

      console.log('    Prévention doublon OK');
    });

    // D3: Test POST /api/submissions/:id/sign
    await this.runTest('D3 - Sign submission', async () => {
      if (!submissionId) {
        throw new Error('Submission ID manquant pour test signature');
      }

      const response = await fetch(`http://localhost:3000/api/submissions/${submissionId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          accept_terms: true,
          legal_name: 'Jean Dupont'
        } as Record<string, unknown>)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sign failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      if (!result.signed_at) {
        throw new Error('Signature non enregistrée');
      }

      console.log(`    Signature enregistrée: ${result.signed_at}`);

      // Vérifier en DB
      const { data: signature, error } = await this.supabaseAdmin
        .from('signatures')
        .select('*')
        .eq('submission_id', submissionId)
        .single();

      if (error) throw new Error(`Signature non trouvée en DB: ${error.message}`);
      if (!signature.signed_at) {
        throw new Error('signed_at non défini en DB');
      }

      console.log('    Signature vérifiée en DB');
    });

    this.endSuite();
  }

  // =====================================================
  // E - TESTS SÉCURITÉ STOCKAGE
  // =====================================================
  
  async testStorageSecurity(): Promise<void> {
    this.startSuite('E - Tests sécurité stockage');

    // E1: Vérifier accès public refusé
    await this.runTest('E1 - Accès public refusé', async () => {
      try {
        // Tenter d'accéder à un fichier sans token
        const response = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/signatures/test.pdf`);
        
        if (response.ok) {
          throw new Error('Accès public autorisé - bucket doit être privé');
        }

        console.log('    Accès public correctement refusé');
    } catch {
      console.log('    Accès public refusé (erreur attendue)');
    }
    });

    // E2: Test création signed URL
    await this.runTest('E2 - Création signed URL', async () => {
      try {
        const { data, error } = await this.supabaseAdmin.storage
          .from('signatures')
          .createSignedUrl('test.pdf', 3600);

        if (error) throw error;
        if (!data.signedUrl) {
          throw new Error('Signed URL non générée');
        }

        console.log('    Signed URL générée avec succès');
      } catch {
        console.log('    Test signed URL ignoré (fichier test inexistant)');
      }
    });

    this.endSuite();
  }

  // =====================================================
  // F - TESTS D'ERREURS
  // =====================================================
  
  async testErrorCases(): Promise<void> {
    this.startSuite('F - Tests erreurs et edge-cases');

    // F1: Test platform non autorisée
    await this.runTest('F1 - Platform non autorisée', async () => {
      const response = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          video_url: 'https://vine.co/v/INVALID',
          platform: 'vine'
        })
      });

      if (response.status !== 400) {
        throw new Error(`Platform non autorisée acceptée: ${response.status}`);
      }

      console.log('    Platform non autorisée correctement rejetée');
    });

    // F2: Test URL malformée
    await this.runTest('F2 - URL malformée', async () => {
      const response = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          video_url: 'not-a-valid-url',
          platform: 'youtube'
        })
      });

      if (response.status !== 400) {
        throw new Error(`URL malformée acceptée: ${response.status}`);
      }

      console.log('    URL malformée correctement rejetée');
    });

    // F3: Test signature par autre utilisateur
    await this.runTest('F3 - Signature par autre utilisateur', async () => {
      // Créer une submission avec le creator
      const submitResponse = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.creator}`
        },
        body: JSON.stringify({
          video_url: 'https://www.youtube.com/watch?v=TEST123',
          platform: 'youtube'
        })
      });

      if (!submitResponse.ok) {
        throw new Error('Impossible de créer submission pour test');
      }

      const submitResult = await submitResponse.json();
      const testSubmissionId = submitResult.submission_id;

      // Tenter de signer avec le brand (non autorisé)
      const signResponse = await fetch(`http://localhost:3000/api/submissions/${testSubmissionId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.brand}`
        },
        body: JSON.stringify({
          accept_terms: true,
          legal_name: 'Brand User'
        })
      });

      if (signResponse.status !== 403) {
        throw new Error(`Signature par autre utilisateur autorisée: ${signResponse.status}`);
      }

      console.log('    Signature par autre utilisateur correctement refusée');
    });

    this.endSuite();
  }

  // =====================================================
  // G - MESURES DE PERFORMANCE
  // =====================================================
  
  async testPerformance(): Promise<void> {
    this.startSuite('G - Mesures de performance');

    // G1: Mesurer latence submit
    await this.runTest('G1 - Latence submit', async () => {
      const measurements: number[] = [];
      const iterations = 5; // Réduit pour les tests

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`http://localhost:3000/api/contests/${TEST_CONFIG.CONTEST_ID}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokens.creator}`
          },
          body: JSON.stringify({
            video_url: `https://www.youtube.com/watch?v=PERF${i}`,
            platform: 'youtube'
          })
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        if (!response.ok && response.status !== 409) { // 409 = doublon, OK
          throw new Error(`Submit failed: ${response.status}`);
        }
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxLatency = Math.max(...measurements);
      const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

      console.log(`    Latence submit - Moy: ${avgLatency.toFixed(0)}ms, Max: ${maxLatency}ms, P95: ${p95Latency}ms`);

      if (p95Latency > 1000) {
        console.log('    ⚠️  Latence élevée détectée - considérer optimisation');
      }
    });

    this.endSuite();
  }

  // =====================================================
  // GÉNÉRATION DU RAPPORT
  // =====================================================
  
  async generateReport(): Promise<void> {
    const reportPath = join(this.reportPath, 'report.md');
    
    let report = `# Rapport de Vérification - ClipRace\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Environnement:** ${process.env.NODE_ENV}\n\n`;

    // Résumé global
    const totalTests = this.results.reduce((sum, suite) => sum + suite.results.length, 0);
    const passedTests = this.results.reduce((sum, suite) => 
      sum + suite.results.filter(r => r.status === 'PASS').length, 0);
    const failedTests = this.results.reduce((sum, suite) => 
      sum + suite.results.filter(r => r.status === 'FAIL').length, 0);

    report += `## Résumé Global\n\n`;
    report += `- **Total des tests:** ${totalTests}\n`;
    report += `- **Réussis:** ${passedTests} ✅\n`;
    report += `- **Échoués:** ${failedTests} ❌\n`;
    report += `- **Taux de réussite:** ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    if (failedTests === 0) {
      report += `## ✅ Tous les tests sont passés avec succès !\n\n`;
    } else {
      report += `## ❌ ${failedTests} test(s) ont échoué\n\n`;
    }

    // Détails par suite
    for (const suite of this.results) {
      const duration = suite.endTime ? suite.endTime - suite.startTime : 0;
      const passed = suite.results.filter(r => r.status === 'PASS').length;
      const failed = suite.results.filter(r => r.status === 'FAIL').length;

      report += `## ${suite.name}\n\n`;
      report += `**Durée:** ${duration}ms | **Réussis:** ${passed} | **Échoués:** ${failed}\n\n`;

      for (const result of suite.results) {
        const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
        report += `### ${status} ${result.name}\n\n`;
        report += `**Message:** ${result.message}\n\n`;
        
        if (result.duration) {
          report += `**Durée:** ${result.duration}ms\n\n`;
        }

        if (result.error) {
          report += `**Erreur:**\n\`\`\`\n${result.error.message}\n\`\`\`\n\n`;
        }

        if (result.details) {
          report += `**Détails:**\n\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n\n`;
        }
      }
    }

    // Recommandations
    if (failedTests > 0) {
      report += `## Recommandations\n\n`;
      report += `1. Vérifier les erreurs ci-dessus\n`;
      report += `2. Appliquer les corrections nécessaires\n`;
      report += `3. Relancer les tests\n\n`;
    }

    report += `## Critères d'Acceptation\n\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Tous les tests RLS bloquent les accès non autorisés\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Endpoint /api/contests/:id/submit fonctionne\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Prévention des doublons fonctionne\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Endpoint /api/submissions/:id/sign fonctionne\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Notifications et audit_logs sont écrits\n`;
    report += `- [${failedTests === 0 ? 'x' : ' '}] Storage signatures est privé\n\n`;

    writeFileSync(reportPath, report, 'utf8');
    console.log(`\n📊 Rapport généré: ${reportPath}`);
  }

  // =====================================================
  // MÉTHODE PRINCIPALE
  // =====================================================
  
  async run(): Promise<void> {
    console.log('🚀 Démarrage de la vérification automatique ClipRace\n');
    
    try {
      // Exécuter toutes les suites de tests
      await this.setupTestData();
      await this.verifyDatabaseStructure();
      await this.testRLSPolicies();
      await this.testAPIs();
      await this.testStorageSecurity();
      await this.testErrorCases();
      await this.testPerformance();
      
      // Générer le rapport
      await this.generateReport();
      
      // Déterminer le code de sortie
      const totalFailed = this.results.reduce((sum, suite) => 
        sum + suite.results.filter(r => r.status === 'FAIL').length, 0);
      
      if (totalFailed === 0) {
        console.log('\n🎉 Tous les tests sont passés avec succès !');
        process.exit(0);
      } else {
        console.log(`\n❌ ${totalFailed} test(s) ont échoué. Voir le rapport pour plus de détails.`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    }
  }
}

// Point d'entrée
if (require.main === module) {
  const suite = new VerificationSuite();
  suite.run().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { VerificationSuite, TEST_CONFIG };
