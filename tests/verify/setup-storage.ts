#!/usr/bin/env tsx

/**
 * Script pour configurer le storage Supabase
 * Crée le bucket signatures s'il n'existe pas
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Charger les variables d'environnement
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
  } catch (error) {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

async function setupStorage() {
  console.log('🔧 Configuration du storage Supabase\n');

  try {
    // Initialiser le client Supabase avec service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1. Vérifier les buckets existants
    console.log('1. Vérification des buckets existants...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Erreur lors de la récupération des buckets:', listError.message);
      return;
    }

    console.log('Buckets existants:');
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (public: ${bucket.public})`);
    });

    // 2. Vérifier si le bucket signatures existe
    const signaturesBucket = buckets.find(b => b.name === 'signatures');
    
    if (signaturesBucket) {
      console.log('\n✅ Bucket signatures existe déjà');
      if (signaturesBucket.public) {
        console.log('⚠️  Bucket signatures est public - recommandé de le rendre privé');
      } else {
        console.log('✅ Bucket signatures est privé (sécurisé)');
      }
    } else {
      console.log('\n2. Création du bucket signatures...');
      
      // Créer le bucket signatures
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('signatures', {
        public: false, // Bucket privé pour la sécurité
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg']
      });

      if (createError) {
        console.error('❌ Erreur lors de la création du bucket:', createError.message);
        return;
      }

      console.log('✅ Bucket signatures créé avec succès');
    }

    // 3. Tester l'accès au bucket
    console.log('\n3. Test d\'accès au bucket...');
    
    // Tenter de lister les fichiers (doit fonctionner avec service role)
    const { data: files, error: filesError } = await supabase.storage
      .from('signatures')
      .list();

    if (filesError) {
      console.error('❌ Erreur lors de l\'accès au bucket:', filesError.message);
    } else {
      console.log(`✅ Accès au bucket OK (${files.length} fichiers)`);
    }

    // 4. Tester la création d'un fichier de test
    console.log('\n4. Test de création de fichier...');
    
    const testContent = 'Test file content';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('signatures')
      .upload('test.txt', testContent, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Erreur lors de l\'upload:', uploadError.message);
    } else {
      console.log('✅ Fichier de test créé:', uploadData.path);
      
      // Nettoyer le fichier de test
      const { error: deleteError } = await supabase.storage
        .from('signatures')
        .remove(['test.txt']);
      
      if (deleteError) {
        console.log('⚠️  Impossible de supprimer le fichier de test:', deleteError.message);
      } else {
        console.log('✅ Fichier de test supprimé');
      }
    }

    console.log('\n🎉 Configuration du storage terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupStorage().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { setupStorage };
