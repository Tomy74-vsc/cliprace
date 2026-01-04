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
      <div className="text-center space-y-2 pb-2">
        <h2 className="text-2xl font-semibold">Récapitulatif</h2>
        <p className="text-muted-foreground">
          Vérifiez toutes les informations avant de finaliser votre campagne
        </p>
      </div>

      {/* Produit */}
      {(data.productName || data.productOneLiner) && (
        <div className="bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-primary/20 p-6 space-y-4">
          <h3 className="font-semibold text-lg">Votre produit</h3>
          {data.productName && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Nom</div>
              <div className="font-semibold text-base">{data.productName}</div>
            </div>
          )}
          {data.productOneLiner && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <div className="text-base">{data.productOneLiner}</div>
            </div>
          )}
          {data.productBenefits && data.productBenefits.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Points clés</div>
              <ul className="space-y-2">
                {data.productBenefits.filter((b) => b.trim()).map((benefit, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Résumé */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-muted/30 rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-lg">Informations</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Titre</div>
              <div className="font-semibold">{data.title || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Dates</div>
              <div className="font-medium">
                {data.start_at ? formatDate(data.start_at) : '—'} →{' '}
                {data.end_at ? formatDate(data.end_at) : '—'}
              </div>
            </div>
            {data.marketing_objective && (
              <div>
                <div className="text-muted-foreground mb-1">Objectif</div>
                <div className="font-medium">{data.marketing_objective}</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-lg">Conditions</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground mb-2">Plateformes</div>
              <div className="flex flex-wrap gap-2">
                {data.networks.length > 0 ? (
                  data.networks.map((p) => (
                    <PlatformBadge key={p} platform={p as Platform} />
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
            {data.required_hashtags.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2">Hashtags</div>
                <div className="flex flex-wrap gap-1">
                  {data.required_hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {(data.min_followers || data.min_views) && (
              <div>
                <div className="text-muted-foreground mb-1">Seuils minimums</div>
                <div className="font-medium">
                  {data.min_followers && `${data.min_followers.toLocaleString()} abonnés`}
                  {data.min_followers && data.min_views && ' • '}
                  {data.min_views && `${data.min_views.toLocaleString()} vues`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20 p-6 space-y-6">
        <div className="text-center">
          <h3 className="font-semibold text-lg mb-2">Budget & gains</h3>
          <div className="text-3xl font-bold">
            {formatCurrency(data.total_prize_pool_cents, data.currency)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            à distribuer à {data.prizes.reduce((sum, p) => sum + (p.rank_end - p.rank_start + 1), 0)} créateurs
          </p>
        </div>

        {data.prizes.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-center text-muted-foreground">Répartition</div>
            <div className="grid grid-cols-3 gap-3">
              {data.prizes.slice(0, 3).map((prize, index) => (
                <div key={index} className="text-center p-3 bg-background/50 rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">
                    {index === 0 ? '1er' : index === 1 ? '2e' : '3e'}
                  </div>
                  <div className="font-bold">
                    {formatCurrency(prize.amount_cents, data.currency)}
                  </div>
                </div>
              ))}
            </div>
            {data.prizes.length > 3 && (
              <div className="text-center p-3 bg-background/50 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">
                  {data.prizes[3].rank_start}e–{data.prizes[data.prizes.length - 1].rank_end}e
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency(data.prizes[data.prizes.length - 1].amount_cents, data.currency)} - {formatCurrency(data.prizes[3].amount_cents, data.currency)}
                </div>
              </div>
            )}
            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total à payer :</span>
                <span className="text-xl font-bold">
                  {formatCurrency(Math.round(data.total_prize_pool_cents * 1.15), data.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Inclut la commission de plateforme (15%)
              </p>
            </div>
          </div>
        )}
      </div>

      {data.brief_md && (
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
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            En cliquant sur "Finaliser", vous serez redirigé vers le paiement. La campagne sera créée
            en brouillon et passera en "active" une fois le paiement validé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

