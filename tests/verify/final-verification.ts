#!/usr/bin/env tsx

/**
 * Script de vérification finale
 * Exécute tous les tests et génère un rapport de synthèse
 */

import { VerificationSuite } from './setup_and_tests';
import { PerformanceTester } from './performance-tests';
import { TestDataCleanup } from './cleanup-test-data';
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
  } catch (error) {
    // Ignorer les erreurs et essayer le chemin suivant
  }
}

interface TestSuite {
  name: string;
  results: TestResult[];
  startTime: number;
  endTime?: number;
}

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: unknown;
  duration?: number;
  error?: Error;
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

// Interface FinalReport supprimée car non utilisée

class FinalVerification {
  private results: TestSuite[] = [];
  private performanceResults: PerformanceResult[] = [];

  async run(): Promise<void> {
    console.log('🎯 Vérification finale ClipRace');
    console.log('===============================\n');

    try {
      // 1. Nettoyer les données précédentes
      console.log('🧹 Nettoyage des données précédentes...');
      const cleanup = new TestDataCleanup();
      await cleanup.cleanup();

      // 2. Exécuter les tests principaux
      console.log('\n🧪 Exécution des tests principaux...');
      const verificationSuite = new VerificationSuite();
      await verificationSuite.run();
      this.results = (verificationSuite as unknown as { results: TestSuite[] }).results;

      // 3. Exécuter les tests de performance
      console.log('\n⚡ Exécution des tests de performance...');
      const performanceTester = new PerformanceTester();
      await performanceTester.run();
      this.performanceResults = (performanceTester as unknown as { results: PerformanceResult[] }).results;

      // 4. Générer le rapport final
      await this.generateFinalReport();

      // 5. Nettoyer les données de test
      console.log('\n🧹 Nettoyage final...');
      await cleanup.cleanup();

      console.log('\n✅ Vérification finale terminée');
      
    } catch (error) {
      console.error('\n❌ Erreur lors de la vérification finale:', error);
      process.exit(1);
    }
  }

  private async generateFinalReport(): Promise<void> {
    const reportPath = join(process.cwd(), 'tests', 'verify', 'results', 'final-report.md');
    
    // Calculer les statistiques
    const totalTests = this.results.reduce((sum, suite) => sum + suite.results.length, 0);
    const passedTests = this.results.reduce((sum, suite) => 
      sum + suite.results.filter((r: TestResult) => r.status === 'PASS').length, 0);
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests) * 100;

    const avgLatency = this.performanceResults.length > 0 
      ? this.performanceResults.reduce((sum, r) => sum + r.avgLatency, 0) / this.performanceResults.length 
      : 0;
    const maxP95 = this.performanceResults.length > 0 
      ? Math.max(...this.performanceResults.map(r => r.p95Latency)) 
      : 0;
    const minSuccessRate = this.performanceResults.length > 0 
      ? Math.min(...this.performanceResults.map(r => r.successRate)) 
      : 100;

    // Déterminer le statut global
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    const recommendations: string[] = [];

    if (failedTests > 0) {
      status = 'FAIL';
      recommendations.push('Corriger les tests échoués');
    }

    if (maxP95 > 1000) {
      status = status === 'FAIL' ? 'FAIL' : 'WARNING';
      recommendations.push('Optimiser la latence des endpoints (P95 > 1000ms)');
    }

    if (minSuccessRate < 95) {
      status = status === 'FAIL' ? 'FAIL' : 'WARNING';
      recommendations.push('Améliorer la fiabilité des endpoints (taux de succès < 95%)');
    }

    if (avgLatency > 500) {
      status = status === 'FAIL' ? 'FAIL' : 'WARNING';
      recommendations.push('Optimiser la latence moyenne (> 500ms)');
    }

    // Générer le rapport
    let report = `# Rapport de Vérification Finale - ClipRace\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Environnement:** ${process.env.NODE_ENV}\n`;
    report += `**Statut Global:** ${this.getStatusEmoji(status)} ${status}\n\n`;

