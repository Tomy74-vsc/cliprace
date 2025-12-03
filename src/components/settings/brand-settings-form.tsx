/*
Source: Brand settings form
*/
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import {
  brandProfileUpdateSchema,
  notificationEventOptions,
  notificationChannelOptions,
  type BrandProfileUpdateInput,
} from '@/lib/validators/profile';
import { track } from '@/lib/analytics';

interface BrandSettingsFormProps {
  initialProfile: {
    display_name: string;
    bio?: string;
    avatar_url?: string;
  };
  initialBrand: {
    company_name: string;
    website?: string | null;
    industry?: string | null;
    vat_number?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    address_city?: string | null;
    address_postal_code?: string | null;
    address_country?: string | null;
  };
  notificationPreferences: { event: string; channel: string; enabled: boolean }[];
}

export function BrandSettingsForm({
  initialProfile,
  initialBrand,
  notificationPreferences,
}: BrandSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();
  const [saving, setSaving] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const defaultNotificationState = notificationEventOptions.flatMap((event) =>
    notificationChannelOptions.map((channel) => {
      const existing = notificationPreferences.find((pref) => pref.event === event && pref.channel === channel);
      return {
        key: `${event}:${channel}`,
        enabled: existing ? existing.enabled : channel === 'inapp',
      };
    }),
  );

  const [notificationState, setNotificationState] = useState<Record<string, boolean>>(
    Object.fromEntries(defaultNotificationState.map((pref) => [pref.key, pref.enabled])),
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BrandProfileUpdateInput>({
    resolver: zodResolver(brandProfileUpdateSchema),
    defaultValues: {
      display_name: initialProfile.display_name,
      bio: initialProfile.bio || '',
      avatar_url: initialProfile.avatar_url || '',
      company_name: initialBrand.company_name,
      website: initialBrand.website || '',
      industry: initialBrand.industry || '',
      vat_number: initialBrand.vat_number || '',
      address_line1: initialBrand.address_line1 || '',
      address_line2: initialBrand.address_line2 || '',
      address_city: initialBrand.address_city || '',
      address_postal_code: initialBrand.address_postal_code || '',
      address_country: initialBrand.address_country || 'FR',
    },
  });

  const onSubmit = async (values: BrandProfileUpdateInput) => {
    setSaving(true);
    try {
      track('save_profile', { role: 'brand' });
      const notificationPayload = Object.entries(notificationState).map(([key, enabled]) => {
        const [event, channel] = key.split(':');
        return { event, channel, enabled };
      });

      const response = await fetch('/api/profile/brand/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          ...values,
          notification_preferences: notificationPayload,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Impossible de sauvegarder le profil');
      }
      toast({
        type: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations ont été sauvegardées.',
      });
      router.refresh();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: string) => {
    setNotificationState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAccountDeletion = async () => {
    if (requestingDeletion) return;
    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir demander la suppression de votre compte ? Cette action est irréversible.',
    );
    if (!confirmed) return;
    setRequestingDeletion(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Impossible de supprimer le compte');
      }
      toast({
        type: 'success',
        title: 'Demande enregistrée',
        message: 'Votre compte sera désactivé très prochainement.',
      });
      router.push('/auth/login?deleted=1');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setRequestingDeletion(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Profil public */}
      <Card>
        <CardHeader>
          <CardTitle>Profil public</CardTitle>
          <CardDescription>Nom, bio et avatar affichés aux créateurs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nom affiché</label>
            <Input {...register('display_name')} placeholder="Votre nom ou nom de marque" />
            <p className="text-xs text-muted-foreground mt-1">
              Ce nom sera visible sur les concours et les communications.
            </p>
            {errors.display_name && (
              <p className="text-xs text-red-500 mt-1">{errors.display_name.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Bio</label>
            <Textarea rows={4} {...register('bio')} placeholder="Décrivez votre marque en quelques lignes" />
            <p className="text-xs text-muted-foreground mt-1">
              Aide les créateurs à comprendre votre marque et vos valeurs.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Avatar (URL)</label>
            <Input {...register('avatar_url')} placeholder="https://..." />
            <p className="text-xs text-muted-foreground mt-1">
              Utilisez une image carrée et reconnaissable (par exemple votre logo).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informations entreprise */}
      <Card>
        <CardHeader>
          <CardTitle>Informations entreprise</CardTitle>
          <CardDescription>Détails de votre entreprise utilisés pour la facturation et la vérification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nom de l&apos;entreprise *</label>
            <Input {...register('company_name')} placeholder="Nom de votre entreprise" required />
            <p className="text-xs text-muted-foreground mt-1">
              Ce nom apparaîtra sur les factures et documents officiels.
            </p>
            {errors.company_name && (
              <p className="text-xs text-red-500 mt-1">{errors.company_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Site web</label>
              <Input {...register('website')} placeholder="https://votresite.com" />
              {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Secteur d&apos;activité</label>
              <Input {...register('industry')} placeholder="Ex: Mode, Tech, Food..." />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Numéro de TVA</label>
            <Input {...register('vat_number')} placeholder="FR12345678901" />
            <p className="text-xs text-muted-foreground mt-1">
              Optionnel, requis pour certaines transactions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader>
          <CardTitle>Adresse</CardTitle>
          <CardDescription>Adresse de facturation et siège social.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Ligne 1</label>
            <Input {...register('address_line1')} placeholder="Numéro et nom de rue" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Ligne 2</label>
            <Input {...register('address_line2')} placeholder="Complément d'adresse (optionnel)" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-foreground">Ville</label>
              <Input {...register('address_city')} placeholder="Ville" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Code postal</label>
              <Input {...register('address_postal_code')} placeholder="75001" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Pays</label>
            <Select
              value={watch('address_country') || 'FR'}
              onValueChange={(value) => setValue('address_country', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="BE">Belgique</SelectItem>
                <SelectItem value="CH">Suisse</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="US">États-Unis</SelectItem>
                <SelectItem value="GB">Royaume-Uni</SelectItem>
                <SelectItem value="DE">Allemagne</SelectItem>
                <SelectItem value="ES">Espagne</SelectItem>
                <SelectItem value="IT">Italie</SelectItem>
                <SelectItem value="NL">Pays-Bas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choisissez comment vous souhaitez être alerté.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationEventOptions.map((event) => (
            <div key={event} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm font-medium mb-3">{notificationLabel(event)}</p>
              <div className="flex flex-wrap gap-4">
                {notificationChannelOptions.map((channel) => {
                  const key = `${event}:${channel}`;
                  return (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationState[key]}
                        onChange={() => toggleNotification(key)}
                      />
                      <span>{channel === 'email' ? 'Email' : 'In-app'}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sécurité / suppression compte */}
      <Card>
        <CardHeader>
          <CardTitle>Zone sensible</CardTitle>
          <CardDescription>Suppression définitive de votre compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La désactivation supprimera l&apos;accès à ClipRace et informera les créateurs avec lesquels vous
            collaborez.
          </p>
          <Button type="button" variant="destructive" onClick={handleAccountDeletion} disabled={requestingDeletion}>
            {requestingDeletion ? 'Suppression...' : 'Supprimer mon compte'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

function notificationLabel(event: (typeof notificationEventOptions)[number]): string {
  switch (event) {
    case 'submission_approved':
      return 'Soumission approuvée';
    case 'submission_rejected':
      return 'Soumission refusée';
    case 'message_new':
      return 'Nouveau message';
    default:
      return event;
  }
}

