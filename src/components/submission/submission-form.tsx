/*
Source: Component SubmissionForm
Purpose: Formulaire pour participer à un concours (flow 3 étapes avec validations rapides)
*/
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { submissionCreateSchema, type SubmissionCreateInput } from '@/lib/validators/submissions';
import { useToastContext } from '@/hooks/use-toast-context';
import type { Platform } from '@/lib/validators/platforms';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { track } from '@/lib/analytics';
import { Progress } from '@/components/ui/progress';

interface SubmissionFormProps {
  contestId: string;
  allowedPlatforms: Platform[];
  onSuccess?: () => void;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function SubmissionForm({ contestId, allowedPlatforms, onSuccess }: SubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlValid, setUrlValid] = useState(false);
  const [acceptRules, setAcceptRules] = useState(false);
  const { toast } = useToastContext();
  const router = useRouter();
  const csrfToken = useCsrfToken();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    reset,
  } = useForm<SubmissionCreateInput>({
    resolver: zodResolver(submissionCreateSchema),
    defaultValues: {
      contest_id: contestId,
      platform: allowedPlatforms[0] || 'tiktok',
      video_url: '',
      caption: '',
    },
  });

  const selectedPlatform = watch('platform');
  const videoUrl = watch('video_url');

  useEffect(() => {
    if (!videoUrl) {
      setUrlValid(false);
      return;
    }
    setUrlValid(isAllowedUrl(selectedPlatform, videoUrl));
  }, [selectedPlatform, videoUrl]);

  const progress = useMemo(() => {
    const stepsCompleted = [Boolean(selectedPlatform), urlValid, acceptRules].filter(Boolean).length;
    return (stepsCompleted / 3) * 100;
  }, [acceptRules, selectedPlatform, urlValid]);

  const onSubmit = async (data: SubmissionCreateInput) => {
    setIsSubmitting(true);
    try {
      track('submit_video', { contest_id: contestId, platform: data.platform });
      const response = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur lors de la soumission');
      }

      toast({
        type: 'success',
        title: 'Soumission créée !',
        message: 'Ta participation a été enregistrée avec succès.',
      });

      reset();
      setUrlValid(false);
      setAcceptRules(false);
      onSuccess?.();
      router.push(`/app/creator/contests/${contestId}/leaderboard`);
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participer au concours</CardTitle>
        <CardDescription>3 étapes simples : choisir, coller le lien, confirmer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Progression</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-3 gap-2 text-[12px] text-muted-foreground">
              <div className={progress >= 33 ? 'text-primary font-medium' : ''}>1. Plateforme</div>
              <div className={progress >= 66 ? 'text-primary font-medium' : ''}>2. Lien</div>
              <div className={progress === 100 ? 'text-primary font-medium' : ''}>3. Confirmation</div>
            </div>
          </div>

          <div>
            <label htmlFor="platform" className="mb-2 block text-sm font-medium text-foreground">
              Plateforme *
            </label>
            <Controller
              name="platform"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="platform" className={errors.platform ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Sélectionnez une plateforme" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedPlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {PLATFORM_LABELS[platform]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.platform && (
              <p className="mt-1 text-sm text-red-600">{errors.platform.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="video_url" className="mb-2 block text-sm font-medium text-foreground">
              URL de la vidéo *
            </label>
            <Input
              id="video_url"
              type="url"
              placeholder={
                selectedPlatform === 'tiktok'
                  ? 'https://www.tiktok.com/@username/video/1234567890'
                  : selectedPlatform === 'instagram'
                    ? 'https://www.instagram.com/reel/abc123/'
                    : 'https://www.youtube.com/shorts/abc123'
              }
              {...register('video_url')}
            />
            {errors.video_url && (
              <p className="mt-1 text-sm text-red-600">
                {typeof errors.video_url.message === 'string'
                  ? errors.video_url.message
                  : 'Lien invalide pour cette plateforme'}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Colle l&apos;URL complète de ta vidéo {PLATFORM_LABELS[selectedPlatform]}
            </p>
            {videoUrl && (
              <p className={`mt-1 text-xs ${urlValid ? 'text-green-600' : 'text-red-600'}`}>
                {urlValid ? 'Lien valide' : 'Lien non reconnu pour cette plateforme'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="caption" className="mb-2 block text-sm font-medium text-foreground">
              Description (optionnel)
            </label>
            <Textarea
              id="caption"
              rows={4}
              placeholder="Ajoute une description à ta participation..."
              {...register('caption')}
            />
            {errors.caption && (
              <p className="mt-1 text-sm text-red-600">{errors.caption.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {watch('caption')?.length || 0} / 2200 caractères
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
            <Badge variant="info" className="shrink-0">
              Info
            </Badge>
            <p className="text-sm text-muted-foreground">
              Ta soumission sera soumise à modération avant d&apos;être visible.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={acceptRules}
              onChange={(e) => setAcceptRules(e.target.checked)}
              className="mt-1"
            />
            <span>
              J&apos;accepte les règles du concours et je confirme respecter les conditions de publication.
            </span>
          </label>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isSubmitting || !urlValid || !acceptRules}
          >
            {isSubmitting ? 'Envoi en cours...' : 'Soumettre ma participation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function isAllowedUrl(platform: Platform, url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (platform === 'tiktok') return host.includes('tiktok.com');
    if (platform === 'instagram') return host.includes('instagram.com');
    if (platform === 'youtube') return host.includes('youtube.com') || host.includes('youtu.be');
    return false;
  } catch {
    return false;
  }
}