    // Résumé exécutif
    report += `## 📊 Résumé Exécutif\n\n`;
    report += `- **Tests exécutés:** ${totalTests}\n`;
    report += `- **Tests réussis:** ${passedTests} ✅\n`;
    report += `- **Tests échoués:** ${failedTests} ❌\n`;
    report += `- **Taux de réussite:** ${successRate.toFixed(1)}%\n\n`;

    if (this.performanceResults.length > 0) {
      report += `- **Latence moyenne:** ${avgLatency.toFixed(1)}ms\n`;
      report += `- **P95 maximum:** ${maxP95}ms\n`;
      report += `- **Taux de succès minimum:** ${minSuccessRate.toFixed(1)}%\n\n`;
    }

    // Évaluation globale
    report += `## 🎯 Évaluation Globale\n\n`;
    
    if (status === 'PASS') {
      report += `### ✅ Tous les critères sont respectés\n\n`;
      report += `Le système ClipRace est prêt pour la production. Tous les tests passent et les performances sont acceptables.\n\n`;
    } else if (status === 'WARNING') {
      report += `### ⚠️ Avertissements détectés\n\n`;
      report += `Le système fonctionne mais nécessite des optimisations avant la mise en production.\n\n`;
    } else {
      report += `### ❌ Problèmes critiques détectés\n\n`;
      report += `Le système nécessite des corrections avant d'être déployé en production.\n\n`;
    }

    // Recommandations
    if (recommendations.length > 0) {
      report += `## 🔧 Recommandations\n\n`;
      recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    // Critères d'acceptation
    report += `## ✅ Critères d'Acceptation\n\n`;
    report += `| Critère | Statut | Détail |\n`;
    report += `|---------|--------|--------|\n`;
    report += `| Tests RLS | ${failedTests === 0 ? '✅ PASS' : '❌ FAIL'} | ${failedTests === 0 ? 'Aucune fuite de données' : `${failedTests} test(s) échoué(s)`} |\n`;
    report += `| API Submit | ${this.checkAPISubmit() ? '✅ PASS' : '❌ FAIL'} | Endpoint fonctionnel |\n`;
    report += `| API Sign | ${this.checkAPISign() ? '✅ PASS' : '❌ FAIL'} | Endpoint fonctionnel |\n`;
    report += `| Prévention doublons | ${this.checkDuplicatePrevention() ? '✅ PASS' : '❌ FAIL'} | Contrainte unique active |\n`;
    report += `| Storage sécurisé | ${this.checkStorageSecurity() ? '✅ PASS' : '❌ FAIL'} | Bucket privé |\n`;
    report += `| Performance | ${maxP95 <= 1000 ? '✅ PASS' : '⚠️ WARNING'} | P95: ${maxP95}ms |\n`;
    report += `| Fiabilité | ${minSuccessRate >= 95 ? '✅ PASS' : '⚠️ WARNING'} | Taux: ${minSuccessRate.toFixed(1)}% |\n\n`;

    // Détails par suite
    report += `## 📋 Détails par Suite de Tests\n\n`;
    
    for (const suite of this.results) {
      const duration = suite.endTime ? suite.endTime - suite.startTime : 0;
      const passed = suite.results.filter((r: TestResult) => r.status === 'PASS').length;
      const failed = suite.results.filter((r: TestResult) => r.status === 'FAIL').length;

      report += `### ${suite.name}\n\n`;
      report += `**Durée:** ${duration}ms | **Réussis:** ${passed} | **Échoués:** ${failed}\n\n`;

      for (const result of suite.results) {
        const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
        report += `- ${status} **${result.name}**: ${result.message}\n`;
        
        if (result.error) {
          report += `  - Erreur: ${result.error.message}\n`;
        }
      }
      report += `\n`;
    }

    // Performance détaillée
    if (this.performanceResults.length > 0) {
      report += `## ⚡ Détails de Performance\n\n`;
      
      for (const result of this.performanceResults) {
        report += `### ${result.method} ${result.endpoint}\n\n`;
        report += `| Métrique | Valeur |\n`;
        report += `|----------|--------|\n`;
        report += `| Latence moyenne | ${result.avgLatency.toFixed(1)}ms |\n`;
        report += `| P95 | ${result.p95Latency}ms |\n`;
        report += `| Taux de succès | ${result.successRate.toFixed(1)}% |\n\n`;
      }
    }

    // Actions suivantes
    report += `## 🚀 Actions Suivantes\n\n`;
    
    if (status === 'PASS') {
      report += `1. ✅ Le système est prêt pour la production\n`;
      report += `2. 📊 Surveiller les métriques en production\n`;
      report += `3. 🔄 Mettre en place la surveillance continue\n\n`;
    } else {
      report += `1. 🔧 Corriger les problèmes identifiés\n`;
      report += `2. 🧪 Relancer les tests après corrections\n`;
      report += `3. 📊 Vérifier que tous les critères sont respectés\n\n`;
    }

    // Informations techniques
    report += `## 🔧 Informations Techniques\n\n`;
    report += `- **Script de test:** tests/verify/setup_and_tests.ts\n`;
    report += `- **Tests de performance:** tests/verify/performance-tests.ts\n`;
    report += `- **Nettoyage:** tests/verify/cleanup-test-data.ts\n`;
    report += `- **Tests manuels:** tests/verify/test-api.http\n`;
    report += `- **Tests SQL:** tests/verify/verify-database.sql\n\n`;

    writeFileSync(reportPath, report, 'utf8');
    console.log(`\n📊 Rapport final généré: ${reportPath}`);
    
    // Afficher le résumé dans la console
    console.log(`\n🎯 RÉSUMÉ FINAL:`);
    console.log(`   Statut: ${this.getStatusEmoji(status)} ${status}`);
    console.log(`   Tests: ${passedTests}/${totalTests} réussis (${successRate.toFixed(1)}%)`);
    if (this.performanceResults.length > 0) {
      console.log(`   Performance: P95=${maxP95}ms, Succès=${minSuccessRate.toFixed(1)}%`);
    }
    
    if (recommendations.length > 0) {
      console.log(`\n🔧 Recommandations:`);
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'WARNING': return '⚠️';
      case 'FAIL': return '❌';
      default: return '❓';
    }
  }

