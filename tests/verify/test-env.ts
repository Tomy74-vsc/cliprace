#!/usr/bin/env tsx

/**
 * Test simple pour vérifier le chargement des variables d'environnement
 */

import { config } from 'dotenv';
import { join } from 'path';

// Charger les variables d'environnement depuis .env.local
config({ path: join(process.cwd(), '.env.local') });

console.log('🔍 Test de chargement des variables d\'environnement\n');

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL'
];

console.log('Variables chargées:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: NON DÉFINIE`);
  }
});

console.log('\nToutes les variables d\'environnement:');
Object.keys(process.env)
  .filter(key => key.includes('SUPABASE'))
  .forEach(key => {
    const value = process.env[key];
    console.log(`${key}: ${value ? value.substring(0, 30) + '...' : 'NON DÉFINIE'}`);
  });
