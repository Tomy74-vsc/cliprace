'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/creator/empty-state';
import { TrackOnView } from '@/components/analytics/track-once';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const FAQ_ITEMS = [
  {
    category: 'Concours',
    question: 'Je ne vois pas de concours disponibles',
    answer:
      'Vérifie tes filtres sur la page Concours et reviens régulièrement : de nouveaux concours sont publiés au fil du temps. Supprime les filtres trop stricts et complète ton profil pour débloquer plus de concours.',
    link: '/app/creator/contests',
  },
  {
    category: 'Concours',
    question: 'Comment savoir si je suis éligible ?',
    answer:
      'Chaque concours indique les plateformes autorisées et les seuils followers/vues. Tu peux participer uniquement si les conditions sont remplies et que la fonction can_submit_to_contest te renvoie éligible.',
    link: '/app/creator/discover',
  },
  {
    category: 'Soumissions',
    question: 'Comment savoir si ma soumission est validée ?',
    answer:
      'Suis le statut dans Mes soumissions et via les notifications. Les vues/likes sont agrégées automatiquement à partir de la plateforme.',
    link: '/app/creator/submissions',
  },
  {
    category: 'Soumissions',
    question: 'Je veux modifier ou retirer une soumission',
    answer:
      'Tu peux retirer ta soumission si le concours est encore actif, ou contacter la marque via la fiche concours. Les doublons sont refusés si la même URL a déjà été utilisée.',
    link: '/app/creator/submissions',
  },
  {
    category: 'Paiements',
    question: 'Quand mes gains seront-ils disponibles ?',
    answer:
      'Après la clôture du concours et la validation des gagnants, tes gains apparaissent dans le portefeuille. Les retraits peuvent prendre quelques jours ouvrés en fonction de la méthode de paiement.',
    link: '/app/creator/wallet',
  },
  {
    category: 'Paiements',
    question: 'Urgence paiement ou cashout bloqué',
    answer:
      'Ouvre ton portefeuille pour vérifier l’état de tes gains et retraits. Si un retrait est en échec ou bloqué depuis plus de quelques jours ouvrés, contacte le support en priorité.',
    link: '/app/creator/wallet',
  },
];

export default function CreatorFaqPage() {
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
      <TrackOnView event="view_creator_faq" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Support & FAQ créateur</h1>
        <p className="text-sm text-muted-foreground">
          Réponses aux questions fréquentes sur les concours, les soumissions et les gains.
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
          <AlertTitle>Urgence paiement ?</AlertTitle>
          <AlertDescription>
            <Link href="/app/creator/wallet" className="text-primary hover:underline">
              Ouvrir mon portefeuille
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
        <EmptyState
          title="Aucune réponse trouvée"
          description="Consulte la documentation ci-dessous ou contacte le support."
          action={{
            label: 'Contacter le support',
            href: 'mailto:support@cliprace.com?subject=Support%20ClipRace%20Créateur',
          }}
          secondaryAction={{
            label: 'Découvrir les concours',
            href: '/app/creator/discover',
            variant: 'secondary',
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Une question spécifique ou un blocage sur un paiement ?</p>
          <p>
            Écris-nous à{' '}
            <Link href="mailto:support@cliprace.com" className="text-primary hover:underline">
              support@cliprace.com
            </Link>
            .
          </p>
          <p>
            Pour les questions de gains ou de cashout, pense à joindre une capture d’écran de ton portefeuille
            ClipRace et du moyen de paiement utilisé.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
