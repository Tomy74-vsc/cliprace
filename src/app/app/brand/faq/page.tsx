'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandEmptyState } from '@/components/brand/empty-state-enhanced';
import { TrackOnView } from '@/components/analytics/track-once';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FAQ_ITEMS = [
  {
    category: 'Création de concours',
    question: 'Comment créer mon premier concours ?',
    answer:
      'Utilisez le wizard de création accessible depuis le dashboard ou la page Concours. Le processus en 5 étapes vous guide : informations générales, conditions, budget, prévisualisation et paiement. Vous pouvez sauvegarder un brouillon à tout moment.',
    link: '/app/brand/contests/new',
  },
  {
    category: 'Création de concours',
    question: 'Puis-je modifier un concours après sa création ?',
    answer:
      'Oui, vous pouvez modifier un concours en statut "Draft" ou "Active" depuis la page de détail. Certaines modifications (dates, budget) peuvent nécessiter une nouvelle validation. Les concours terminés ne peuvent plus être modifiés.',
    link: '/app/brand/contests',
  },
  {
    category: 'Financement',
    question: 'Comment fonctionne le financement d\'un concours ?',
    answer:
      'Le financement se fait via Stripe Checkout lors de la création du concours. Vous définissez le budget total et la répartition des prix. Le paiement est sécurisé et les fonds sont débloqués progressivement selon les résultats.',
    link: '/app/brand/billing',
  },
  {
    category: 'Financement',
    question: 'Quand suis-je facturé ?',
    answer:
      'Vous êtes facturé immédiatement lors de la création du concours via Stripe. Les factures sont disponibles dans la section Billing. Vous pouvez suivre tous vos paiements et télécharger les factures depuis cette page.',
    link: '/app/brand/billing',
  },
  {
    category: 'Modération',
    question: 'Comment modérer les soumissions ?',
    answer:
      'Accédez à la page de modération depuis le détail d\'un concours. Vous pouvez approuver ou rejeter chaque soumission avec une raison. Les soumissions approuvées sont automatiquement intégrées au classement.',
    link: '/app/brand/contests',
  },
  {
    category: 'Modération',
    question: 'Que faire si une soumission ne respecte pas les règles ?',
    answer:
      'Rejetez la soumission en indiquant la raison (non-conformité, contenu inapproprié, etc.). Le créateur sera notifié et pourra soumettre une nouvelle vidéo si le concours est encore actif.',
    link: '/app/brand/contests',
  },
  {
    category: 'Classements et métriques',
    question: 'Comment suivre les performances de mon concours ?',
    answer:
      'Le dashboard et la page de détail du concours affichent les métriques en temps réel : vues totales, likes, nombre de soumissions, CPV (coût par vue), et le classement des participants. Les données sont mises à jour automatiquement.',
    link: '/app/brand/dashboard',
  },
  {
    category: 'Classements et métriques',
    question: 'Comment fonctionne le classement ?',
    answer:
      'Le classement est basé sur les performances des vidéos (vues, likes) avec un coefficient d\'équité. Les soumissions approuvées sont automatiquement classées. Vous pouvez consulter le top 10 sur la page de détail et le classement complet sur la page dédiée.',
    link: '/app/brand/contests',
  },
  {
    category: 'Messages',
    question: 'Comment contacter les créateurs ?',
    answer:
      'Utilisez la messagerie intégrée depuis la page Messages. Vous pouvez échanger avec les créateurs qui participent à vos concours. Les conversations sont organisées par concours et créateur.',
    link: '/app/brand/messages',
  },
  {
    category: 'Facturation',
    question: 'Où trouver mes factures Stripe ?',
    answer:
      'Toutes vos factures sont disponibles dans la section Billing. Vous pouvez consulter l\'historique des paiements, leur statut, et accéder directement aux factures Stripe pour téléchargement.',
    link: '/app/brand/billing',
  },
  {
    category: 'Facturation',
    question: 'Que faire en cas de problème de paiement ?',
    answer:
      'Vérifiez le statut du paiement dans la section Billing. Si un paiement est en échec, vous pouvez le relancer depuis la page de détail du concours. Pour toute question, contactez le support avec le numéro de transaction.',
    link: '/app/brand/billing',
  },
  {
    category: 'Paramètres',
    question: 'Comment compléter mon profil marque ?',
    answer:
      'Accédez aux Paramètres pour renseigner les informations de votre entreprise : nom, site web, secteur d\'activité, adresse complète. Un profil complet améliore votre visibilité et la confiance des créateurs.',
    link: '/app/brand/settings',
  },
];

export default function BrandFaqPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return FAQ_ITEMS;
    return FAQ_ITEMS.filter(
      (item) =>
        item.question.toLowerCase().includes(s) ||
        item.answer.toLowerCase().includes(s) ||
        item.category.toLowerCase().includes(s),
    );
  }, [search]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <TrackOnView event="view_brand_faq" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Support & FAQ marque</h1>
        <p className="text-sm text-muted-foreground">
          Réponses aux questions fréquentes sur la création de concours, la modération, les paiements et les métriques.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Rechercher une question"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
          aria-label="Rechercher dans la FAQ"
        />
        <Alert className="flex-1 min-w-[240px]">
          <AlertTitle>Problème de paiement ?</AlertTitle>
          <AlertDescription>
            <Link href="/app/brand/billing" className="text-primary hover:underline">
              Consulter mes factures
            </Link>
          </AlertDescription>
        </Alert>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {filtered.map((item, idx) => (
          <AccordionItem key={`${item.question}-${idx}`} value={`${item.question}-${idx}`}>
            <AccordionTrigger>
              {item.category} - {item.question}
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p>{item.answer}</p>
              <Link href={item.link} className="text-primary hover:underline text-sm">
                Ouvrir la page liée
              </Link>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {filtered.length === 0 && (
        <BrandEmptyState
          type="no-results"
          title="Aucune réponse trouvée"
          description="Consultez la documentation ci-dessous ou contactez le support."
          action={{
            label: 'Contacter le support',
            href: 'mailto:support@cliprace.com?subject=Support%20ClipRace%20Marque',
          }}
          secondaryAction={{
            label: 'Créer un concours',
            href: '/app/brand/contests/new',
            variant: 'secondary',
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Une question spécifique ou un problème technique ?</p>
          <p>
            Écrivez-nous à{' '}
            <Link href="mailto:support@cliprace.com" className="text-primary hover:underline">
              support@cliprace.com
            </Link>
            .
          </p>
          <p>
            Pour les questions de facturation ou de paiement, pensez à joindre le numéro de transaction Stripe et une
            capture d&apos;écran de votre section Billing.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

