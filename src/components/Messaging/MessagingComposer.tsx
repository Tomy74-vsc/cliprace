"use client";

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { MessagingMessage } from './types';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

interface MessagingComposerProps {
  threadId: string;
  onSent?: (message: MessagingMessage) => void;
}

export function MessagingComposer({ threadId, onSent }: MessagingComposerProps) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    const nextFiles: File[] = [];
    for (const file of selectedFiles) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" dépasse la limite de 10 Mo.`);
        continue;
      }
      nextFiles.push(file);
    }

    setFiles(prev => {
      const merged = [...prev, ...nextFiles].slice(0, MAX_ATTACHMENTS);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return merged;
    });
    setError(null);
  };

  const handleRemoveFile = (name: string) => {
    setFiles(prev => prev.filter(file => file.name !== name));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body && files.length === 0) {
      setError('Ajoutez un message ou une pièce jointe.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('body', body);
      files.forEach(file => formData.append('attachments', file));

      const response = await fetch(`/api/messages/${threadId}/reply`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Erreur lors de l'envoi." }));
        throw new Error(payload.error || "Erreur lors de l'envoi du message");
      }

      const payload = await response.json();
      onSent?.(payload.data as MessagingMessage);
      setBody('');
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Erreur envoi message:', err);
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le message");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border/60 pt-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <textarea
        value={body}
        onChange={event => setBody(event.target.value)}
        placeholder="Écrire un message à votre partenaire..."
        rows={3}
        className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground hover:border-foreground/60">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
          Ajouter des pièces jointes
        </label>
        <span>{files.length}/{MAX_ATTACHMENTS} pièces jointes</span>
        {files.length > 0 && (
          <span>{(totalSize / (1024 * 1024)).toFixed(2)} Mo</span>
        )}
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map(file => (
            <li key={file.name} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
              <Badge variant="outline" className="bg-background/60 text-foreground">
                {file.type || 'Fichier'}
              </Badge>
              <span className="max-w-[140px] truncate text-xs">{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(file.name)}
                className="text-muted-foreground transition hover:text-destructive"
                aria-label={`Retirer ${file.name}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={sending}>
          {sending ? 'Envoi...' : 'Envoyer'}
        </Button>
      </div>
    </form>
  );
}
