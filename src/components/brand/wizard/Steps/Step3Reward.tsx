'use client';

import { useMemo } from 'react';
import { useContestWizard } from '@/store/useContestWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { calculatePrizeDistribution } from '@/lib/contest-math';
import { formatCurrency } from '@/lib/formatters';

export function Step3Reward() {
  const { data, setData, errors } = useContestWizard();

  const isCash = data.contest_type === 'cash';

  const prizeAmountCents = data.prize_amount ?? 0;

  const podium = useMemo(
    () => (isCash && prizeAmountCents > 0 ? calculatePrizeDistribution(prizeAmountCents) : []),
    [isCash, prizeAmountCents]
  );

  const handleBudgetChange = (value: string) => {
    const euros = Number(value.replace(',', '.')) || 0;
    setData({ prize_amount: Math.round(euros * 100) });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Définis la récompense principale
        </h2>
        <p className="text-sm text-muted-foreground">
          C’est ce qui va motiver les créateurs à participer. Tu peux toujours ajuster plus tard.
        </p>
      </div>

      {isCash ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <Input
                label="Budget total (en €)"
                type="number"
                min={0}
                placeholder="Ex: 1000"
                value={prizeAmountCents ? String(prizeAmountCents / 100) : ''}
                onChange={(e) => handleBudgetChange(e.target.value)}
                error={errors.prize_amount}
                helpText="Montant total du cashprize qui sera réparti entre les gagnants."
              />

              <div className="rounded-xl bg-muted/60 border border-dashed px-4 py-3 text-xs text-muted-foreground">
                La répartition est calculée automatiquement pour rester attractive, avec un podium
                généreux et des lots lissés sur les places suivantes.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/40">
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Répartition automatique des gains</p>
                  <p className="text-xs text-muted-foreground">
                    Basée sur une logique podium (1er, 2ème, 3ème...) synchronisée avec la logique
                    serveur.
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  Total:{' '}
                  <span className="text-primary">
                    {formatCurrency(prizeAmountCents || 0, 'EUR')}
                  </span>
                </p>
              </div>

              {podium.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Saisis un budget total pour voir la répartition proposée.
                </p>
              ) : (
                <div className="space-y-2">
                  {podium.slice(0, 5).map((slice) => (
                    <div
                      key={slice.rank}
                      className="flex items-center justify-between rounded-lg bg-background/60 border border-border/60 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {slice.rank}
                        </span>
                        <span>
                          {slice.rank}
                          {slice.rank === 1 ? 'er' : 'ème'} place
                        </span>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(slice.amount_cents, 'EUR')}
                      </span>
                    </div>
                  ))}
                  {podium.length > 5 && (
                    <p className="text-[11px] text-muted-foreground">
                      + {podium.length - 5} autres places avec des gains lissés automatiquement.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm font-medium">Expédition du produit</p>
              <p className="text-xs text-muted-foreground">
                Indique qui gère l’envoi des produits aux créateurs gagnants. Tu pourras préciser
                les régions éligibles ensuite.
              </p>

              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Je gère moi-même l&apos;expédition</p>
                  <p className="text-xs text-muted-foreground">
                    Tu t’occupes d’envoyer les produits aux gagnants (adresse, suivi, retours...).
                  </p>
                </div>
                <Switch
                  checked={data.shipping_info?.shipping_type === 'brand_managed'}
                  onCheckedChange={(checked) =>
                    setData({
                      shipping_info: checked
                        ? {
                            shipping_type: 'brand_managed',
                            regions: data.shipping_info?.regions?.length
                              ? data.shipping_info.regions
                              : ['FR'],
                          }
                        : undefined,
                    })
                  }
                />
              </div>

              {errors.shipping_info && (
                <p className="text-xs text-destructive mt-1.5">{errors.shipping_info}</p>
              )}

              {data.shipping_info && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Régions desservies (liste rapide)
                  </Label>
                  <Input
                    placeholder="Ex: FR, BE, CH"
                    value={data.shipping_info.regions.join(', ')}
                    onChange={(e) => {
                      const parts = e.target.value
                        .split(',')
                        .map((p) => p.trim())
                        .filter(Boolean);
                      setData({
                        shipping_info: {
                          shipping_type: 'brand_managed',
                          regions: parts.length ? parts : ['FR'],
                        },
                      });
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tu pourras affiner ensuite dans tes paramètres logistiques si besoin.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

