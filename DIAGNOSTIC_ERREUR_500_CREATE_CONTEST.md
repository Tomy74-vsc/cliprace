# 🔍 Diagnostic Erreur 500 - Création Concours

## Problème
L'API `/api/contests/create` retourne une erreur 500, et le client reçoit du HTML au lieu de JSON.

## ✅ Corrections déjà appliquées

1. **Gestion d'erreur côté client** : Vérification du Content-Type avant parsing JSON
2. **Gestion d'erreur côté serveur** : L'API retourne toujours du JSON, même en cas d'erreur
3. **Logs améliorés** : Détails de l'erreur RPC dans les logs serveur

## 🔎 Étapes de diagnostic

### 1. Vérifier les logs serveur Next.js

Dans votre terminal où tourne `npm run dev`, vous devriez voir :
```
RPC error details: {
  message: "...",
  details: "...",
  hint: "...",
  code: "..."
}
```

**Causes probables** :
- La fonction SQL `create_contest_complete` n'existe pas dans la base de données
- Un paramètre passé à la fonction RPC est invalide
- Un problème de type (ex: `p_networks` doit être un tableau PostgreSQL `platform[]`)

### 2. Vérifier que la fonction SQL existe

Connectez-vous à votre base Supabase et exécutez :

```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'create_contest_complete';
```

Si rien ne s'affiche, la fonction n'existe pas. Il faut exécuter le script :
- `db_refonte/37_create_contest_complete.sql`

### 3. Vérifier les types PostgreSQL

La fonction attend :
- `p_networks platform[]` : Un tableau PostgreSQL de type `platform`
- `p_assets jsonb` : Un objet JSON
- `p_prizes jsonb` : Un objet JSON

Supabase devrait convertir automatiquement, mais si ça ne marche pas, il faut peut-être caster explicitement.

### 4. Tester la fonction RPC directement

Dans Supabase SQL Editor, testez :

```sql
SELECT create_contest_complete(
  p_brand_id := 'VOTRE_BRAND_ID'::uuid,
  p_title := 'Test',
  p_slug := 'test',
  p_brief_md := 'Test brief',
  p_start_at := NOW() + INTERVAL '7 days',
  p_end_at := NOW() + INTERVAL '14 days',
  p_prize_pool_cents := 10000,
  p_networks := ARRAY['tiktok']::platform[],
  p_assets := '[]'::jsonb,
  p_prizes := '[]'::jsonb
);
```

Si ça échoue, vous verrez l'erreur exacte.

## 🛠️ Solutions possibles

### Solution 1 : Vérifier/créer la fonction SQL

Exécutez le script SQL dans Supabase :
```bash
# Le fichier se trouve dans :
db_refonte/37_create_contest_complete.sql
```

### Solution 2 : Vérifier le type `platform`

Assurez-vous que le type enum `platform` existe :

```sql
SELECT typname FROM pg_type WHERE typname = 'platform';
```

S'il n'existe pas, créez-le :
```sql
CREATE TYPE platform AS ENUM ('tiktok', 'instagram', 'youtube');
```

### Solution 3 : Caster explicitement les tableaux

Si Supabase ne convertit pas automatiquement, modifiez l'API pour caster :

```typescript
p_networks: allowedPlatforms.length > 0 
  ? `{${allowedPlatforms.map(p => `"${p}"`).join(',')}}`::platform[]
  : '{}'::platform[]
```

## 📊 Logs à vérifier

1. **Terminal Next.js** : Erreurs RPC détaillées
2. **Console navigateur** : Message d'erreur client
3. **Network tab DevTools** : 
   - URL appelée
   - Status code
   - Response body (premiers 200 caractères)

## 🎯 Prochaines étapes

1. Vérifiez les logs serveur pour voir l'erreur RPC exacte
2. Vérifiez que la fonction SQL existe dans Supabase
3. Testez la fonction directement dans Supabase SQL Editor
4. Partagez l'erreur exacte pour un diagnostic plus précis

