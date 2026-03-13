'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, UploadCloud, XCircle } from 'lucide-react';
import { WizardFormData } from '../../_types';
import { getCsrfToken } from '@/lib/csrf-client';
import { useToastContext } from '@/hooks/use-toast-context';
import { cn } from '@/lib/utils';

type Props = {
  data: WizardFormData;
  onChange: (patch: Partial<WizardFormData>) => void;
};

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function StepCover({ data, onChange }: Props) {
  const { toast } = useToastContext();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  const hasImage = Boolean(data.coverUrl);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const startSimulatedProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setUploadProgress(0);
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setUploadProgress(100);
      return;
    }

    progressTimer.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 98) {
          if (progressTimer.current) clearInterval(progressTimer.current);
          return prev;
        }
        return prev + 4;
      });
    }, 120);
  };

  const finishProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setUploadProgress(100);
  };

  const handleFile = async (file: File) => {
    setErrorMessage(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadState('error');
      setErrorMessage('Unsupported file type. Use JPG, PNG or WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadState('error');
      setErrorMessage('File is too large. Max size is 5MB.');
      return;
    }

    setUploadState('uploading');
    startSimulatedProgress();

    try {
      const token = await getCsrfToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/brand/upload/cover', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-csrf': token,
        },
        body: formData,
      });

      const json = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !json.url) {
        throw new Error(json.error ?? 'Upload failed');
      }

      finishProgress();
      setUploadState('success');
      onChange({ coverUrl: json.url, coverFile: null });
      toast({
        type: 'success',
        title: 'Cover uploaded',
        message: 'Your contest cover image is ready.',
      });
    } catch (error) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      setUploadState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Upload failed. Please try again.',
      );
      toast({
        type: 'error',
        title: 'Upload error',
        message:
          error instanceof Error ? error.message : 'We could not upload your image.',
      });
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (uploadState === 'uploading') return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const reset = () => {
    setUploadState('idle');
    setUploadProgress(0);
    setErrorMessage(null);
    onChange({ coverUrl: null, coverFile: null });
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={onDrop}
        aria-label="Upload cover image"
        className={cn(
          'flex flex-col items-center justify-center rounded-[var(--r3)] border border-dashed px-6 py-10 text-center outline-none transition-colors duration-150',
          'bg-[var(--surface-1)] border-[var(--border-2)]',
          !hasImage &&
            uploadState !== 'error' &&
            'hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent-soft)_50%,transparent)] cursor-pointer',
          uploadState === 'uploading' && 'cursor-default opacity-90',
          uploadState === 'error' &&
            'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onInputChange}
        />

        {!hasImage && uploadState !== 'uploading' && uploadState !== 'error' && (
          <>
            <UploadCloud className="mb-4 h-12 w-12 text-[var(--text-3)]" />
            <p className="text-sm font-medium text-[var(--text-1)]">
              Upload cover image
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              JPG, PNG or WebP, max 5MB. Drag & drop or click to browse.
            </p>
          </>
        )}

        {uploadState === 'uploading' && (
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--text-3)]" />
            <p className="text-sm font-medium text-[var(--text-1)]">Uploading...</p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {(hasImage || uploadState === 'success') && data.coverUrl && (
          <div className="flex w-full max-w-xl flex-col gap-4">
            <div className="relative w-full overflow-hidden rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.coverUrl}
                alt="Contest cover preview"
                className="h-48 w-full object-cover"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-2)]">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[var(--accent)]" />
                <span>Cover image set</span>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
              >
                Change image
              </button>
            </div>
          </div>
        )}

        {uploadState === 'error' && (
          <div className="mt-4 flex w-full max-w-md items-start gap-2 text-left text-xs text-[var(--danger)]">
            <XCircle className="mt-[1px] h-4 w-4" />
            <div className="space-y-1">
              <p>{errorMessage ?? 'Upload failed. Please try again.'}</p>
              <button
                type="button"
                onClick={() => {
                  setUploadState('idle');
                  setErrorMessage(null);
                }}
                className="text-[var(--text-2)] underline-offset-2 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-3)]">
        Tip: a clean, high-contrast cover helps creators instantly understand your
        brand and the contest theme.
      </p>
    </div>
  );
}

