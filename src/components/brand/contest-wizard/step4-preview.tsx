'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/creator/platform-badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { ContestWizardData } from '../contest-wizard-client';
import type { Platform } from '@/lib/validators/platforms';

interface Step4PreviewProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  brandId: string;
}

export function Step4Preview({ data }: Step4PreviewProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-2 pb-2 text-center">
        <h2 className="text-2xl font-semibold">Récapitulatif</h2>
        <p className="text-muted-foreground">
          Vérifiez toutes les informations avant de finaliser votre campagne
        </p>
      </div>

      {(data.productName || data.productOneLiner) ? (
        <div className="space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
          <h3 className="text-lg font-semibold">Votre produit</h3>
          {data.productName ? (
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Nom</div>
              <div className="text-base font-semibold">{data.productName}</div>
            </div>
          ) : null}
          {data.productOneLiner ? (
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Description</div>
              <div className="text-base">{data.productOneLiner}</div>
            </div>
          ) : null}
          {data.productBenefits && data.productBenefits.length > 0 ? (
            <div>
              <div className="mb-2 text-sm text-muted-foreground">Points clés</div>
              <ul className="space-y-2">
                {data.productBenefits.filter((benefit) => benefit.trim()).map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 text-primary">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-muted/30 p-6">
          <h3 className="text-lg font-semibold">Informations</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-muted-foreground">Titre</div>
              <div className="font-semibold">{data.title || '-'}</div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground">Dates</div>
              <div className="font-medium">
                {data.start_at ? formatDate(data.start_at) : '-'} à{' '}
                {data.end_at ? formatDate(data.end_at) : '-'}
              </div>
            </div>
            {data.marketing_objective ? (
              <div>
                <div className="mb-1 text-muted-foreground">Objectif</div>
                <div className="font-medium">{data.marketing_objective}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-muted/30 p-6">
          <h3 className="text-lg font-semibold">Conditions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-2 text-muted-foreground">Plateformes</div>
              <div className="flex flex-wrap gap-2">
                {data.networks.length > 0 ? (
                  data.networks.map((platform) => (
                    <PlatformBadge key={platform} platform={platform as Platform} />
                  ))
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
            {data.required_hashtags.length > 0 ? (
              <div>
                <div className="mb-2 text-muted-foreground">Hashtags</div>
                <div className="flex flex-wrap gap-1">
                  {data.required_hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {data.min_followers || data.min_views ? (
              <div>
                <div className="mb-1 text-muted-foreground">Seuils minimums</div>
                <div className="font-medium">
                  {data.min_followers ? `${data.min_followers.toLocaleString()} abonnés` : ''}
                  {data.min_followers && data.min_views ? ' • ' : ''}
                  {data.min_views ? `${data.min_views.toLocaleString()} vues` : ''}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold">Budget & gains</h3>
          <div className="text-3xl font-bold">
            {formatCurrency(data.total_prize_pool_cents, data.currency)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            à distribuer à {data.prizes.reduce((sum, prize) => sum + (prize.rank_end - prize.rank_start + 1), 0)} créateurs
          </p>
        </div>

        {data.prizes.length > 0 ? (
          <div className="space-y-3">
            <div className="text-center text-sm font-medium text-muted-foreground">Répartition</div>
            <div className="grid grid-cols-3 gap-3">
              {data.prizes.slice(0, 3).map((prize, index) => (
                <div key={index} className="rounded-lg border bg-background/50 p-3 text-center">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {index === 0 ? '1er' : index === 1 ? '2e' : '3e'}
                  </div>
                  <div className="font-bold">
                    {formatCurrency(prize.amount_cents, data.currency)}
                  </div>
                </div>
              ))}
            </div>
            {data.prizes.length > 3 ? (
              <div className="rounded-lg border bg-background/50 p-3 text-center">
                <div className="mb-1 text-xs text-muted-foreground">
                  {data.prizes[3].rank_start}e à {data.prizes[data.prizes.length - 1].rank_end}e
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency(data.prizes[data.prizes.length - 1].amount_cents, data.currency)} - {formatCurrency(data.prizes[3].amount_cents, data.currency)}
                </div>
              </div>
            ) : null}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total à payer :</span>
                <span className="text-xl font-bold">
                  {formatCurrency(Math.round(data.total_prize_pool_cents * 1.15), data.currency)}
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Inclut la commission de plateforme (15%)
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {data.brief_md ? (
        <Card>
          <CardHeader>
            <CardTitle>Brief créateur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{data.brief_md}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            En cliquant sur &quot;Finaliser&quot;, vous serez redirigé vers le paiement. La campagne sera créée
            en brouillon et passera en &quot;active&quot; une fois le paiement validé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
