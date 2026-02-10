/*
Page: Wizard création concours (5 étapes)
Étapes:
1. Informations générales (titre, brief, couverture, dates, objectif)
2. Conditions & règles (réseaux, hashtags, min abonnés/vues, CGU)
3. Budget & Cashprize (montant total, répartition, simulateur)
4. Validation & aperçu (résumé, aperçu public/créateur)
5. Paiement (Stripe Checkout, génération payments_brand, passage en active)
*/
import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ContestWizard } from '@/components/brand/wizard/ContestWizard';

export default async function NewContestWizardPage() {
  const { user } = await getSession();
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<div>Chargement...</div>}>
        <ContestWizard />
      </Suspense>
    </main>
  );
}
