# Tests de Sécurité - ClipRace Platform
# Script PowerShell pour tester les headers de sécurité, XSS, CSRF et rate limiting

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ApiBase = "$BaseUrl/api"

# Fonction pour afficher les résultats
function Write-TestResult {
    param(
        [string]$TestName,
        [string]$Status,
        [string]$Details = ""
    )
    
    switch ($Status) {
        "PASS" { Write-Host "✅ $TestName" -ForegroundColor Green }
        "FAIL" { 
            Write-Host "❌ $TestName" -ForegroundColor Red
            if ($Details) { Write-Host "   $Details" -ForegroundColor Red }
        }
        "WARN" { 
            Write-Host "⚠️  $TestName" -ForegroundColor Yellow
            if ($Details) { Write-Host "   $Details" -ForegroundColor Yellow }
        }
    }
}

# Fonction pour tester les headers de sécurité
function Test-SecurityHeaders {
    Write-Host "`n🔒 Test des Headers de Sécurité" -ForegroundColor Blue
    
    try {
        $response = Invoke-WebRequest -Uri $BaseUrl -Method Head -ErrorAction Stop
        
        # Vérifier X-Frame-Options
        if ($response.Headers["X-Frame-Options"] -eq "DENY") {
            Write-TestResult "X-Frame-Options" "PASS" "Protection contre clickjacking activée"
        } else {
            Write-TestResult "X-Frame-Options" "FAIL" "Header X-Frame-Options manquant ou incorrect"
        }
        
        # Vérifier X-Content-Type-Options
        if ($response.Headers["X-Content-Type-Options"] -eq "nosniff") {
            Write-TestResult "X-Content-Type-Options" "PASS" "Protection MIME sniffing activée"
        } else {
            Write-TestResult "X-Content-Type-Options" "FAIL" "Header X-Content-Type-Options manquant"
        }
        
        # Vérifier Content-Security-Policy
        if ($response.Headers["Content-Security-Policy"]) {
            Write-TestResult "Content-Security-Policy" "PASS" "CSP configuré"
        } else {
            Write-TestResult "Content-Security-Policy" "FAIL" "Header CSP manquant"
        }
        
        # Vérifier Strict-Transport-Security
        if ($response.Headers["Strict-Transport-Security"]) {
            Write-TestResult "HSTS" "PASS" "HSTS configuré"
        } else {
            Write-TestResult "HSTS" "WARN" "HSTS manquant (normal en développement)"
        }
        
        # Vérifier Referrer-Policy
        if ($response.Headers["Referrer-Policy"]) {
            Write-TestResult "Referrer-Policy" "PASS" "Referrer policy configuré"
        } else {
            Write-TestResult "Referrer-Policy" "FAIL" "Header Referrer-Policy manquant"
        }
        
    } catch {
        Write-TestResult "Headers - Connexion" "FAIL" "Impossible de se connecter au serveur: $($_.Exception.Message)"
    }
}

