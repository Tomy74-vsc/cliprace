#!/usr/bin/env tsx

/**
 * Tests de performance pour les endpoints critiques
 * Mesure la latence des API de soumission et signature
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
      break;
    }
  } catch {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

interface PerformanceResult {
  endpoint: string;
  method: string;
  iterations: number;
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  errors: string[];
}

class PerformanceTester {
  private supabase!: ReturnType<typeof createClient>;
  private tokens: { [key: string]: string } = {};
  private results: PerformanceResult[] = [];

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
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
  }

  private async authenticateUsers(): Promise<void> {
    const users = [
      { role: 'creator', email: 'creator@test.local', password: 'Password123!' },
      { role: 'brand', email: 'brand@test.local', password: 'Password123!' }
    ];

    for (const user of users) {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });

      if (error) throw new Error(`Auth failed for ${user.role}: ${error.message}`);
      if (!data.session?.access_token) throw new Error(`No token for ${user.role}`);

      this.tokens[user.role] = data.session.access_token;
    }
  }

  private async measureLatency(
    endpoint: string,
    method: string,
    iterations: number,
    requestFn: () => Promise<Response>
  ): Promise<PerformanceResult> {
    const latencies: number[] = [];
    const errors: string[] = [];
    let successCount = 0;

    console.log(`Testing ${method} ${endpoint} (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const response = await requestFn();
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        latencies.push(latency);
        
        if (response.ok) {
          successCount++;
        } else {
          errors.push(`HTTP ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        const endTime = Date.now();
        const latency = endTime - startTime;
        latencies.push(latency);
        errors.push(`Error: ${error}`);
      }

      // Petite pause entre les requêtes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculer les statistiques
    latencies.sort((a, b) => a - b);
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
    const successRate = (successCount / iterations) * 100;

    return {
      endpoint,
      method,
      iterations,
      minLatency,
      maxLatency,
      avgLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      successRate,
      errors
    };
  }

  async testSubmitEndpoint(): Promise<void> {
    const contestId = '44444444-4444-4444-4444-444444444444';
    const iterations = 10;

    const result = await this.measureLatency(
      `/api/contests/${contestId}/submit`,
      'POST',
      iterations,
      async () => {
        const randomId = Math.random().toString(36).substring(7);
        return fetch(`http://localhost:3000/api/contests/${contestId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokens.creator}`
          },
          body: JSON.stringify({
            video_url: `https://www.youtube.com/watch?v=PERF${randomId}`,
            platform: 'youtube'
          })
        });
      }
    );

    this.results.push(result);
    this.logResult(result);
  }

  async testSignEndpoint(): Promise<void> {
    // Créer d'abord une soumission pour tester la signature
    const contestId = '44444444-4444-4444-4444-444444444444';
    const randomId = Math.random().toString(36).substring(7);
    
    const submitResponse = await fetch(`http://localhost:3000/api/contests/${contestId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tokens.creator}`
      },
      body: JSON.stringify({
        video_url: `https://www.youtube.com/watch?v=SIGN${randomId}`,
        platform: 'youtube'
      })
    });

    if (!submitResponse.ok) {
      throw new Error(`Failed to create submission for sign test: ${submitResponse.status}`);
    }

    const submitResult = await submitResponse.json();
    const submissionId = submitResult.submission_id;

    const iterations = 5; // Moins d'itérations car on ne peut signer qu'une fois

    const result = await this.measureLatency(
      `/api/submissions/${submissionId}/sign`,
      'POST',
      iterations,
      async () => {
        return fetch(`http://localhost:3000/api/submissions/${submissionId}/sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokens.creator}`
          },
          body: JSON.stringify({
            accept_terms: true,
            legal_name: 'Performance Test User'
          })
        });
      }
    );

    this.results.push(result);
    this.logResult(result);
  }

  async testDatabaseQueries(): Promise<void> {
    const iterations = 20;

    // Test requête simple
    const simpleQueryResult = await this.measureLatency(
      '/rest/v1/profiles',
      'GET',
      iterations,
      async () => {
        return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?limit=10`, {
          headers: {
            'Authorization': `Bearer ${this.tokens.creator}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          }
        });
      }
    );

    this.results.push(simpleQueryResult);
    this.logResult(simpleQueryResult);

    // Test requête complexe avec jointure
    const complexQueryResult = await this.measureLatency(
      '/rest/v1/submissions (with join)',
      'GET',
      iterations,
      async () => {
        return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/submissions?select=*,contests(*)&limit=10`, {
          headers: {
            'Authorization': `Bearer ${this.tokens.creator}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          }
        });
      }
    );

    this.results.push(complexQueryResult);
    this.logResult(complexQueryResult);
  }

  private logResult(result: PerformanceResult): void {
    console.log(`\n📊 ${result.method} ${result.endpoint}`);
    console.log(`   Iterations: ${result.iterations}`);
    console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
    console.log(`   Latency (ms):`);
    console.log(`     Min: ${result.minLatency}`);
    console.log(`     Max: ${result.maxLatency}`);
    console.log(`     Avg: ${result.avgLatency.toFixed(1)}`);
    console.log(`     P50: ${result.p50Latency}`);
    console.log(`     P95: ${result.p95Latency}`);
    console.log(`     P99: ${result.p99Latency}`);

    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(error => {
        console.log(`     - ${error}`);
      });
    }

    // Avertissements de performance
    if (result.p95Latency > 1000) {
      console.log(`   ⚠️  P95 latence élevée (>1s)`);
    }
    if (result.successRate < 95) {
      console.log(`   ⚠️  Taux de succès faible (<95%)`);
    }
  }

  generateReport(): void {
    const reportPath = join(process.cwd(), 'tests', 'verify', 'results', 'performance-report.md');
    
    let report = `# Rapport de Performance - ClipRace\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Environnement:** ${process.env.NODE_ENV}\n\n`;

    // Résumé global
    const totalTests = this.results.length;
    const avgLatency = this.results.reduce((sum, r) => sum + r.avgLatency, 0) / totalTests;
    const maxP95 = Math.max(...this.results.map(r => r.p95Latency));
    const minSuccessRate = Math.min(...this.results.map(r => r.successRate));

    report += `## Résumé Global\n\n`;
    report += `- **Tests effectués:** ${totalTests}\n`;
    report += `- **Latence moyenne:** ${avgLatency.toFixed(1)}ms\n`;
    report += `- **P95 maximum:** ${maxP95}ms\n`;
    report += `- **Taux de succès minimum:** ${minSuccessRate.toFixed(1)}%\n\n`;

    // Seuils de performance
    report += `## Seuils de Performance\n\n`;
    report += `- **Latence P95 acceptable:** < 1000ms\n`;
    report += `- **Taux de succès acceptable:** > 95%\n`;
    report += `- **Latence moyenne acceptable:** < 500ms\n\n`;

    // Évaluation
    const performanceIssues = [];
    if (maxP95 > 1000) performanceIssues.push('P95 latence élevée');
    if (minSuccessRate < 95) performanceIssues.push('Taux de succès faible');
    if (avgLatency > 500) performanceIssues.push('Latence moyenne élevée');

    if (performanceIssues.length === 0) {
      report += `## ✅ Performance Acceptable\n\n`;
      report += `Tous les tests respectent les seuils de performance.\n\n`;
    } else {
      report += `## ⚠️ Problèmes de Performance Détectés\n\n`;
      performanceIssues.forEach(issue => {
        report += `- ${issue}\n`;
      });
      report += `\n`;
    }

    // Détails par test
    report += `## Détails par Test\n\n`;
    
    for (const result of this.results) {
      report += `### ${result.method} ${result.endpoint}\n\n`;
      report += `| Métrique | Valeur |\n`;
      report += `|----------|--------|\n`;
      report += `| Iterations | ${result.iterations} |\n`;
      report += `| Taux de succès | ${result.successRate.toFixed(1)}% |\n`;
      report += `| Latence min | ${result.minLatency}ms |\n`;
      report += `| Latence max | ${result.maxLatency}ms |\n`;
      report += `| Latence moyenne | ${result.avgLatency.toFixed(1)}ms |\n`;
      report += `| P50 | ${result.p50Latency}ms |\n`;
      report += `| P95 | ${result.p95Latency}ms |\n`;
      report += `| P99 | ${result.p99Latency}ms |\n\n`;

      if (result.errors.length > 0) {
        report += `**Erreurs:**\n`;
        result.errors.forEach(error => {
          report += `- ${error}\n`;
        });
        report += `\n`;
      }
    }

    // Recommandations
    report += `## Recommandations\n\n`;
    
    if (maxP95 > 1000) {
      report += `### Optimisation de la Latence\n\n`;
      report += `- Considérer la mise en cache des requêtes fréquentes\n`;
      report += `- Optimiser les requêtes de base de données\n`;
      report += `- Implémenter la pagination pour les grandes listes\n`;
      report += `- Utiliser des index de base de données appropriés\n\n`;
    }

    if (minSuccessRate < 95) {
      report += `### Amélioration de la Fiabilité\n\n`;
      report += `- Implémenter des retry automatiques\n`;
      report += `- Améliorer la gestion d'erreurs\n`;
      report += `- Ajouter des timeouts appropriés\n`;
      report += `- Surveiller les erreurs en production\n\n`;
    }

    report += `### Optimisations Générales\n\n`;
    report += `- Implémenter la compression gzip\n`;
    report += `- Utiliser un CDN pour les assets statiques\n`;
    report += `- Optimiser les images et médias\n`;
    report += `- Implémenter la mise en cache côté client\n\n`;

    writeFileSync(reportPath, report, 'utf8');
    console.log(`\n📊 Rapport de performance généré: ${reportPath}`);
  }

  async run(): Promise<void> {
    console.log('🚀 Démarrage des tests de performance\n');
    
    try {
      await this.authenticateUsers();
      
      await this.testSubmitEndpoint();
      await this.testSignEndpoint();
      await this.testDatabaseQueries();
      
      this.generateReport();
      
      console.log('\n✅ Tests de performance terminés');
      
    } catch (error) {
      console.error('\n❌ Erreur lors des tests de performance:', error);
      process.exit(1);
    }
  }
}

// Point d'entrée
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.run().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { PerformanceTester };
