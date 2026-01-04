'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { FieldWithTooltip } from '@/components/ui/field-with-tooltip';
import type { ContestWizardData } from '../contest-wizard-client';

interface Step1GeneralInfoProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  brandId: string;
}

export function Step1GeneralInfo({ data, updateData, errors }: Step1GeneralInfoProps) {
  const [campaignDuration, setCampaignDuration] = useState<number>(14);

  // Initialiser les dates par défaut si elles sont vides (une seule fois au montage)
  useEffect(() => {
    if (!data.start_at || !data.end_at) {
      const now = new Date();
      // Date de début : 24h après maintenant (activation après paiement)
      const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      // Date de fin : startDate + durée de campagne
      const endDate = new Date(startDate.getTime() + campaignDuration * 24 * 60 * 60 * 1000);

      const updates: Partial<ContestWizardData> = {};
      if (!data.start_at) {
        updates.start_at = startDate.toISOString();
      }
      if (!data.end_at) {
        updates.end_at = endDate.toISOString();
      }
      if (Object.keys(updates).length > 0) {
        updateData(updates);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Seulement au montage

  // Mettre à jour la date de fin quand la durée change (si start_at existe)
  useEffect(() => {
    if (data.start_at && campaignDuration) {
      const startDate = new Date(data.start_at);
      const endDate = new Date(startDate.getTime() + campaignDuration * 24 * 60 * 60 * 1000);
      // Ne mettre à jour que si la date de fin actuelle ne correspond pas à la nouvelle durée
      const currentEnd = data.end_at ? new Date(data.end_at) : null;
      if (!currentEnd || Math.abs(currentEnd.getTime() - endDate.getTime()) > 60000) {
        updateData({ end_at: endDate.toISOString() });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignDuration]);

  const handleDurationChange = (days: number) => {
    setCampaignDuration(days);
    if (data.start_at) {
      const startDate = new Date(data.start_at);
      const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
      updateData({ end_at: endDate.toISOString() });
    }
  };

  // Calculer les dates pour l'affichage
  const startDate = data.start_at ? new Date(data.start_at) : null;
  const endDate = data.end_at ? new Date(data.end_at) : null;
  const controlEndDate = endDate ? new Date(endDate.getTime() + 5 * 24 * 60 * 60 * 1000) : null;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2 pb-2">
        <h2 className="text-2xl font-semibold">Informations de la campagne</h2>
        <p className="text-muted-foreground">
          Donnez un titre et une description claire pour attirer les créateurs
        </p>
      </div>

      <div className="space-y-4">
        <FieldWithTooltip
          label="Titre du concours"
          tooltip="Choisis un titre accrocheur et descriptif. Il sera visible par tous les créateurs et apparaîtra dans les résultats de recherche. Exemples : 'Concours TikTok été 2024', 'Défi créatif mode', 'Challenge beauté printemps'."
          required
        >
          <Input
            value={data.title}
            onChange={(e) => updateData({ title: e.target.value })}
            placeholder="Ex: Concours TikTok été 2024"
            error={errors.title}
            helpText="Maximum 120 caractères"
            maxLength={120}
          />
        </FieldWithTooltip>

        <FieldWithTooltip
          label="Description / Brief"
          tooltip="Décris clairement ton concours : objectif, thème, style attendu, règles de participation. Utilise Markdown pour la mise en forme (gras, listes, liens). Cette description aide les créateurs à comprendre ce que tu recherches et augmente la qualité des soumissions."
          required
        >
          <Textarea
            value={data.brief_md}
            onChange={(e) => updateData({ brief_md: e.target.value })}
            placeholder="Décris le concours, les règles, les attentes..."
            error={errors.brief_md}
            helpText="Maximum 5000 caractères. Utilise Markdown pour la mise en forme."
            rows={6}
            maxLength={5000}
          />
        </FieldWithTooltip>

        <FieldWithTooltip
          label="URL de la couverture"
          tooltip="Ajoute une image de couverture attrayante pour ton concours. Elle sera affichée sur la page publique et dans les résultats de recherche. Recommandation : image carrée (1080x1080px), haute qualité, représentant le thème du concours."
        >
          <Input
            type="url"
            value={data.cover_url}
            onChange={(e) => updateData({ cover_url: e.target.value })}
            placeholder="https://example.com/cover.jpg"
            error={errors.cover_url}
            helpText="URL de l'image de couverture du concours"
          />
        </FieldWithTooltip>

        {/* Durée de la campagne */}
        <FieldWithTooltip
          label="Durée de la campagne"
          tooltip="La durée pendant laquelle les créateurs pourront soumettre leurs vidéos. Nous activons la campagne 24 heures après le paiement pour vérifier que tout est en ordre."
        >
          <div className="flex gap-2">
            {[7, 14, 21].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleDurationChange(days)}
                className={`flex-1 rounded-lg border-2 px-4 py-2 text-sm transition-colors ${
                  campaignDuration === days
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {days} jours
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Durée recommandée : 14 jours pour laisser le temps aux créateurs de produire du contenu de qualité.
          </p>
        </FieldWithTooltip>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldWithTooltip
            label="Date de début"
            tooltip="Date et heure de début du concours. Les créateurs pourront soumettre leurs vidéos à partir de ce moment. Par défaut, la campagne s'active 24 heures après le paiement."
            required
          >
            <Input
              type="datetime-local"
              value={data.start_at ? new Date(data.start_at).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const newStart = new Date(e.target.value);
                  updateData({ start_at: newStart.toISOString() });
                  // Ajuster la date de fin pour garder la durée
                  if (data.end_at) {
                    const currentEnd = new Date(data.end_at);
                    const diff = currentEnd.getTime() - new Date(data.start_at).getTime();
                    const newEnd = new Date(newStart.getTime() + diff);
                    updateData({ end_at: newEnd.toISOString() });
                  }
                }
              }}
              error={errors.start_at}
            />
          </FieldWithTooltip>

          <FieldWithTooltip
            label="Date de fin"
            tooltip="Date et heure de fin du concours. Après cette date, les soumissions seront fermées et le classement final sera calculé."
            required
          >
            <Input
              type="datetime-local"
              value={data.end_at ? new Date(data.end_at).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                if (e.target.value) {
                  updateData({ end_at: new Date(e.target.value).toISOString() });
                }
              }}
              error={errors.end_at}
            />
          </FieldWithTooltip>
        </div>

        {/* Timeline améliorée */}
        {startDate && endDate && controlEndDate && (
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
            <h4 className="text-sm font-semibold mb-4 text-center">Calendrier de votre campagne</h4>
            <div className="flex items-center justify-center gap-2 flex-wrap text-xs mb-4">
              <span className="px-3 py-1.5 bg-background rounded-lg font-medium">Paiement</span>
              <span className="text-primary">→</span>
              <span className="px-3 py-1.5 bg-background rounded-lg text-muted-foreground">24h</span>
              <span className="text-primary">→</span>
              <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium">{campaignDuration} jours</span>
              <span className="text-primary">→</span>
              <span className="px-3 py-1.5 bg-background rounded-lg text-muted-foreground">5 jours</span>
              <span className="text-primary">→</span>
              <span className="px-3 py-1.5 bg-background rounded-lg font-medium">Résultats</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground mb-1">Début</div>
                <div className="font-medium">{startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground mb-1">Fin participations</div>
                <div className="font-medium">{endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground mb-1">Résultats</div>
                <div className="font-medium">{controlEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
              </div>
            </div>
          </div>
        )}

        <FieldWithTooltip
          label="Objectif marketing"
          tooltip="Note tes objectifs marketing pour ce concours. Cette information est privée et n'est pas visible par les créateurs. Elle t'aide à suivre tes KPIs et à analyser l'efficacité de tes concours."
        >
          <Textarea
            value={data.marketing_objective}
            onChange={(e) => updateData({ marketing_objective: e.target.value })}
            placeholder="Ex: Augmenter la notoriété, générer du trafic, lancer un produit..."
            rows={3}
            helpText="Cette information est pour ton usage interne uniquement"
          />
        </FieldWithTooltip>
      </div>
    </div>
  );
}

