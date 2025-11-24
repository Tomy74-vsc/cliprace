/*
Source: Creator settings form (phase 2)
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
  profileUpdateSchema,
  notificationEventOptions,
  notificationChannelOptions,
  type ProfileUpdateInput,
} from '@/lib/validators/profile';

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
      const existing = notificationPreferences.find(
        (pref) => pref.event === event && pref.channel === channel
      );
      return {
        key: `${event}:${channel}`,
        enabled: existing ? existing.enabled : channel === 'inapp',
      };
    })
  );

  const [notificationState, setNotificationState] = useState<Record<string, boolean>>(
    Object.fromEntries(defaultNotificationState.map((pref) => [pref.key, pref.enabled]))
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
      'Êtes-vous sûr de vouloir demander la suppression de votre compte ? Cette action est irréversible.'
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
      <Card>
        <CardHeader>
          <CardTitle>Profil public</CardTitle>
          <CardDescription>Nom, bio et avatar affichés aux marques.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nom affiché</label>
            <Input {...register('display_name')} placeholder="Votre nom" />
            {errors.display_name && (
              <p className="text-xs text-red-500 mt-1">{errors.display_name.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Bio</label>
            <Textarea rows={4} {...register('bio')} placeholder="Décrivez votre univers" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Avatar (URL)</label>
            <Input {...register('avatar_url')} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations créateur</CardTitle>
          <CardDescription>Plateforme principale et métriques clés.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">Prénom</label>
            <Input {...register('first_name')} placeholder="Prénom" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Nom</label>
            <Input {...register('last_name')} placeholder="Nom" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Handle</label>
            <Input {...register('handle')} placeholder="@monpseudo" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Plateforme principale</label>
            <Select
              value={watch('primary_platform')}
              onValueChange={(value) => setValue('primary_platform', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Followers</label>
            <Input type="number" {...register('followers', { valueAsNumber: true })} min={0} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Vues moyennes</label>
            <Input type="number" {...register('avg_views', { valueAsNumber: true })} min={0} />
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Zone sensible</CardTitle>
          <CardDescription>Suppression définitive de votre compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La désactivation supprimera l'accès à ClipRace et informera les marques avec lesquelles vous collaborez.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={handleAccountDeletion}
            disabled={requestingDeletion}
          >
            {requestingDeletion ? 'Suppression...' : 'Supprimer mon compte'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
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
