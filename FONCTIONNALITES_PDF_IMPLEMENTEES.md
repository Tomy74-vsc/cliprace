# 📄 Fonctionnalités PDF Implémentées - ClipRace

**Date**: 2025-01-20  
**Version**: 1.0

---

## ✅ Fonctionnalités Implémentées

### 1. Export PDF des Résultats de Concours

#### API
- **Route**: `GET /api/contests/[id]/export-pdf`
- **Authentification**: Brand owner ou admin uniquement
- **Fonctionnalités**:
  - Export complet des résultats d'un concours
  - Statistiques globales (vues, engagement, CPV, soumissions)
  - Classement final (top 20 gagnants avec gains estimés)
  - Évolution des vues sur 7 jours
  - Informations du concours (titre, dates, prize pool)

#### Composant PDF
- **Fichier**: `src/components/pdf/contest-results-pdf.tsx`
- **Contenu**:
  - En-tête avec titre et dates
  - Section statistiques (6 KPIs)
  - Tableau classement avec mise en évidence des 3 premiers
  - Tableau évolution vues quotidiennes
  - Footer avec date de génération

#### Intégration UI
- **Page**: `/app/brand/contests/[id]`
- **Bouton**: "Export PDF" dans la section Leaderboard
- **Action**: Téléchargement direct du PDF

---

### 2. Génération de Factures PDF

#### API Génération
- **Route**: `POST /api/invoices/[payment_id]/generate`
- **Authentification**: Brand owner ou admin uniquement
- **CSRF**: Requis (sauf requêtes internes avec flag `x-internal-request`)
- **Fonctionnalités**:
  - Génération d'une facture PDF complète
  - Calcul automatique des montants (prize pool + commission 15% + TVA 20%)
  - Stockage dans Supabase Storage (bucket `invoices`)
  - Enregistrement de l'URL dans `payments_brand.metadata`
  - Numéro de facture unique : `INV-YYYYMMDD-UUID`

#### API Téléchargement
- **Route**: `GET /api/invoices/[payment_id]/download`
- **Fonctionnalités**:
  - Téléchargement de la facture PDF
  - Génération automatique si la facture n'existe pas encore
  - Nom de fichier : `facture-INV-XXXX.pdf`

#### Composant PDF
- **Fichier**: `src/components/pdf/invoice-pdf.tsx`
- **Contenu**:
  - En-tête avec logo ClipRace et numéro de facture
  - Informations marque (facturer à)
  - Informations émetteur (ClipRace)
  - Tableau détaillé des items (prize pool + commission)
  - Calculs TVA et total TTC
  - Informations de paiement (référence Stripe, date)
  - Notes et footer

#### Intégration UI
- **Page**: `/app/brand/billing`
- **Bouton**: "Facture" pour chaque paiement réussi
- **Action**: Téléchargement direct du PDF

---

## 📦 Dépendances Requises

### Installation

```bash
npm install @react-pdf/renderer
```

### Vérification

Vérifiez que la dépendance est présente dans `package.json` :

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.x.x"
  }
}
```

---

## 🗄️ Configuration Supabase Storage

### Bucket `invoices`

Le bucket `invoices` doit être créé dans Supabase Storage :

1. **Via Dashboard Supabase** :
   - Aller dans Storage
   - Créer un nouveau bucket nommé `invoices`
   - Définir comme privé (non public)

2. **Via SQL** (optionnel) :
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;
```

### Politiques RLS Storage

Les marques doivent pouvoir lire leurs propres factures :

```sql
-- Politique : Les marques peuvent lire leurs propres factures
CREATE POLICY "Brands can read own invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Politique : Service role peut écrire (pour génération automatique)
CREATE POLICY "Service role can write invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices' AND
  auth.role() = 'service_role'
);
```

---

## 🔄 Flux de Génération de Facture

### Option 1 : Génération à la demande (implémenté)

1. Utilisateur clique sur "Facture" dans `/app/brand/billing`
2. Appel à `GET /api/invoices/[payment_id]/download`
3. Si facture n'existe pas → appel automatique à `POST /api/invoices/[payment_id]/generate`
4. Génération du PDF
5. Stockage dans Supabase Storage
6. Retour du PDF à l'utilisateur

