#!/usr/bin/env tsx

/**
 * Test rapide pour vérifier que l'environnement est correctement configuré
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
      console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
      break;
    }
  } catch (error) {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

async function quickTest() {
  console.log('🧪 Test rapide de l\'environnement ClipRace\n');

  // Afficher toutes les variables d'environnement disponibles
  console.log('Variables d\'environnement disponibles:');
  Object.keys(process.env)
    .filter(key => key.includes('SUPABASE'))
    .forEach(key => {
      const value = process.env[key];
      console.log(`  ${key}: ${value ? '✅ Définie' : '❌ Non définie'}`);
    });

  // Vérifier les variables d'environnement
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  console.log('\n1. Vérification des variables d\'environnement...');
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Variables manquantes:', missingVars.join(', '));
    console.log('\nVariables disponibles dans .env.local:');
    Object.keys(process.env)
      .filter(key => key.includes('SUPABASE'))
      .forEach(key => {
        console.log(`  ${key}`);
      });
    process.exit(1);
  }
  console.log('✅ Variables d\'environnement OK\n');

  // Tester la connexion Supabase
  console.log('2. Test de connexion Supabase...');
  try {
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

    // Test simple de requête
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ Connexion Supabase OK\n');
  } catch (error) {
    console.error('❌ Erreur connexion Supabase:', error);
    process.exit(1);
  }

  // Vérifier les tables principales
  console.log('3. Vérification des tables principales...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const expectedTables = [
      'contests', 'submissions', 'profiles', 'signatures'
    ];

    // Test simple de chaque table
    const foundTables: string[] = [];
    for (const table of expectedTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (!error) {
          foundTables.push(table);
        }
      } catch {
        // Table n'existe pas ou erreur d'accès
      }
    }

    const missingTables = expectedTables.filter(table => !foundTables.includes(table));

    if (missingTables.length > 0) {
      console.warn('⚠️  Tables manquantes:', missingTables.join(', '));
    } else {
      console.log('✅ Tables principales trouvées\n');
    }
  } catch (error) {
    console.error('❌ Erreur vérification tables:', error);
    process.exit(1);
  }

  console.log('🎉 Test rapide réussi ! L\'environnement est prêt pour les tests complets.');
  console.log('\nPour exécuter tous les tests:');
  console.log('  npm run verify:final');
  console.log('\nOu manuellement:');
  console.log('  tsx tests/verify/setup_and_tests.ts');
}

if (require.main === module) {
  quickTest().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { quickTest };
