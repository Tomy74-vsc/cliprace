# 🗄️ Configuration du Bucket Invoices - Supabase

## ✅ Étape 1 : Installation de la dépendance

La dépendance `@react-pdf/renderer` a été installée avec succès :

```bash
npm install @react-pdf/renderer
```

✅ **Status** : Installé

---

## ✅ Étape 2 : Création du Bucket dans Supabase

### Option A : Via Dashboard Supabase (Recommandé)

1. Connectez-vous au [Dashboard Supabase](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Storage** dans le menu de gauche
4. Cliquez sur **"New bucket"**
5. Configurez le bucket :
   - **Name** : `invoices`
   - **Public bucket** : ❌ **Désactivé** (privé)
   - **File size limit** : `10 MB` (ou laissez vide)
   - **Allowed MIME types** : `application/pdf` (optionnel, mais recommandé)
6. Cliquez sur **"Create bucket"**

### Option B : Via SQL (Script fourni)

Exécutez le script SQL suivant dans l'éditeur SQL de Supabase :

```sql
-- Fichier: db_refonte/12b_create_invoices_bucket.sql
```

Ou directement :

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
```

---

## ✅ Étape 3 : Configuration des Politiques RLS

Les politiques RLS sont déjà définies dans `db_refonte/12_storage_policies.sql`.

### Vérification

Les politiques suivantes doivent être actives :

1. **`invoices_insert_service_role`** : Service role peut insérer (génération automatique)
2. **`invoices_read_own`** : Les marques peuvent lire leurs propres factures
3. **`invoices_admin_all`** : Les admins ont accès complet

### Application des politiques

Si vous utilisez les migrations SQL :

```bash
# Via Supabase CLI
supabase db push

# Ou exécutez directement dans l'éditeur SQL Supabase
# Fichier: db_refonte/12_storage_policies.sql (section invoices)
```

### Structure des fichiers

Les factures sont stockées avec la structure suivante :
```
{brand_id}/invoices/invoice-{payment_id}-{timestamp}.pdf
```

Exemple :
```
550e8400-e29b-41d4-a716-446655440000/invoices/invoice-123e4567-e89b-12d3-a456-426614174000-1705678900000.pdf
```

---

## ✅ Étape 4 : Vérification

### Test 1 : Vérifier que le bucket existe

Dans l'éditeur SQL Supabase :

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'invoices';
```

Résultat attendu :
```
id       | name     | public | file_size_limit | allowed_mime_types
---------|----------|--------|-----------------|-------------------
invoices | invoices | false  | 10485760        | {application/pdf}
```

### Test 2 : Vérifier les politiques RLS

```sql
SELECT polname, polcmd, polroles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND polname LIKE 'invoices%';
```

Résultat attendu : 3 politiques (insert_service_role, read_own, admin_all)

### Test 3 : Test de génération de facture

1. Créez un paiement réussi dans l'application
2. Allez sur `/app/brand/billing`
3. Cliquez sur "Facture" pour un paiement réussi
4. Vérifiez que le PDF se télécharge
5. Vérifiez dans Supabase Storage que le fichier est présent dans `{brand_id}/invoices/`

---

## 🔒 Sécurité

### ✅ Vérifications de sécurité

- [x] Bucket privé (non public)
- [x] RLS activée
- [x] Seul le service role peut insérer
- [x] Les marques ne peuvent lire que leurs propres factures
- [x] Les admins ont accès complet
- [x] Limite de taille de fichier (10 MB)
- [x] MIME type restreint (PDF uniquement)

### Structure de sécurité

```
┌─────────────────────────────────────┐
│ Bucket: invoices (privé)            │
├─────────────────────────────────────┤
│ INSERT: service_role uniquement     │
│ SELECT: brand_id = auth.uid()       │
│ SELECT: admin (tous)                │
└─────────────────────────────────────┘
```

---

## 📝 Notes

### Génération automatique vs à la demande

**Actuellement** : Génération à la demande
- La facture est générée lors du premier téléchargement
- Stockée ensuite dans Storage pour les téléchargements suivants

**Futur** : Génération automatique
- Génération lors du webhook Stripe `checkout.session.completed`
- Nécessite configuration d'URL interne ou queue job

### URLs des factures

Les URLs des factures sont stockées dans `payments_brand.metadata` :
```json
{
  "invoice_pdf_url": "https://...supabase.co/storage/v1/object/public/invoices/...",
  "invoice_number": "INV-20250120-ABC12345",
  "invoice_generated_at": "2025-01-20T10:30:00Z"
}
```

---

## 🚀 Prochaines étapes

Une fois le bucket configuré :

1. ✅ Testez l'export PDF des résultats de concours
2. ✅ Testez la génération/téléchargement d'une facture
3. ✅ Vérifiez les permissions (seule la marque peut accéder à ses factures)
4. ✅ Vérifiez que les PDFs sont bien stockés dans Storage

---

**Status** : ✅ Configuration prête (nécessite création du bucket dans Supabase)

