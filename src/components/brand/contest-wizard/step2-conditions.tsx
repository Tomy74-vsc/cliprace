'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FieldWithTooltip } from '@/components/ui/field-with-tooltip';
import { X, Plus, ChevronDown } from 'lucide-react';
import { PlatformBadge } from '@/components/creator/platform-badge';
import type { ContestWizardData } from '../contest-wizard-client';
import type { Platform } from '@/lib/validators/platforms';

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

interface Step2ConditionsProps {
  data: ContestWizardData;
  updateData: (updates: Partial<ContestWizardData>) => void;
  errors: Record<string, string>;
  brandId: string;
}

export function Step2Conditions({ data, updateData, errors }: Step2ConditionsProps) {
  const [newHashtag, setNewHashtag] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const togglePlatform = (platform: Platform) => {
    const networks = data.networks.includes(platform)
      ? data.networks.filter((p) => p !== platform)
      : [...data.networks, platform];
    updateData({ networks });
  };

  const addHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, '');
    if (tag && !data.required_hashtags.includes(tag)) {
      updateData({ required_hashtags: [...data.required_hashtags, tag] });
      setNewHashtag('');
    }
  };

  const removeHashtag = (tag: string) => {
    updateData({ required_hashtags: data.required_hashtags.filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2 pb-2">
        <h2 className="text-2xl font-semibold">Conditions de participation</h2>
        <p className="text-muted-foreground">
          Choisissez où les créateurs peuvent participer et définissez les règles
        </p>
      </div>

      <div className="space-y-4">
        {/* Plateformes */}
        <FieldWithTooltip
          label="Plateformes acceptées"
          tooltip="Sélectionne les plateformes sur lesquelles les créateurs peuvent soumettre leurs vidéos. Tu peux choisir une ou plusieurs plateformes. Plus tu en sélectionnes, plus tu auras de candidats potentiels, mais assure-toi que ton brief s'adapte à chaque plateforme."
          required
        >
          <div className="flex flex-wrap gap-2 mt-2">
            {PLATFORMS.map((platform) => {
              const isSelected = data.networks.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  className={`rounded-lg border-2 px-4 py-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <PlatformBadge platform={platform} />
                </button>
              );
            })}
          </div>
          {errors.networks && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.networks}</p>
          )}
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sélectionne au moins une plateforme
          </p>
        </FieldWithTooltip>

        {/* Options avancées (repliées) */}
        <Card>
          <CardContent className="pt-6">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex w-full items-center justify-between text-sm font-medium py-2 hover:text-primary transition-colors"
            >
              <span>Options avancées (facultatif)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen && (
              <div className="space-y-4 pt-4">
              {/* Hashtags requis */}
              <FieldWithTooltip
                label="Hashtags imposés"
                tooltip="Définis les hashtags que les créateurs doivent obligatoirement utiliser dans leurs vidéos. Cela permet de suivre les performances et d'assurer la cohérence du concours. Exemples : #MaMarque, #Concours2024, #Challenge. Les hashtags doivent être sans le symbole #."
              >
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                    placeholder="Ajouter un hashtag (sans #)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHashtag();
                      }
                    }}
                  />
                  <Button type="button" onClick={addHashtag} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {data.required_hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.required_hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Les créateurs devront utiliser ces hashtags dans leurs vidéos
                </p>
              </FieldWithTooltip>

              {/* Seuils minimums */}
              <div className="grid gap-4 md:grid-cols-2">
                <FieldWithTooltip
                  label="Min abonnés"
                  tooltip="Définis un nombre minimum d'abonnés requis pour participer. Cela permet de filtrer les créateurs selon leur audience. Laisse vide si tu veux accepter tous les créateurs. Exemples : 1000 pour micro-influenceurs, 10000 pour influenceurs établis."
                >
                  <Input
                    type="number"
                    min="0"
                    value={data.min_followers || ''}
                    onChange={(e) =>
                      updateData({
                        min_followers: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    placeholder="0"
                    helpText="Nombre minimum d'abonnés requis"
                  />
                </FieldWithTooltip>

                <FieldWithTooltip
                  label="Min vues mensuelles"
                  tooltip="Définis un nombre minimum de vues mensuelles moyennes requises. Cela garantit que les créateurs ont une audience engagée. Laisse vide si tu veux accepter tous les créateurs. Exemples : 5000 pour micro-influenceurs, 50000 pour influenceurs établis."
                >
                  <Input
                    type="number"
                    min="0"
                    value={data.min_views || ''}
                    onChange={(e) =>
                      updateData({ min_views: e.target.value ? parseInt(e.target.value, 10) : null })
                    }
                    placeholder="0"
                    helpText="Nombre minimum de vues mensuelles requises"
                  />
                </FieldWithTooltip>
              </div>

              {/* CGU */}
              <FieldWithTooltip
                label="Conditions générales d'utilisation"
                tooltip="Rédige les conditions générales d'utilisation de ton concours. Les créateurs devront les accepter avant de participer. Inclus les règles de participation, les critères de sélection, les droits d'utilisation des vidéos, et les modalités de paiement. Tu peux utiliser Markdown pour la mise en forme."
              >
                <Textarea
                  value={data.terms_markdown}
                  onChange={(e) => updateData({ terms_markdown: e.target.value })}
                  placeholder="Rédige les CGU du concours en Markdown..."
                  rows={8}
                  helpText="Les créateurs devront accepter ces CGU avant de participer"
                />
              </FieldWithTooltip>

              <FieldWithTooltip
                label="URL des CGU (alternative)"
                tooltip="Si tu préfères héberger tes CGU sur ton propre site web, tu peux fournir l'URL ici. Les créateurs seront redirigés vers cette page pour lire et accepter les conditions. Si tu remplis ce champ, le champ CGU Markdown ci-dessus sera ignoré."
              >
                <Input
                  type="url"
                  value={data.terms_url}
                  onChange={(e) => updateData({ terms_url: e.target.value })}
                  placeholder="https://example.com/cgu"
                  helpText="Si tu préfères héberger les CGU ailleurs"
                />
              </FieldWithTooltip>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

