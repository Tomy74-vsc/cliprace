# =====================================================
# Script de lancement des tests de vérification ClipRace (Windows PowerShell)
# =====================================================

param(
    [string]$Action = "all"
)

# Configuration des couleurs
$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        default { "Blue" }
    }
    
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

function Write-Error {
    param([string]$Message)
    Write-Log $Message "ERROR"
}

function Write-Success {
    param([string]$Message)
    Write-Log $Message "SUCCESS"
}

function Write-Warning {
    param([string]$Message)
    Write-Log $Message "WARNING"
}

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Error "Ce script doit être exécuté depuis la racine du projet ClipRace"
    exit 1
}

# Vérifier les variables d'environnement
function Test-Environment {
    Write-Log "Vérification des variables d'environnement..."
    
    $requiredVars = @(
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if (-not [Environment]::GetEnvironmentVariable($var)) {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Error "Variables d'environnement manquantes: $($missingVars -join ', ')"
        Write-Error "Veuillez définir ces variables ou créer un fichier .env"
        exit 1
    }
    
    Write-Success "Variables d'environnement OK"
}

# Installer les dépendances si nécessaire
function Install-Dependencies {
    Write-Log "Vérification des dépendances..."
    
    if (-not (Test-Path "node_modules")) {
        Write-Log "Installation des dépendances..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Échec de l'installation des dépendances"
            exit 1
        }
    }
    
    # Vérifier que tsx est disponible
    try {
        $null = Get-Command tsx -ErrorAction Stop
    } catch {
        Write-Log "Installation de tsx..."
        npm install -g tsx
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Échec de l'installation de tsx"
            exit 1
        }
    }
    
    Write-Success "Dépendances OK"
}

# Nettoyer les données de test précédentes
function Clear-TestData {
    Write-Log "Nettoyage des données de test précédentes..."
    
    if (Test-Path "tests/verify/cleanup-test-data.ts") {
        try {
            tsx tests/verify/cleanup-test-data.ts
        } catch {
            Write-Warning "Nettoyage partiel (normal si pas de données)"
        }
    }
    
    Write-Success "Nettoyage terminé"
}

# Exécuter les tests principaux
function Invoke-MainTests {
    Write-Log "Exécution des tests principaux..."
    
    if (-not (Test-Path "tests/verify/setup_and_tests.ts")) {
        Write-Error "Fichier de tests principal non trouvé"
        exit 1
    }
    
    tsx tests/verify/setup_and_tests.ts
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Success "Tests principaux réussis"
    } else {
        Write-Error "Tests principaux échoués (code: $exitCode)"
        return $false
    }
    
    return $true
}

# Exécuter les tests de performance
function Invoke-PerformanceTests {
    Write-Log "Exécution des tests de performance..."
    
    if (-not (Test-Path "tests/verify/performance-tests.ts")) {
        Write-Warning "Tests de performance non trouvés, ignorés"
        return $true
    }
    
    tsx tests/verify/performance-tests.ts
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Success "Tests de performance réussis"
    } else {
        Write-Warning "Tests de performance échoués (code: $exitCode)"
    }
    
    return $true
}

# Vérifier les rapports générés
function Test-Reports {
    Write-Log "Vérification des rapports générés..."
    
    $reportsDir = "tests/verify/results"
    
    if (-not (Test-Path $reportsDir)) {
        Write-Error "Répertoire de rapports non trouvé: $reportsDir"
        return $false
    }
    
    $mainReport = "$reportsDir/report.md"
    if (Test-Path $mainReport) {
        Write-Success "Rapport principal généré: $mainReport"
    } else {
        Write-Error "Rapport principal manquant: $mainReport"
        return $false
    }
    
    $perfReport = "$reportsDir/performance-report.md"
    if (Test-Path $perfReport) {
        Write-Success "Rapport de performance généré: $perfReport"
    } else {
        Write-Warning "Rapport de performance manquant: $perfReport"
    }
    
    return $true
}

# Afficher le résumé
function Show-Summary {
    Write-Log "Résumé de l'exécution:"
    
    $reportsDir = "tests/verify/results"
    
    if (Test-Path "$reportsDir/report.md") {
        Write-Host ""
        Write-Host "📊 Résumé des tests:" -ForegroundColor Cyan
        $reportContent = Get-Content "$reportsDir/report.md" -Raw
        $reportContent | Select-String -Pattern "^(Total des tests|Réussis|Échoués|Taux de réussite)" | ForEach-Object { Write-Host $_.Line }
    }
    
    if (Test-Path "$reportsDir/performance-report.md") {
        Write-Host ""
        Write-Host "⚡ Résumé de performance:" -ForegroundColor Cyan
        $perfContent = Get-Content "$reportsDir/performance-report.md" -Raw
        $perfContent | Select-String -Pattern "^(Latence moyenne|P95 maximum|Taux de succès minimum)" | ForEach-Object { Write-Host $_.Line }
    }
    
    Write-Host ""
    Write-Host "📁 Fichiers générés:" -ForegroundColor Cyan
    Write-Host "   - $reportsDir/report.md"
    if (Test-Path "$reportsDir/performance-report.md") {
        Write-Host "   - $reportsDir/performance-report.md"
    }
    Write-Host "   - tests/verify/test-api.http (pour tests manuels)"
    Write-Host "   - tests/verify/verify-database.sql (pour tests SQL)"
    Write-Host "   - tests/verify/test-rls-policies.sql (pour tests RLS)"
}

# Fonction principale
function Main {
    Write-Host "🚀 Démarrage des tests de vérification ClipRace" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    
    # Vérifications préliminaires
    Test-Environment
    Install-Dependencies
    
    # Nettoyage
    Clear-TestData
    
    # Exécution des tests
    $mainTestsFailed = $false
    if (-not (Invoke-MainTests)) {
        $mainTestsFailed = $true
    }
    
    # Tests de performance (optionnels)
    Invoke-PerformanceTests | Out-Null
    
    # Vérification des rapports
    if (-not (Test-Reports)) {
        $mainTestsFailed = $true
    }
    
    # Résumé
    Show-Summary
    
    # Code de sortie
    if (-not $mainTestsFailed) {
        Write-Success "🎉 Tous les tests sont passés avec succès !"
        exit 0
    } else {
        Write-Error "❌ Certains tests ont échoué. Voir les rapports pour plus de détails."
        exit 1
    }
}

# Gestion des arguments
switch ($Action.ToLower()) {
    "cleanup" {
        Write-Log "Nettoyage des données de test uniquement"
        Test-Environment
        Install-Dependencies
        Clear-TestData
        Write-Success "Nettoyage terminé"
    }
    "performance" {
        Write-Log "Tests de performance uniquement"
        Test-Environment
        Install-Dependencies
        Invoke-PerformanceTests
    }
    "help" {
        Write-Host "Usage: .\run-tests.ps1 [option]"
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  (aucune)    Exécuter tous les tests"
        Write-Host "  cleanup     Nettoyer les données de test uniquement"
        Write-Host "  performance Exécuter les tests de performance uniquement"
        Write-Host "  help        Afficher cette aide"
        Write-Host ""
        Write-Host "Variables d'environnement requises:"
        Write-Host "  SUPABASE_URL"
        Write-Host "  SUPABASE_SERVICE_ROLE_KEY"
        Write-Host "  SUPABASE_ANON_KEY"
        Write-Host "  NEXT_PUBLIC_SUPABASE_URL"
    }
    default {
        Main
    }
}
