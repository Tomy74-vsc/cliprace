'use client';

import { useContestWizard } from '@/store/useContestWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/formatters';

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function Step4Rules() {
  const { data, setData, errors } = useContestWizard();

  const handleDateChange = (field: 'start_at' | 'end_at', value: string) => {
    // On stocke au format ISO pour respecter le schéma Zod
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    setData({ [field]: date.toISOString() });
  };

  const bindPlatform = (platform: 'tiktok' | 'instagram' | 'youtube') => {
    const isActive = data.platforms.includes(platform);
    const toggle = () => {
      setData({
        platforms: isActive
          ? data.platforms.filter((p) => p !== platform)
          : [...data.platforms, platform],
      });
    };
    return { isActive, toggle };
  };

  const startLocalValue = data.start_at
    ? new Date(data.start_at).toISOString().slice(0, 16)
    : '';
  const endLocalValue = data.end_at ? new Date(data.end_at).toISOString().slice(0, 16) : '';

  const tiktok = bindPlatform('tiktok');
  const instagram = bindPlatform('instagram');
  const youtube = bindPlatform('youtube');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Règles & diffusion</h2>
        <p className="text-sm text-muted-foreground">
          Choisis la période d&apos;ouverture du concours et les plateformes sur lesquelles tu veux
          recevoir des créations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-medium">Période du concours</p>
            <p className="text-xs text-muted-foreground">
              Les créateurs pourront soumettre leurs contenus uniquement entre ces deux dates.
            </p>

            <div className="space-y-3">
              <Input
                label="Date de début"
                type="datetime-local"
                value={startLocalValue}
                onChange={(e) => handleDateChange('start_at', e.target.value)}
                error={errors.start_at}
                helpText={`Actuellement: ${formatDateTime(data.start_at)}`}
              />
              <Input
                label="Date de fin"
                type="datetime-local"
                value={endLocalValue}
                onChange={(e) => handleDateChange('end_at', e.target.value)}
                error={errors.end_at}
                helpText={`Actuellement: ${formatDateTime(data.end_at)}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-medium">Plateformes autorisées</p>
            <p className="text-xs text-muted-foreground">
              Active les plateformes où tu veux lancer le challenge. Au moins une plateforme est
              requise.
            </p>

            <div className="space-y-3">
              <PlatformToggle
                label={PLATFORM_LABELS.tiktok}
                description="Formats courts et viraux, idéal pour l’UGC rapide."
                {...tiktok}
              />
              <PlatformToggle
                label={PLATFORM_LABELS.instagram}
                description="Reels, stories et carrousels pour des contenus plus édito."
                {...instagram}
              />
              <PlatformToggle
                label={PLATFORM_LABELS.youtube}
                description="Vidéos plus longues, reviews détaillées, vlogs."
                {...youtube}
              />
            </div>

            {errors.platforms && (
              <p className="mt-2 text-xs text-destructive">{errors.platforms}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlatformToggle({
  label,
  description,
  isActive,
  toggle,
}: {
  label: string;
  description: string;
  isActive: boolean;
  toggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={toggle}
      className="w-full text-left rounded-xl border border-border/70 bg-background/60 hover:border-primary/50 transition-colors px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={isActive} onCheckedChange={toggle} />
    </button>
  );
}

