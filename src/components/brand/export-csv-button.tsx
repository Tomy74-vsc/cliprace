'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';

interface ExportCsvButtonProps {
  contestId: string;
  contestTitle: string;
}

function fallbackFileName(contestTitle: string): string {
  const safe = contestTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'campagne';
  return `campagne-${safe}-cliprace.csv`;
}

function getDownloadFileName(disposition: string | null, contestTitle: string): string {
  if (!disposition) return fallbackFileName(contestTitle);

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallbackFileName(contestTitle);
}

export function ExportCSVButton({ contestId, contestTitle }: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToastContext();

  const onExport = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand/contests/${contestId}/export`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Export impossible');
      }

      const blob = await response.blob();
      const fileName = getDownloadFileName(
        response.headers.get('content-disposition'),
        contestTitle
      );
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('export_csv:error', error);
      toast({
        type: 'error',
        title: 'Export',
        message: error instanceof Error ? error.message : 'Impossible de lancer le téléchargement.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="md" onClick={onExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {loading ? 'Export...' : 'Exporter CSV'}
    </Button>
  );
}