  private checkAPISubmit(): boolean {
    // Vérifier si les tests d'API submit ont réussi
    for (const suite of this.results) {
      if (suite.name.includes('API')) {
        const submitTest = suite.results.find((r: TestResult) => r.name.includes('Submit'));
        if (submitTest && submitTest.status === 'PASS') {
          return true;
        }
      }
    }
    return false;
  }

  private checkAPISign(): boolean {
    // Vérifier si les tests d'API sign ont réussi
    for (const suite of this.results) {
      if (suite.name.includes('API')) {
        const signTest = suite.results.find((r: TestResult) => r.name.includes('Sign'));
        if (signTest && signTest.status === 'PASS') {
          return true;
        }
      }
    }
    return false;
  }

  private checkDuplicatePrevention(): boolean {
    // Vérifier si la prévention des doublons fonctionne
    for (const suite of this.results) {
      const duplicateTest = suite.results.find((r: TestResult) => r.name.includes('doublon') || r.name.includes('duplicate'));
      if (duplicateTest && duplicateTest.status === 'PASS') {
        return true;
      }
    }
    return false;
  }

  private checkStorageSecurity(): boolean {
    // Vérifier si le storage est sécurisé
    for (const suite of this.results) {
      if (suite.name.includes('Storage') || suite.name.includes('stockage')) {
        const securityTest = suite.results.find((r: TestResult) => r.name.includes('sécurité') || r.name.includes('security'));
        if (securityTest && securityTest.status === 'PASS') {
          return true;
        }
      }
    }
    return false;
  }
}

// Point d'entrée
if (require.main === module) {
  const verification = new FinalVerification();
  verification.run().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

export { FinalVerification };
