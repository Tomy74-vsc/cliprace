# Script PowerShell pour appliquer les migrations
Write-Host "🔄 Application des migrations via PowerShell..." -ForegroundColor Cyan

# Vérifier que le fichier existe
if (-not (Test-Path "migrations-consolidees.sql")) {
    Write-Host "❌ Fichier migrations non trouvé: migrations-consolidees.sql" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Fichier migrations trouvé: migrations-consolidees.sql" -ForegroundColor Green

# Lire le contenu du fichier
$sqlContent = Get-Content "migrations-consolidees.sql" -Raw

Write-Host "📊 Taille du contenu: $($sqlContent.Length) caractères" -ForegroundColor Yellow

Write-Host ""
Write-Host "🔧 INSTRUCTIONS MANUELLES:" -ForegroundColor Cyan
Write-Host "1. Ouvrez votre dashboard Supabase" -ForegroundColor White
Write-Host "2. Allez dans SQL Editor" -ForegroundColor White
Write-Host "3. Copiez le contenu du fichier: migrations-consolidees.sql" -ForegroundColor White
Write-Host "4. Exécutez le SQL" -ForegroundColor White
Write-Host ""
Write-Host "📋 Contenu du fichier à copier:" -ForegroundColor Yellow
Write-Host $sqlContent -ForegroundColor White
