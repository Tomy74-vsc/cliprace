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
import { Label } from '@/components/ui/label';
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
        title: 'Profil mis Ã  jour',
        message: 'Vos informations ont Ã©tÃ© sauvegardÃ©es.',
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
      'ÃŠtes-vous sÃ»r de vouloir demander la suppression de votre compte ? Cette action est irrÃ©versible.',
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
        title: 'Demande enregistrÃ©e',
        message: 'Votre compte sera dÃ©sactivÃ© trÃ¨s prochainement.',
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
          <CardDescription>Nom, bio et avatar affichÃ©s aux crÃ©ateurs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="brand-display-name" className="text-sm font-medium text-foreground">Nom affiche</Label>
            <Input id="brand-display-name" {...register('display_name')} placeholder="Votre nom ou nom de marque" />
            <p className="text-xs text-muted-foreground mt-1">
              Ce nom sera visible sur les concours et les communications.
            </p>
            {errors.display_name && (
              <p className="text-xs text-red-500 mt-1">{errors.display_name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="brand-bio" className="text-sm font-medium text-foreground">Bio</Label>
            <Textarea id="brand-bio" rows={4} {...register('bio')} placeholder="Decrivez votre marque en quelques lignes" />
            <p className="text-xs text-muted-foreground mt-1">
              Aide les createurs a comprendre votre marque et vos valeurs.
            </p>
          </div>
          <div>
            <Label htmlFor="brand-avatar-url" className="text-sm font-medium text-foreground">Avatar (URL)</Label>
            <Input id="brand-avatar-url" {...register('avatar_url')} placeholder="https://..." />
            <p className="text-xs text-muted-foreground mt-1">
              Utilisez une image carree et reconnaissable (par exemple votre logo).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informations entreprise */}
      <Card>
        <CardHeader>
          <CardTitle>Informations entreprise</CardTitle>
          <CardDescription>DÃ©tails de votre entreprise utilisÃ©s pour la facturation et la vÃ©rification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="brand-company-name" className="text-sm font-medium text-foreground">Nom de l&apos;entreprise *</Label>
            <Input id="brand-company-name" {...register('company_name')} placeholder="Nom de votre entreprise" required />
            <p className="text-xs text-muted-foreground mt-1">
              Ce nom apparaÃ®tra sur les factures et documents officiels.
            </p>
            {errors.company_name && (
              <p className="text-xs text-red-500 mt-1">{errors.company_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="brand-website" className="text-sm font-medium text-foreground">Site web</Label>
              <Input id="brand-website" {...register('website')} placeholder="https://votresite.com" />
              {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website.message}</p>}
            </div>
            <div>
              <Label htmlFor="brand-industry" className="text-sm font-medium text-foreground">Secteur d&apos;activite</Label>
              <Input id="brand-industry" {...register('industry')} placeholder="Ex: Mode, Tech, Food..." />
            </div>
          </div>
          <div>
            <Label htmlFor="brand-vat-number" className="text-sm font-medium text-foreground">Numero de TVA</Label>
            <Input id="brand-vat-number" {...register('vat_number')} placeholder="FR12345678901" />
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
          <CardDescription>Adresse de facturation et siÃ¨ge social.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="brand-address-line1" className="text-sm font-medium text-foreground">Ligne 1</Label>
            <Input id="brand-address-line1" {...register('address_line1')} placeholder="Numero et nom de rue" />
          </div>
          <div>
            <Label htmlFor="brand-address-line2" className="text-sm font-medium text-foreground">Ligne 2</Label>
            <Input id="brand-address-line2" {...register('address_line2')} placeholder="Complement d'adresse (optionnel)" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="brand-address-city" className="text-sm font-medium text-foreground">Ville</Label>
              <Input id="brand-address-city" {...register('address_city')} placeholder="Ville" />
            </div>
            <div>
              <Label htmlFor="brand-address-postal" className="text-sm font-medium text-foreground">Code postal</Label>
              <Input id="brand-address-postal" {...register('address_postal_code')} placeholder="75001" />
            </div>
          </div>
          <div>
            <Label htmlFor="brand-address-country" className="text-sm font-medium text-foreground">Pays</Label>
            <Select
              value={watch('address_country') || 'FR'}
              onValueChange={(value) => setValue('address_country', value)}
            >
              <SelectTrigger id="brand-address-country">
                <SelectValue placeholder="SÃ©lectionner un pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="BE">Belgique</SelectItem>
                <SelectItem value="CH">Suisse</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="US">Ã‰tats-Unis</SelectItem>
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
          <CardDescription>Choisissez comment vous souhaitez Ãªtre alertÃ©.</CardDescription>
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

      {/* SÃ©curitÃ© / suppression compte */}
      <Card>
        <CardHeader>
          <CardTitle>Zone sensible</CardTitle>
          <CardDescription>Suppression dÃ©finitive de votre compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La dÃ©sactivation supprimera l&apos;accÃ¨s Ã  ClipRace et informera les crÃ©ateurs avec lesquels vous
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
      return 'Soumission approuvÃ©e';
    case 'submission_rejected':
      return 'Soumission refusÃ©e';
    case 'message_new':
      return 'Nouveau message';
    default:
      return event;
  }
}

