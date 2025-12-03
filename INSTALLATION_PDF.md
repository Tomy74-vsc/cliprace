# Installation des dépendances PDF

Pour activer les fonctionnalités d'export PDF et de génération de factures, vous devez installer la bibliothèque `@react-pdf/renderer`.

## Installation

```bash
npm install @react-pdf/renderer
```

## Vérification

Après installation, vérifiez que la dépendance est bien présente dans `package.json` :

```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.x.x"
  }
}
```

## Fonctionnalités activées

Une fois installée, les fonctionnalités suivantes seront disponibles :

1. **Export PDF des résultats de concours** (`/api/contests/[id]/export-pdf`)
   - Statistiques complètes (vues, engagement, CPV)
   - Classement des gagnants
   - Évolution des vues sur 7 jours
   - Accessible depuis la page détail concours

2. **Génération automatique de factures** (`/api/invoices/[payment_id]/generate`)
   - Génération automatique lors du paiement réussi (webhook Stripe)
   - Stockage dans Supabase Storage (bucket `invoices`)
   - Téléchargement via `/api/invoices/[payment_id]/download`
   - Accessible depuis la page billing

## Configuration Supabase Storage

Assurez-vous que le bucket `invoices` existe dans Supabase Storage avec les politiques RLS appropriées :

```sql
-- Créer le bucket (via dashboard Supabase ou SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false);

-- Politique RLS : les marques peuvent lire leurs propres factures
CREATE POLICY "Brands can read own invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Notes

- Les PDFs sont générés côté serveur avec `@react-pdf/renderer`
- Les factures sont stockées dans Supabase Storage pour un accès permanent
- Les URLs des factures sont stockées dans `payments_brand.metadata.invoice_pdf_url`

