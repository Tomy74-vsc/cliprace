# Tests de Vérification ClipRace

Ce répertoire contient tous les tests automatisés pour vérifier que les modifications des 3 étapes (migrations DB, RLS, API de soumission & signature) fonctionnent parfaitement sur l'environnement Supabase.

## 🎯 Objectif

Vérifier automatiquement que :
- ✅ Les migrations de base de données sont correctement appliquées
- ✅ Les politiques RLS (Row Level Security) bloquent les accès non autorisés
- ✅ Les API de soumission et signature fonctionnent correctement
- ✅ Le stockage des contrats est sécurisé
- ✅ Les performances sont acceptables

## 📁 Structure

```
tests/verify/
├── setup_and_tests.ts          # Script principal de vérification
├── performance-tests.ts        # Tests de performance
├── cleanup-test-data.ts        # Nettoyage des données de test
├── run-tests.sh               # Script de lancement (Linux/Mac)
├── test-api.http              # Tests manuels avec REST Client
├── verify-database.sql        # Vérifications SQL directes
├── test-rls-policies.sql      # Tests des politiques RLS
├── env.example                # Exemple de configuration
├── results/                   # Rapports générés
│   ├── report.md             # Rapport principal
│   └── performance-report.md # Rapport de performance
└── README.md                 # Ce fichier
```

## 🚀 Utilisation Rapide

### 1. Configuration

Copiez le fichier d'exemple et configurez vos variables d'environnement :

```bash
cp tests/verify/env.example .env
```

Éditez `.env` avec vos valeurs Supabase :

```env
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=test
```

### 2. Exécution des Tests

#### Option A : Script automatique (Linux/Mac)
```bash
chmod +x tests/verify/run-tests.sh
./tests/verify/run-tests.sh
```

#### Option B : Exécution manuelle
```bash
# Tests principaux
tsx tests/verify/setup_and_tests.ts

# Tests de performance (optionnel)
tsx tests/verify/performance-tests.ts

# Nettoyage (optionnel)
tsx tests/verify/cleanup-test-data.ts
```

#### Option C : Tests individuels
```bash
# Tests de performance uniquement
./tests/verify/run-tests.sh performance

# Nettoyage uniquement
./tests/verify/run-tests.sh cleanup
```

## 📊 Rapports Générés

### Rapport Principal (`results/report.md`)
- Résumé global des tests
- Détails par suite de tests
- Erreurs et corrections appliquées
- Critères d'acceptation

### Rapport de Performance (`results/performance-report.md`)
- Latence des endpoints critiques
- Taux de succès des requêtes
- Recommandations d'optimisation

## 🧪 Tests Inclus

### A - Préparation des Données de Test
- Création d'utilisateurs (brand, creator, admin)
- Création des profils
- Création d'un contest de test
- Vérification du bucket signatures

### B - Vérifications Structurelles DB
- Tables présentes
- Enums corrects
- Index existants
- Contraintes uniques

### C - Tests RLS / Autorisations
- Authentification des utilisateurs
- Accès aux soumissions (creator)
- Accès aux soumissions (brand)
- Accès aux messages
- Tests d'insertion/mise à jour

### D - Tests Fonctionnels API
- POST `/api/contests/:id/submit`
- Prévention des doublons
- POST `/api/submissions/:id/sign`
- Vérification en base de données

### E - Tests Sécurité Stockage
- Accès public refusé
- Création de signed URLs

### F - Tests d'Erreurs
- Platform non autorisée
- URL malformée
- Signature par autre utilisateur

### G - Mesures de Performance
- Latence des endpoints critiques
- Statistiques (min, max, avg, P95, P99)

## 🔧 Tests Manuels

### Tests HTTP avec REST Client

Utilisez le fichier `test-api.http` avec l'extension REST Client de VS Code :

1. Installez l'extension "REST Client"
2. Ouvrez `test-api.http`
3. Configurez les variables d'environnement
4. Exécutez les requêtes individuellement

### Tests SQL Directs

Exécutez les fichiers SQL directement sur votre base :

```bash
# Vérifications de base
psql -h your-host -U postgres -d postgres -f tests/verify/verify-database.sql

# Tests RLS
psql -h your-host -U postgres -d postgres -f tests/verify/test-rls-policies.sql
```

## 🎯 Données de Test

Le script utilise des UUIDs fixes pour la reproductibilité :

- **Brand ID**: `11111111-1111-1111-1111-111111111111`
- **Creator ID**: `22222222-2222-2222-2222-222222222222`
- **Admin ID**: `33333333-3333-3333-3333-333333333333`
- **Contest ID**: `44444444-4444-4444-4444-444444444444`

**Emails de test**:
- `brand@test.local`
- `creator@test.local`
- `admin@test.local`

**Mot de passe**: `Password123!`

## ⚠️ Précautions

1. **Environnement de test uniquement** : Ne pas exécuter sur la production
2. **Nettoyage automatique** : Les données de test sont supprimées après les tests
3. **Variables d'environnement** : Vérifiez que toutes les variables sont définies
4. **Permissions** : Assurez-vous d'avoir les droits d'écriture sur le répertoire

## 🐛 Dépannage

### Erreur "Variables d'environnement manquantes"
```bash
# Vérifiez que votre fichier .env contient toutes les variables
cat .env
```

### Erreur "Authentication failed"
```bash
# Vérifiez vos clés Supabase
echo $SUPABASE_SERVICE_ROLE_KEY | head -c 20
```

### Erreur "Table not found"
```bash
# Vérifiez que les migrations sont appliquées
psql -h your-host -U postgres -d postgres -c "\dt"
```

### Tests de performance lents
```bash
# Exécutez uniquement les tests principaux
tsx tests/verify/setup_and_tests.ts
```

## 📈 Critères d'Acceptation

Les tests sont considérés comme réussis si :

- ✅ Tous les tests RLS bloquent les accès non autorisés
- ✅ Endpoint `/api/contests/:id/submit` fonctionne
- ✅ Prévention des doublons fonctionne
- ✅ Endpoint `/api/submissions/:id/sign` fonctionne
- ✅ Notifications et audit_logs sont écrits
- ✅ Storage signatures est privé
- ✅ Latence P95 < 1000ms
- ✅ Taux de succès > 95%

## 🔄 Intégration Continue

Pour intégrer dans votre pipeline CI/CD :

```yaml
# .github/workflows/test.yml
- name: Run ClipRace Verification Tests
  run: |
    export SUPABASE_URL=${{ secrets.SUPABASE_URL }}
    export SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    export SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}
    export NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    ./tests/verify/run-tests.sh
```

## 📞 Support

En cas de problème :

1. Vérifiez les logs dans `tests/verify/results/`
2. Consultez les rapports générés
3. Exécutez les tests manuels pour isoler le problème
4. Vérifiez la configuration de votre environnement Supabase
