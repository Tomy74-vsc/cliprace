#!/bin/bash

# =====================================================
# Script de lancement des tests de vérification ClipRace
# =====================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    error "Ce script doit être exécuté depuis la racine du projet ClipRace"
    exit 1
fi

# Vérifier les variables d'environnement
check_env() {
    log "Vérification des variables d'environnement..."
    
    required_vars=(
        "SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "SUPABASE_ANON_KEY"
        "NEXT_PUBLIC_SUPABASE_URL"
    )
    
    missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error "Variables d'environnement manquantes: ${missing_vars[*]}"
        error "Veuillez définir ces variables ou créer un fichier .env"
        exit 1
    fi
    
    success "Variables d'environnement OK"
}

# Installer les dépendances si nécessaire
install_deps() {
    log "Vérification des dépendances..."
    
    if [ ! -d "node_modules" ]; then
        log "Installation des dépendances..."
        npm install
    fi
    
    # Vérifier que tsx est disponible
    if ! command -v tsx &> /dev/null; then
        log "Installation de tsx..."
        npm install -g tsx
    fi
    
    success "Dépendances OK"
}

# Nettoyer les données de test précédentes
cleanup_previous() {
    log "Nettoyage des données de test précédentes..."
    
    if [ -f "tests/verify/cleanup-test-data.ts" ]; then
        tsx tests/verify/cleanup-test-data.ts || warning "Nettoyage partiel (normal si pas de données)"
    fi
    
    success "Nettoyage terminé"
}

# Exécuter les tests principaux
run_main_tests() {
    log "Exécution des tests principaux..."
    
    if [ ! -f "tests/verify/setup_and_tests.ts" ]; then
        error "Fichier de tests principal non trouvé"
        exit 1
    fi
    
    tsx tests/verify/setup_and_tests.ts
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        success "Tests principaux réussis"
    else
        error "Tests principaux échoués (code: $exit_code)"
        return $exit_code
    fi
}

# Exécuter les tests de performance
run_performance_tests() {
    log "Exécution des tests de performance..."
    
    if [ ! -f "tests/verify/performance-tests.ts" ]; then
        warning "Tests de performance non trouvés, ignorés"
        return 0
    fi
    
    tsx tests/verify/performance-tests.ts
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        success "Tests de performance réussis"
    else
        warning "Tests de performance échoués (code: $exit_code)"
    fi
}

# Vérifier les rapports générés
check_reports() {
    log "Vérification des rapports générés..."
    
    reports_dir="tests/verify/results"
    
    if [ ! -d "$reports_dir" ]; then
        error "Répertoire de rapports non trouvé: $reports_dir"
        return 1
    fi
    
    main_report="$reports_dir/report.md"
    if [ -f "$main_report" ]; then
        success "Rapport principal généré: $main_report"
    else
        error "Rapport principal manquant: $main_report"
        return 1
    fi
    
    perf_report="$reports_dir/performance-report.md"
    if [ -f "$perf_report" ]; then
        success "Rapport de performance généré: $perf_report"
    else
        warning "Rapport de performance manquant: $perf_report"
    fi
    
    return 0
}

# Afficher le résumé
show_summary() {
    log "Résumé de l'exécution:"
    
    reports_dir="tests/verify/results"
    
    if [ -f "$reports_dir/report.md" ]; then
        echo ""
        echo "📊 Résumé des tests:"
        grep -E "^(Total des tests|Réussis|Échoués|Taux de réussite)" "$reports_dir/report.md" || true
    fi
    
    if [ -f "$reports_dir/performance-report.md" ]; then
        echo ""
        echo "⚡ Résumé de performance:"
        grep -E "^(Latence moyenne|P95 maximum|Taux de succès minimum)" "$reports_dir/performance-report.md" || true
    fi
    
    echo ""
    echo "📁 Fichiers générés:"
    echo "   - $reports_dir/report.md"
    if [ -f "$reports_dir/performance-report.md" ]; then
        echo "   - $reports_dir/performance-report.md"
    fi
    echo "   - tests/verify/test-api.http (pour tests manuels)"
    echo "   - tests/verify/verify-database.sql (pour tests SQL)"
    echo "   - tests/verify/test-rls-policies.sql (pour tests RLS)"
}

# Fonction principale
main() {
    echo "🚀 Démarrage des tests de vérification ClipRace"
    echo "================================================"
    
    # Vérifications préliminaires
    check_env
    install_deps
    
    # Nettoyage
    cleanup_previous
    
    # Exécution des tests
    local main_tests_failed=0
    run_main_tests || main_tests_failed=1
    
    # Tests de performance (optionnels)
    run_performance_tests
    
    # Vérification des rapports
    check_reports || main_tests_failed=1
    
    # Résumé
    show_summary
    
    # Code de sortie
    if [ $main_tests_failed -eq 0 ]; then
        success "🎉 Tous les tests sont passés avec succès !"
        exit 0
    else
        error "❌ Certains tests ont échoué. Voir les rapports pour plus de détails."
        exit 1
    fi
}

# Gestion des arguments
case "${1:-}" in
    "cleanup")
        log "Nettoyage des données de test uniquement"
        check_env
        install_deps
        cleanup_previous
        success "Nettoyage terminé"
        ;;
    "performance")
        log "Tests de performance uniquement"
        check_env
        install_deps
        run_performance_tests
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  (aucune)    Exécuter tous les tests"
        echo "  cleanup     Nettoyer les données de test uniquement"
        echo "  performance Exécuter les tests de performance uniquement"
        echo "  help        Afficher cette aide"
        echo ""
        echo "Variables d'environnement requises:"
        echo "  SUPABASE_URL"
        echo "  SUPABASE_SERVICE_ROLE_KEY"
        echo "  SUPABASE_ANON_KEY"
        echo "  NEXT_PUBLIC_SUPABASE_URL"
        ;;
    *)
        main
        ;;
esac