### Option 2 : Génération automatique (futur)

- Génération lors du webhook Stripe `checkout.session.completed`
- Nécessite configuration d'URL interne ou queue job
- Actuellement désactivé pour éviter les timeouts

---

## 📊 Structure des PDFs

### Résultats Concours

```
┌─────────────────────────────────┐
│ Rapport de Concours             │
│ [Titre]                         │
│ [Dates]                         │
├─────────────────────────────────┤
│ Statistiques Globales           │
│ - Vues totales                  │
│ - Engagement                    │
│ - Soumissions                   │
│ - CPV                           │
├─────────────────────────────────┤
│ Classement Final                │
│ Rang | Créateur | Vues | Gains  │
├─────────────────────────────────┤
│ Évolution Vues (7 jours)        │
│ Date | Vues                     │
└─────────────────────────────────┘
```

### Facture

```
┌─────────────────────────────────┐
│ ClipRace        Facture N° XXX  │
│                 Date: XX/XX/XX  │
├─────────────────────────────────┤
│ Facturer à      Émetteur        │
│ [Marque]        ClipRace        │
├─────────────────────────────────┤
│ Détails                         │
│ - Prize pool    | Prix          │
│ - Commission    | Prix           │
│ - TVA (20%)    | Montant        │
│ - Total TTC     | Montant        │
├─────────────────────────────────┤
│ Informations paiement           │
│ Référence Stripe: XXX           │
└─────────────────────────────────┘
```

---

## 🔒 Sécurité

### Authentification
- ✅ Vérification de rôle (brand/admin)
- ✅ Vérification d'ownership (brand_id)
- ✅ CSRF protection (sauf requêtes internes)

### Stockage
- ✅ Bucket privé (non public)
- ✅ RLS activée sur Storage
- ✅ URLs stockées dans métadonnées (pas d'exposition directe)

### Audit
- ✅ Logs dans `audit_logs` pour chaque génération

---

## 🚀 Utilisation

### Export Résultats Concours

1. Aller sur `/app/brand/contests/[id]`
2. Scroller jusqu'à la section "Classement"
3. Cliquer sur "Export PDF"
4. Le PDF se télécharge automatiquement

### Télécharger Facture

1. Aller sur `/app/brand/billing`
2. Trouver le paiement concerné (statut "Payé")
3. Cliquer sur "Facture"
4. Le PDF se télécharge automatiquement

---

## 📝 Notes Techniques

### Génération PDF
- Utilise `@react-pdf/renderer` avec `pdf()` et `toBlob()`
- Conversion en Buffer pour Next.js Response
- Format A4 standard

### Performance
- Génération synchrone (peut prendre 1-2 secondes)
- PDFs mis en cache dans Storage après première génération
- Taille moyenne : 50-200 KB selon le nombre de gagnants

### Limitations
- Pas de graphiques dans les PDFs (tableaux uniquement)
- Images non supportées pour l'instant
- Format fixe (pas de personnalisation)

---

## 🔮 Améliorations Futures

1. **Génération automatique** : Facture générée automatiquement lors du paiement
2. **Graphiques dans PDF** : Ajouter des graphiques d'évolution (via canvas)
3. **Personnalisation** : Logo marque dans les factures
4. **Email automatique** : Envoi de la facture par email après paiement
5. **Export CSV** : Ajouter export CSV du leaderboard (déjà prévu dans l'UI)

---

## ✅ Checklist de Déploiement

- [ ] Installer `@react-pdf/renderer` : `npm install @react-pdf/renderer`
- [ ] Créer le bucket `invoices` dans Supabase Storage
- [ ] Configurer les politiques RLS pour le bucket `invoices`
- [ ] Tester l'export PDF d'un concours
- [ ] Tester la génération/téléchargement d'une facture
- [ ] Vérifier que les PDFs sont bien stockés dans Storage
- [ ] Vérifier les permissions (seule la marque peut accéder à ses factures)

---

**Status**: ✅ Implémenté et prêt à l'utilisation (nécessite installation de la dépendance)

