/*
Source: Creator settings form (phase 2, rÃ©Ã©crit UTF-8)
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
  profileUpdateSchema,
  notificationEventOptions,
  notificationChannelOptions,
  type ProfileUpdateInput,
} from '@/lib/validators/profile';
import { track } from '@/lib/analytics';

interface CreatorSettingsFormProps {
  initialProfile: {
    display_name: string;
    bio?: string;
    avatar_url?: string;
  };
  initialCreator: {
    first_name?: string;
    last_name?: string;
    handle?: string;
    primary_platform: 'tiktok' | 'instagram' | 'youtube';
    followers?: number;
    avg_views?: number;
  };
  notificationPreferences: { event: string; channel: string; enabled: boolean }[];
}

export function CreatorSettingsForm({
  initialProfile,
  initialCreator,
  notificationPreferences,
}: CreatorSettingsFormProps) {
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
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: initialProfile.display_name,
      bio: initialProfile.bio || '',
      avatar_url: initialProfile.avatar_url || '',
      first_name: initialCreator.first_name || '',
      last_name: initialCreator.last_name || '',
      handle: initialCreator.handle || '',
      primary_platform: initialCreator.primary_platform || 'tiktok',
      followers: initialCreator.followers ?? 0,
      avg_views: initialCreator.avg_views ?? 0,
    },
  });

  const onSubmit = async (values: ProfileUpdateInput) => {
    setSaving(true);
    try {
      track('save_profile', { role: 'creator' });
      const notificationPayload = Object.entries(notificationState).map(([key, enabled]) => {
        const [event, channel] = key.split(':');
        return { event, channel, enabled };
      });

      const response = await fetch('/api/profile/update', {
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
          <CardDescription>Nom, bio et avatar affichÃ©s aux marques.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="creator-display-name" className="text-sm font-medium text-foreground">Nom affiche</Label>
            <Input id="creator-display-name" {...register('display_name')} placeholder="Votre nom ou pseudo" />
            <p className="text-xs text-muted-foreground mt-1">
              Ce nom sera visible sur les concours et les classements.
            </p>
            {errors.display_name && (
              <p className="text-xs text-red-500 mt-1">{errors.display_name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="creator-bio" className="text-sm font-medium text-foreground">Bio</Label>
            <Textarea id="creator-bio" rows={4} {...register('bio')} placeholder="Decrivez votre univers en quelques lignes" />
            <p className="text-xs text-muted-foreground mt-1">
              Aide les marques a comprendre ton contenu et ton audience.
            </p>
          </div>
          <div>
            <Label htmlFor="creator-avatar-url" className="text-sm font-medium text-foreground">Avatar (URL)</Label>
            <Input id="creator-avatar-url" {...register('avatar_url')} placeholder="https://..." />
            <p className="text-xs text-muted-foreground mt-1">
              Utilise une image carree et reconnaissable (par exemple ta PP TikTok).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informations crÃ©ateur / stats */}
      <Card>
        <CardHeader>
          <CardTitle>Profil crÃ©ateur & stats</CardTitle>
          <CardDescription>Plateforme principale et mÃ©triques clÃ©s utilisÃ©es pour lâ€™Ã©ligibilitÃ©.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="creator-first-name" className="text-sm font-medium text-foreground">Prenom</Label>
            <Input id="creator-first-name" {...register('first_name')} placeholder="Prenom" />
          </div>
          <div>
            <Label htmlFor="creator-last-name" className="text-sm font-medium text-foreground">Nom</Label>
            <Input id="creator-last-name" {...register('last_name')} placeholder="Nom" />
          </div>
          <div>
            <Label htmlFor="creator-handle" className="text-sm font-medium text-foreground">Handle</Label>
            <Input id="creator-handle" {...register('handle')} placeholder="@monpseudo" />
            <p className="text-xs text-muted-foreground mt-1">
              Sans URL complete, uniquement ton identifiant sur la plateforme (ex. @moncompte).
            </p>
          </div>
          <div>
            <Label htmlFor="creator-platform" className="text-sm font-medium text-foreground">Plateforme principale</Label>
            <Select
              value={watch('primary_platform')}
              onValueChange={(value) => setValue('primary_platform', value as ProfileUpdateInput['primary_platform'])}
            >
              <SelectTrigger id="creator-platform">
                <SelectValue placeholder="Selectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              ClipRace utilise cette plateforme pour calculer ton eligibilite principale.
            </p>
          </div>
          <div>
            <Label htmlFor="creator-followers" className="text-sm font-medium text-foreground">Followers</Label>
            <Input id="creator-followers" type="number" min={0} {...register('followers', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground mt-1">
              Nombre approximatif de followers sur ta plateforme principale (arrondi).
            </p>
          </div>
          <div>
            <Label htmlFor="creator-avg-views" className="text-sm font-medium text-foreground">Vues moyennes</Label>
            <Input id="creator-avg-views" type="number" min={0} {...register('avg_views', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground mt-1">
              Moyenne des vues sur tes dernieres videos. Un profil sans stats completes peut etre exclu de certains concours.
            </p>
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
            La dÃ©sactivation supprimera l&apos;accÃ¨s Ã  ClipRace et informera les marques avec lesquelles vous
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


