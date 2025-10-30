#!/bin/bash

# Tests de Sécurité - ClipRace Platform
# Script pour tester les headers de sécurité, XSS, CSRF et rate limiting

set -e

# Configuration
BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/api"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les résultats
print_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name${NC}"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ $test_name${NC}"
        echo -e "${RED}   $details${NC}"
    else
        echo -e "${YELLOW}⚠️  $test_name${NC}"
        echo -e "${YELLOW}   $details${NC}"
    fi
}

# Fonction pour tester les headers de sécurité
test_security_headers() {
    echo -e "\n${BLUE}🔒 Test des Headers de Sécurité${NC}"
    
    # Test de la page principale
    response=$(curl -s -I "$BASE_URL" || echo "ERROR")
    
    if [[ "$response" == *"ERROR"* ]]; then
        print_result "Headers - Connexion" "FAIL" "Impossible de se connecter au serveur"
        return 1
    fi
    
    # Vérifier X-Frame-Options
    if echo "$response" | grep -q "X-Frame-Options: DENY"; then
        print_result "X-Frame-Options" "PASS" "Protection contre clickjacking activée"
    else
        print_result "X-Frame-Options" "FAIL" "Header X-Frame-Options manquant ou incorrect"
    fi
    
    # Vérifier X-Content-Type-Options
    if echo "$response" | grep -q "X-Content-Type-Options: nosniff"; then
        print_result "X-Content-Type-Options" "PASS" "Protection MIME sniffing activée"
    else
        print_result "X-Content-Type-Options" "FAIL" "Header X-Content-Type-Options manquant"
    fi
    
    # Vérifier Content-Security-Policy
    if echo "$response" | grep -q "Content-Security-Policy:"; then
        print_result "Content-Security-Policy" "PASS" "CSP configuré"
    else
        print_result "Content-Security-Policy" "FAIL" "Header CSP manquant"
    fi
    
    # Vérifier Strict-Transport-Security
    if echo "$response" | grep -q "Strict-Transport-Security:"; then
        print_result "HSTS" "PASS" "HSTS configuré"
    else
        print_result "HSTS" "WARN" "HSTS manquant (normal en développement)"
    fi
    
    # Vérifier Referrer-Policy
    if echo "$response" | grep -q "Referrer-Policy:"; then
        print_result "Referrer-Policy" "PASS" "Referrer policy configuré"
    else
        print_result "Referrer-Policy" "FAIL" "Header Referrer-Policy manquant"
    fi
}

# Fonction pour tester le rate limiting
test_rate_limiting() {
    echo -e "\n${BLUE}⏱️  Test du Rate Limiting${NC}"
    
    # Test de l'endpoint check-email (limite: 10 req/min)
    echo "Test du rate limiting sur /api/auth/check-email..."
    
    # Faire 12 requêtes rapides
    for i in {1..12}; do
        response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_BASE/auth/check-email" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"test$i@example.com\"}" || echo "000")
        
        if [ "$i" -le 10 ] && [ "$response" = "200" ]; then
            if [ "$i" -eq 10 ]; then
                print_result "Rate Limit - Requêtes autorisées" "PASS" "10 premières requêtes acceptées"
            fi
        elif [ "$i" -gt 10 ] && [ "$response" = "429" ]; then
            print_result "Rate Limit - Limite atteinte" "PASS" "Requête $i correctement bloquée (429)"
            break
        elif [ "$i" -gt 10 ] && [ "$response" = "200" ]; then
            print_result "Rate Limit - Limite non respectée" "FAIL" "Requête $i acceptée alors qu'elle devrait être bloquée"
        fi
    done
}

