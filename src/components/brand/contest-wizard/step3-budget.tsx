'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FieldWithTooltip } from '@/components/ui/field-with-tooltip';
import { Plus, Trash2, TrendingUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { computeAutomaticPrizes } from '@/lib/computeAutomaticPrizes';
import type { ContestWizardData } from '../contest-wizard-client';

interface Step3BudgetProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  brandId: string;
}

export function Step3Budget({ data, updateData, errors }: Step3BudgetProps) {
  const [estimatedViews, setEstimatedViews] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hasManualEdit, setHasManualEdit] = useState(false);
  const [lastAutoBudget, setLastAutoBudget] = useState<number | null>(null);

  // Simulateur : calculer les vues estimées
  useEffect(() => {
    // Estimation : ~1000 vues par euro de prize pool (exemple)
    const views = Math.round(data.total_prize_pool_cents / 100 * 1000);
    setEstimatedViews(views);
  }, [data.total_prize_pool_cents]);

  // Calcul automatique des gains quand le budget change
  useEffect(() => {
    const budgetEur = data.total_prize_pool_cents / 100;
    const MIN_PRIZE_EUR = 10;

    // Ne recalculer automatiquement que si :
    // - Le budget est valide (>= 10€)
    // - On n'a pas fait d'édition manuelle OU le budget a changé depuis le dernier calcul
    // - Les prix sont vides OU le budget a changé
    const shouldRecalculate =
      data.total_prize_pool_cents > 0 &&
      budgetEur >= MIN_PRIZE_EUR &&
      !hasManualEdit &&
      (data.prizes.length === 0 || lastAutoBudget !== data.total_prize_pool_cents);

    if (shouldRecalculate) {
      const autoPrizes = computeAutomaticPrizes(data.total_prize_pool_cents);
      updateData({ prizes: autoPrizes });
      setLastAutoBudget(data.total_prize_pool_cents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.total_prize_pool_cents]);

  // Recalculer automatiquement à partir du budget
  const recalculateAuto = () => {
    const autoPrizes = computeAutomaticPrizes(data.total_prize_pool_cents);
    updateData({ prizes: autoPrizes });
    setLastAutoBudget(data.total_prize_pool_cents);
    setHasManualEdit(false);
  };

  const addPrize = () => {
    const newPrize = {
      rank_start: data.prizes.length + 1,
      rank_end: data.prizes.length + 1,
      amount_cents: 0,
    };
    updateData({ prizes: [...data.prizes, newPrize] });
    setHasManualEdit(true);
  };

  const removePrize = (index: number) => {
    updateData({ prizes: data.prizes.filter((_, i) => i !== index) });
    setHasManualEdit(true);
  };

  const updatePrize = (index: number, updates: Partial<ContestWizardData['prizes'][0]>) => {
    const newPrizes = [...data.prizes];
    newPrizes[index] = { ...newPrizes[index], ...updates };
    updateData({ prizes: newPrizes });
    setHasManualEdit(true);
  };

  const totalDistributed = data.prizes.reduce(
    (sum, p) => sum + (p.amount_cents || 0) * (p.rank_end - p.rank_start + 1),
    0,
  );
  const remaining = data.total_prize_pool_cents - totalDistributed;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2 pb-2">
        <h2 className="text-2xl font-semibold">Définissez votre budget</h2>
        <p className="text-muted-foreground">
          Nous calculons automatiquement la répartition optimale des gains
        </p>
      </div>

      <div className="space-y-4">
        {/* Montant total */}
        <div className="grid gap-4 md:grid-cols-2">
          <FieldWithTooltip
            label="Montant total du prize pool"
            tooltip="Définis le budget total que tu veux allouer à ce concours. Ce montant sera réparti entre les gagnants selon la répartition que tu configures. Plus le budget est élevé, plus tu attires de créateurs de qualité et génères de vues. Estimation : 1000€ = ~50 000 vues estimées."
            required
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={data.total_prize_pool_cents / 100}
              onChange={(e) => {
                const euros = parseFloat(e.target.value) || 0;
                updateData({ total_prize_pool_cents: Math.round(euros * 100) });
              }}
              error={errors.total_prize_pool_cents}
              helpText="Montant en euros"
            />
          </FieldWithTooltip>

          <FieldWithTooltip
            label="Devise"
            tooltip="Sélectionne la devise dans laquelle tu veux payer les prix. Les paiements seront effectués dans cette devise via Stripe. Assure-toi que ta méthode de paiement Stripe supporte cette devise."
          >
            <select
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
              value={data.currency}
              onChange={(e) => updateData({ currency: e.target.value })}
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </FieldWithTooltip>
        </div>

        {/* Message si budget trop faible */}
        {data.total_prize_pool_cents > 0 && data.total_prize_pool_cents < 1000 && (
          <Card className="bg-muted/50 border-warning/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Le budget est trop faible pour proposer des gains intéressants. Augmentez le montant pour lancer un concours.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Résumé automatique des gains calculés - Design épuré */}
        {data.total_prize_pool_cents >= 1000 && data.prizes.length > 0 && (
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20 p-8 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Répartition automatique</p>
              <h3 className="text-2xl font-bold">
                {formatCurrency(data.total_prize_pool_cents, data.currency)}
              </h3>
              <p className="text-sm text-muted-foreground">
                pour <strong className="text-foreground">{data.prizes.length} créateurs</strong>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {data.prizes.slice(0, 3).map((prize, index) => (
                <div key={index} className="text-center p-4 bg-background/50 rounded-xl border">
                  <div className="text-xs text-muted-foreground mb-1">
                    {index === 0 ? '1er' : index === 1 ? '2e' : '3e'} prix
                  </div>
                  <div className="text-lg font-bold">
                    {formatCurrency(prize.amount_cents, data.currency)}
                  </div>
                </div>
              ))}
            </div>

            {data.prizes.length > 3 && (
              <div className="text-center p-4 bg-background/50 rounded-xl border">
                <div className="text-xs text-muted-foreground mb-1">
                  {data.prizes[3].rank_start}e–{data.prizes[data.prizes.length - 1].rank_end}e
                </div>
                <div className="text-sm font-medium">
                  {formatCurrency(data.prizes[data.prizes.length - 1].amount_cents, data.currency)} - {formatCurrency(data.prizes[3].amount_cents, data.currency)}
                </div>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Cette répartition motive les meilleurs créateurs tout en récompensant un large panel de participants.
            </p>

            {hasManualEdit && (
              <Button
                type="button"
                onClick={recalculateAuto}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                Recalculer automatiquement
              </Button>
            )}
          </div>
        )}

        {/* Simulateur */}
        {data.total_prize_pool_cents >= 1000 && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-semibold">Estimation de vues</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Pour {formatCurrency(data.total_prize_pool_cents, data.currency)}, vous pouvez
                espérer environ <strong>{estimatedViews.toLocaleString()} vues</strong>.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Estimation basée sur les performances moyennes des concours UGC.
              </p>
            </CardContent>
          </Card>
        )}


        {/* Options avancées : Répartition manuelle détaillée */}
        {data.total_prize_pool_cents >= 1000 && (
          <Card>
            <CardContent className="pt-6">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="flex w-full items-center justify-between text-sm font-medium py-2 hover:text-primary transition-colors"
              >
                <span>Modifier la répartition (options avancées)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-4 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez modifier cette répartition dans les options avancées.
                  </p>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Répartition des prix</Label>
                      <Button type="button" onClick={addPrize} size="sm" variant="secondary">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter un prix
                      </Button>
                    </div>

                    {data.prizes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun prix défini. Clique sur "Répartition automatique" ou ajoute manuellement.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {data.prizes.map((prize, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 grid gap-2 md:grid-cols-3">
                                  <Input
                                    label="Rang début"
                                    type="number"
                                    min="1"
                                    value={prize.rank_start}
                                    onChange={(e) =>
                                      updatePrize(index, { rank_start: parseInt(e.target.value, 10) || 1 })
                                    }
                                  />
                                  <Input
                                    label="Rang fin"
                                    type="number"
                                    min={prize.rank_start}
                                    value={prize.rank_end}
                                    onChange={(e) =>
                                      updatePrize(index, { rank_end: parseInt(e.target.value, 10) || 1 })
                                    }
                                  />
                                  <Input
                                    label="Montant (€)"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={prize.amount_cents / 100}
                                    onChange={(e) => {
                                      const euros = parseFloat(e.target.value) || 0;
                                      updatePrize(index, { amount_cents: Math.round(euros * 100) });
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  onClick={() => removePrize(index)}
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {errors.prizes && (
                      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.prizes}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