# Fonction pour tester le rate limiting
function Test-RateLimiting {
    Write-Host "`n⏱️  Test du Rate Limiting" -ForegroundColor Blue
    
    Write-Host "Test du rate limiting sur /api/auth/check-email..."
    
    $successCount = 0
    $blockedCount = 0
    
    # Faire 12 requêtes rapides
    for ($i = 1; $i -le 12; $i++) {
        try {
            $body = @{
                email = "test$i@example.com"
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri "$ApiBase/auth/check-email" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
            
            if ($i -le 10) {
                $successCount++
                if ($i -eq 10) {
                    Write-TestResult "Rate Limit - Requêtes autorisées" "PASS" "10 premières requêtes acceptées"
                }
            }
        } catch {
            if ($i -gt 10 -and $_.Exception.Response.StatusCode -eq 429) {
                $blockedCount++
                Write-TestResult "Rate Limit - Limite atteinte" "PASS" "Requête $i correctement bloquée (429)"
                break
            } elseif ($i -gt 10) {
                Write-TestResult "Rate Limit - Limite non respectée" "FAIL" "Requête $i acceptée alors qu'elle devrait être bloquée"
            }
        }
    }
}

# Fonction pour tester la protection XSS
function Test-XssProtection {
    Write-Host "`n🛡️  Test de Protection XSS" -ForegroundColor Blue
    
    $xssPayloads = @(
        "<script>alert('XSS')</script>",
        "javascript:alert('XSS')",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "';alert('XSS');//"
    )
    
    foreach ($payload in $xssPayloads) {
        try {
            $body = @{
                brand_id = "00000000-0000-0000-0000-000000000000"
                creator_id = "00000000-0000-0000-0000-000000000000"
                subject = $payload
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri "$ApiBase/messages" -Method Post -Body $body -ContentType "application/json" -Headers @{"Authorization" = "Bearer fake-token"} -ErrorAction Stop
            
            if ($response.Content -like "*$payload*") {
                Write-TestResult "XSS Test - Payload non échappé" "FAIL" "Payload XSS non échappé: $payload"
            } else {
                Write-TestResult "XSS Test - Payload échappé" "PASS" "Payload XSS correctement échappé: $payload"
            }
        } catch {
            Write-TestResult "XSS Test - Connexion" "WARN" "Endpoint non accessible (normal sans auth)"
        }
    }
}

# Fonction pour tester les endpoints RGPD
function Test-GdprEndpoints {
    Write-Host "`n🔐 Test des Endpoints RGPD" -ForegroundColor Blue
    
    # Test de l'endpoint export
    try {
        $body = @{
            user_id = "00000000-0000-0000-0000-000000000000"
            format = "json"
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri "$ApiBase/privacy/export" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        
        Write-TestResult "RGPD Export - Auth requise" "FAIL" "Endpoint accessible sans auth"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult "RGPD Export - Auth requise" "PASS" "Endpoint protégé par authentification"
        } else {
            Write-TestResult "RGPD Export - Auth requise" "FAIL" "Code de réponse inattendu: $($_.Exception.Response.StatusCode)"
        }
    }
    
    # Test de l'endpoint delete
    try {
        $body = @{
            user_id = "00000000-0000-0000-0000-000000000000"
            confirmation = "DELETE_MY_DATA"
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri "$ApiBase/privacy/delete" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        
        Write-TestResult "RGPD Delete - Auth requise" "FAIL" "Endpoint accessible sans auth"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult "RGPD Delete - Auth requise" "PASS" "Endpoint protégé par authentification"
        } else {
            Write-TestResult "RGPD Delete - Auth requise" "FAIL" "Code de réponse inattendu: $($_.Exception.Response.StatusCode)"
        }
    }
}

# Fonction pour tester les headers des API
function Test-ApiHeaders {
    Write-Host "`n📡 Test des Headers API" -ForegroundColor Blue
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/contests" -Method Head -ErrorAction Stop
        
        # Vérifier Cache-Control pour les API
        if ($response.Headers["Cache-Control"] -like "*no-store*") {
            Write-TestResult "API Cache-Control" "PASS" "Cache désactivé pour les API"
        } else {
            Write-TestResult "API Cache-Control" "FAIL" "Header Cache-Control manquant pour les API"
        }
        
        # Vérifier X-Content-Type-Options pour les API
        if ($response.Headers["X-Content-Type-Options"] -eq "nosniff") {
            Write-TestResult "API X-Content-Type-Options" "PASS" "Protection MIME sniffing pour API"
        } else {
            Write-TestResult "API X-Content-Type-Options" "FAIL" "Header X-Content-Type-Options manquant pour API"
        }
        
    } catch {
        Write-TestResult "API Headers - Connexion" "WARN" "Endpoint API non accessible"
    }
}

# Fonction pour tester la validation des données
function Test-InputValidation {
    Write-Host "`n✅ Test de Validation des Données" -ForegroundColor Blue
    
    $malformedData = @(
        '{"email":"not-an-email"}',
        '{"user_id":"not-a-uuid"}',
        '{"limit":"not-a-number"}'
    )
    
    foreach ($data in $malformedData) {
        try {
            $response = Invoke-WebRequest -Uri "$ApiBase/auth/check-email" -Method Post -Body $data -ContentType "application/json" -ErrorAction Stop
            
            Write-TestResult "Validation - Données malformées" "FAIL" "Validation accepte les données invalides"
        } catch {
            if ($_.Exception.Response.StatusCode -eq 400) {
                Write-TestResult "Validation - Données malformées" "PASS" "Validation rejette les données invalides"
            } elseif ($_.Exception.Response.StatusCode -eq 429) {
                Write-TestResult "Validation - Rate limited" "WARN" "Rate limiting actif (normal)"
            } else {
                Write-TestResult "Validation - Données malformées" "FAIL" "Code de réponse inattendu: $($_.Exception.Response.StatusCode)"
            }
        }
    }
}

# Fonction principale
function Main {
    Write-Host "🔒 Tests de Sécurité - ClipRace Platform" -ForegroundColor Blue
    Write-Host "=================================================="
    
    # Vérifier que le serveur est en cours d'exécution
    try {
        $response = Invoke-WebRequest -Uri $BaseUrl -ErrorAction Stop
    } catch {
        Write-Host "❌ Serveur non accessible sur $BaseUrl" -ForegroundColor Red
        Write-Host "Assurez-vous que le serveur Next.js est en cours d'exécution:"
        Write-Host "  npm run dev"
        exit 1
    }
    
    # Exécuter tous les tests
    Test-SecurityHeaders
    Test-RateLimiting
    Test-XssProtection
    Test-GdprEndpoints
    Test-ApiHeaders
    Test-InputValidation
    
    Write-Host "`n📊 Résumé des Tests" -ForegroundColor Blue
    Write-Host "=================="
    Write-Host "✅ Tests réussis" -ForegroundColor Green
    Write-Host "⚠️  Tests avec avertissements" -ForegroundColor Yellow
    Write-Host "❌ Tests échoués" -ForegroundColor Red
    
    Write-Host "`n💡 Recommandations" -ForegroundColor Blue
    Write-Host "=================="
    Write-Host "1. Vérifiez que tous les headers de sécurité sont présents"
    Write-Host "2. Testez le rate limiting avec des requêtes réelles"
    Write-Host "3. Validez la protection XSS avec des payloads réels"
    Write-Host "4. Testez les endpoints RGPD avec une authentification valide"
    Write-Host "5. Vérifiez les logs d'audit après les tests"
}

# Exécuter les tests
Main