# Fonction pour tester la protection XSS
test_xss_protection() {
    echo -e "\n${BLUE}🛡️  Test de Protection XSS${NC}"
    
    # Payloads XSS communs
    xss_payloads=(
        "<script>alert('XSS')</script>"
        "javascript:alert('XSS')"
        "<img src=x onerror=alert('XSS')>"
        "<svg onload=alert('XSS')>"
        "';alert('XSS');//"
    )
    
    for payload in "${xss_payloads[@]}"; do
        # Test sur l'endpoint de messages (si accessible)
        response=$(curl -s -X POST "$API_BASE/messages" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer fake-token" \
            -d "{\"brand_id\":\"00000000-0000-0000-0000-000000000000\",\"creator_id\":\"00000000-0000-0000-0000-000000000000\",\"subject\":\"$payload\"}" || echo "ERROR")
        
        if [[ "$response" == *"ERROR"* ]]; then
            print_result "XSS Test - Connexion" "WARN" "Endpoint non accessible (normal sans auth)"
        elif echo "$response" | grep -q "$payload"; then
            print_result "XSS Test - Payload non échappé" "FAIL" "Payload XSS non échappé: $payload"
        else
            print_result "XSS Test - Payload échappé" "PASS" "Payload XSS correctement échappé: $payload"
        fi
    done
}

# Fonction pour tester les endpoints RGPD
test_gdpr_endpoints() {
    echo -e "\n${BLUE}🔐 Test des Endpoints RGPD${NC}"
    
    # Test de l'endpoint export (sans auth, devrait retourner 401)
    response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_BASE/privacy/export" \
        -H "Content-Type: application/json" \
        -d '{"user_id":"00000000-0000-0000-0000-000000000000","format":"json"}' || echo "000")
    
    if [ "$response" = "401" ]; then
        print_result "RGPD Export - Auth requise" "PASS" "Endpoint protégé par authentification"
    else
        print_result "RGPD Export - Auth requise" "FAIL" "Endpoint accessible sans auth (code: $response)"
    fi
    
    # Test de l'endpoint delete (sans auth, devrait retourner 401)
    response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_BASE/privacy/delete" \
        -H "Content-Type: application/json" \
        -d '{"user_id":"00000000-0000-0000-0000-000000000000","confirmation":"DELETE_MY_DATA"}' || echo "000")
    
    if [ "$response" = "401" ]; then
        print_result "RGPD Delete - Auth requise" "PASS" "Endpoint protégé par authentification"
    else
        print_result "RGPD Delete - Auth requise" "FAIL" "Endpoint accessible sans auth (code: $response)"
    fi
}

# Fonction pour tester les headers des API
test_api_headers() {
    echo -e "\n${BLUE}📡 Test des Headers API${NC}"
    
    # Test d'un endpoint API
    response=$(curl -s -I "$API_BASE/contests" || echo "ERROR")
    
    if [[ "$response" == *"ERROR"* ]]; then
        print_result "API Headers - Connexion" "WARN" "Endpoint API non accessible"
        return
    fi
    
    # Vérifier Cache-Control pour les API
    if echo "$response" | grep -q "Cache-Control: no-store"; then
        print_result "API Cache-Control" "PASS" "Cache désactivé pour les API"
    else
        print_result "API Cache-Control" "FAIL" "Header Cache-Control manquant pour les API"
    fi
    
    # Vérifier X-Content-Type-Options pour les API
    if echo "$response" | grep -q "X-Content-Type-Options: nosniff"; then
        print_result "API X-Content-Type-Options" "PASS" "Protection MIME sniffing pour API"
    else
        print_result "API X-Content-Type-Options" "FAIL" "Header X-Content-Type-Options manquant pour API"
    fi
}

# Fonction pour tester les cookies sécurisés
test_secure_cookies() {
    echo -e "\n${BLUE}🍪 Test des Cookies Sécurisés${NC}"
    
    # Tenter de récupérer les cookies
    cookies=$(curl -s -c /tmp/cookies.txt -I "$BASE_URL" || echo "ERROR")
    
    if [[ "$cookies" == *"ERROR"* ]]; then
        print_result "Cookies - Connexion" "WARN" "Impossible de tester les cookies"
        return
    fi
    
    # Vérifier les cookies dans le fichier
    if [ -f /tmp/cookies.txt ]; then
        if grep -q "HttpOnly" /tmp/cookies.txt; then
            print_result "Cookies HttpOnly" "PASS" "Cookies marqués HttpOnly"
        else
            print_result "Cookies HttpOnly" "WARN" "Aucun cookie HttpOnly trouvé"
        fi
        
        if grep -q "Secure" /tmp/cookies.txt; then
            print_result "Cookies Secure" "PASS" "Cookies marqués Secure"
        else
            print_result "Cookies Secure" "WARN" "Cookies non marqués Secure (normal en HTTP)"
        fi
        
        if grep -q "SameSite" /tmp/cookies.txt; then
            print_result "Cookies SameSite" "PASS" "Cookies avec SameSite"
        else
            print_result "Cookies SameSite" "WARN" "Cookies sans SameSite"
        fi
        
        rm -f /tmp/cookies.txt
    fi
}

# Fonction pour tester la validation des données
test_input_validation() {
    echo -e "\n${BLUE}✅ Test de Validation des Données${NC}"
    
    # Test avec des données malformées
    malformed_data=(
        '{"email":"not-an-email"}'
        '{"user_id":"not-a-uuid"}'
        '{"limit":"not-a-number"}'
    )
    
    for data in "${malformed_data[@]}"; do
        response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_BASE/auth/check-email" \
            -H "Content-Type: application/json" \
            -d "$data" || echo "000")
        
        if [ "$response" = "400" ]; then
            print_result "Validation - Données malformées" "PASS" "Validation rejette les données invalides"
        elif [ "$response" = "429" ]; then
            print_result "Validation - Rate limited" "WARN" "Rate limiting actif (normal)"
        else
            print_result "Validation - Données malformées" "FAIL" "Validation accepte les données invalides (code: $response)"
        fi
    done
}

# Fonction principale
main() {
    echo -e "${BLUE}🔒 Tests de Sécurité - ClipRace Platform${NC}"
    echo "=================================================="
    
    # Vérifier que le serveur est en cours d'exécution
    if ! curl -s "$BASE_URL" > /dev/null; then
        echo -e "${RED}❌ Serveur non accessible sur $BASE_URL${NC}"
        echo "Assurez-vous que le serveur Next.js est en cours d'exécution:"
        echo "  npm run dev"
        exit 1
    fi
    
    # Exécuter tous les tests
    test_security_headers
    test_rate_limiting
    test_xss_protection
    test_gdpr_endpoints
    test_api_headers
    test_secure_cookies
    test_input_validation
    
    echo -e "\n${BLUE}📊 Résumé des Tests${NC}"
    echo "=================="
    echo -e "${GREEN}✅ Tests réussis${NC}"
    echo -e "${YELLOW}⚠️  Tests avec avertissements${NC}"
    echo -e "${RED}❌ Tests échoués${NC}"
    
    echo -e "\n${BLUE}💡 Recommandations${NC}"
    echo "=================="
    echo "1. Vérifiez que tous les headers de sécurité sont présents"
    echo "2. Testez le rate limiting avec des requêtes réelles"
    echo "3. Validez la protection XSS avec des payloads réels"
    echo "4. Testez les endpoints RGPD avec une authentification valide"
    echo "5. Vérifiez les logs d'audit après les tests"
}

# Exécuter les tests
main "$@"
