#!/usr/bin/env tsx

/**
 * Script de nettoyage des données de test
 * Supprime toutes les données créées lors des tests
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

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
      break;
    }
  } catch {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

const TEST_CONFIG = {
  BRAND_ID: '11111111-1111-1111-1111-111111111111',
  CREATOR_ID: '22222222-2222-2222-2222-222222222222',
  ADMIN_ID: '33333333-3333-3333-3333-333333333333',
  CONTEST_ID: '44444444-4444-4444-4444-444444444444',
};

class TestDataCleanup {
  private supabase!: ReturnType<typeof createClient>;

  constructor() {
    this.validateEnvironment();
    this.initializeSupabase();
  }

  private validateEnvironment(): void {
    const requiredVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Variables d\'environnement manquantes:', missingVars.join(', '));
      process.exit(1);
    }
  }

  private initializeSupabase(): void {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Démarrage du nettoyage des données de test\n');

    try {
      // 1. Supprimer les signatures de test
      await this.cleanupSignatures();
      
      // 2. Supprimer les soumissions de test
      await this.cleanupSubmissions();
      
      // 3. Supprimer les notifications de test
      await this.cleanupNotifications();
      
      // 4. Supprimer les messages de test
      await this.cleanupMessages();
      
      // 5. Supprimer les leaderboards de test
      await this.cleanupLeaderboards();
      
      // 6. Supprimer les metrics de test
      await this.cleanupMetrics();
      
      // 7. Supprimer le contest de test
      await this.cleanupContest();
      
      // 8. Supprimer les profils de test
      await this.cleanupProfiles();
      
      // 9. Supprimer les utilisateurs de test
      await this.cleanupUsers();
      
      // 10. Nettoyer le storage
      await this.cleanupStorage();

      console.log('\n✅ Nettoyage terminé avec succès');
      
    } catch (error) {
      console.error('\n❌ Erreur lors du nettoyage:', error);
      process.exit(1);
    }
  }

  private async cleanupSignatures(): Promise<void> {
    console.log('🗑️  Suppression des signatures de test...');
    
    try {
      // Supprimer les signatures liées aux soumissions de test
      const { error } = await this.supabase
        .from('signatures')
        .delete()
        .in('submission_id', 
          await this.getTestSubmissionIds()
        );

      if (error) {
        console.log(`   ⚠️  Erreur signatures: ${error.message}`);
      } else {
        console.log('   ✅ Signatures supprimées');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur signatures: ${error}`);
    }
  }

  private async cleanupSubmissions(): Promise<void> {
    console.log('🗑️  Suppression des soumissions de test...');
    
    try {
      const { error } = await this.supabase
        .from('submissions')
        .delete()
        .eq('contest_id', TEST_CONFIG.CONTEST_ID);

      if (error) {
        console.log(`   ⚠️  Erreur soumissions: ${error.message}`);
      } else {
        console.log('   ✅ Soumissions supprimées');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur soumissions: ${error}`);
    }
  }

  private async cleanupNotifications(): Promise<void> {
    console.log('🗑️  Suppression des notifications de test...');
    
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .in('user_id', [
          TEST_CONFIG.BRAND_ID,
          TEST_CONFIG.CREATOR_ID,
          TEST_CONFIG.ADMIN_ID
        ]);

      if (error) {
        console.log(`   ⚠️  Erreur notifications: ${error.message}`);
      } else {
        console.log('   ✅ Notifications supprimées');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur notifications: ${error}`);
    }
  }

  private async cleanupMessages(): Promise<void> {
    console.log('🗑️  Suppression des messages de test...');
    
    try {
      // Supprimer les messages_thread d'abord
      const { data: messages } = await this.supabase
        .from('messages')
        .select('id')
        .or(`brand_id.eq.${TEST_CONFIG.BRAND_ID},creator_id.eq.${TEST_CONFIG.CREATOR_ID}`);

      if (messages && messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        
        const { error: threadError } = await this.supabase
          .from('messages_thread')
          .delete()
          .in('thread_id', messageIds);

        if (threadError) {
          console.log(`   ⚠️  Erreur messages_thread: ${threadError.message}`);
        }

        // Supprimer les messages
        const { error: messagesError } = await this.supabase
          .from('messages')
          .delete()
          .in('id', messageIds);

        if (messagesError) {
          console.log(`   ⚠️  Erreur messages: ${messagesError.message}`);
        } else {
          console.log('   ✅ Messages supprimés');
        }
      } else {
        console.log('   ✅ Aucun message de test trouvé');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur messages: ${error}`);
    }
  }

  private async cleanupLeaderboards(): Promise<void> {
    console.log('🗑️  Suppression des leaderboards de test...');
    
    try {
      const { error } = await this.supabase
        .from('leaderboards')
        .delete()
        .eq('contest_id', TEST_CONFIG.CONTEST_ID);

      if (error) {
        console.log(`   ⚠️  Erreur leaderboards: ${error.message}`);
      } else {
        console.log('   ✅ Leaderboards supprimés');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur leaderboards: ${error}`);
    }
  }

  private async cleanupMetrics(): Promise<void> {
    console.log('🗑️  Suppression des metrics de test...');
    
    try {
      const submissionIds = await this.getTestSubmissionIds();
      
      if (submissionIds.length > 0) {
        const { error } = await this.supabase
          .from('metrics_daily')
          .delete()
          .in('submission_id', submissionIds);

        if (error) {
          console.log(`   ⚠️  Erreur metrics: ${error.message}`);
        } else {
          console.log('   ✅ Metrics supprimées');
        }
      } else {
        console.log('   ✅ Aucune metric de test trouvée');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur metrics: ${error}`);
    }
  }

  private async cleanupContest(): Promise<void> {
    console.log('🗑️  Suppression du contest de test...');
    
    try {
      const { error } = await this.supabase
        .from('contests')
        .delete()
        .eq('id', TEST_CONFIG.CONTEST_ID);

      if (error) {
        console.log(`   ⚠️  Erreur contest: ${error.message}`);
      } else {
        console.log('   ✅ Contest supprimé');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur contest: ${error}`);
    }
  }

  private async cleanupProfiles(): Promise<void> {
    console.log('🗑️  Suppression des profils de test...');
    
    try {
      const { error } = await this.supabase
        .from('profiles')
        .delete()
        .in('id', [
          TEST_CONFIG.BRAND_ID,
          TEST_CONFIG.CREATOR_ID,
          TEST_CONFIG.ADMIN_ID
        ]);

      if (error) {
        console.log(`   ⚠️  Erreur profils: ${error.message}`);
      } else {
        console.log('   ✅ Profils supprimés');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur profils: ${error}`);
    }
  }

  private async cleanupUsers(): Promise<void> {
    console.log('🗑️  Suppression des utilisateurs de test...');
    
    try {
      const userIds = [
        TEST_CONFIG.BRAND_ID,
        TEST_CONFIG.CREATOR_ID,
        TEST_CONFIG.ADMIN_ID
      ];

      for (const userId of userIds) {
        try {
          const { error } = await this.supabase.auth.admin.deleteUser(userId);
          if (error) {
            console.log(`   ⚠️  Erreur suppression utilisateur ${userId}: ${error.message}`);
          } else {
            console.log(`   ✅ Utilisateur ${userId} supprimé`);
          }
        } catch (error) {
          console.log(`   ⚠️  Erreur suppression utilisateur ${userId}: ${error}`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur utilisateurs: ${error}`);
    }
  }

  private async cleanupStorage(): Promise<void> {
    console.log('🗑️  Nettoyage du storage...');
    
    try {
      // Lister les fichiers dans le bucket signatures
      const { data: files, error: listError } = await this.supabase.storage
        .from('signatures')
        .list();

      if (listError) {
        console.log(`   ⚠️  Erreur listage storage: ${listError.message}`);
        return;
      }

      if (files && files.length > 0) {
        // Supprimer les fichiers de test (ceux qui contiennent nos IDs de test)
        const testFiles = files.filter(file => 
          file.name.includes(TEST_CONFIG.CONTEST_ID) ||
          file.name.includes(TEST_CONFIG.CREATOR_ID) ||
          file.name.includes('TEST') ||
          file.name.includes('PERF')
        );

        if (testFiles.length > 0) {
          const filePaths = testFiles.map(file => file.name);
          
          const { error: deleteError } = await this.supabase.storage
            .from('signatures')
            .remove(filePaths);

          if (deleteError) {
            console.log(`   ⚠️  Erreur suppression storage: ${deleteError.message}`);
          } else {
            console.log(`   ✅ ${testFiles.length} fichiers de test supprimés du storage`);
          }
        } else {
          console.log('   ✅ Aucun fichier de test trouvé dans le storage');
        }
      } else {
        console.log('   ✅ Aucun fichier dans le storage');
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur storage: ${error}`);
    }
  }

  private async getTestSubmissionIds(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .select('id')
        .eq('contest_id', TEST_CONFIG.CONTEST_ID);

      if (error) {
        console.log(`   ⚠️  Erreur récupération submission IDs: ${error.message}`);
        return [];
      }

      return data ? data.map((s: { id: unknown }) => s.id as string) : [];
    } catch (error) {
      console.log(`   ⚠️  Erreur récupération submission IDs: ${error}`);
      return [];
    }
  }
}

// Point d'entrée
if (require.main === module) {
  const cleanup = new TestDataCleanup();
  cleanup.cleanup().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { TestDataCleanup };
