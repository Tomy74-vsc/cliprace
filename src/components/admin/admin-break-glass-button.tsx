'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';

type AdminBreakGlassButtonProps = {
  permission: string;
  onEnabled?: (expiresAt: string) => void;
};

export function AdminBreakGlassButton({ permission, onEnabled }: AdminBreakGlassButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();

  const handleEnable = async () => {
    if (reason.length < 8) {
      toast({
        type: 'warning',
        title: 'Raison invalide',
        message: 'La raison doit contenir au moins 8 caractères.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/break-glass/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          permission,
          ttl_minutes: ttlMinutes,
          reason,
          reason_code: 'other',
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(error.message || 'Impossible d\'activer le break-glass');
      }

      const data = await res.json();
      toast({
        type: 'success',
        title: 'Break-glass activé',
        message: `Actif pour ${ttlMinutes} minutes. Expire à ${new Date(data.expires_at).toLocaleTimeString('fr-FR')}.`,
      });

      onEnabled?.(data.expires_at);
      setOpen(false);
      setReason('');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : "Impossible d'activer le break-glass.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="warning"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <AlertTriangle className="h-4 w-4" />
        Activer break-glass
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Activer Break-glass
            </DialogTitle>
            <DialogDescription>
              Cette action nécessite un break-glass pour la permission : <strong>{permission}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-500">
                Attention
              </p>
              <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                Le break-glass vous donne des privilèges élevés temporaires. Toutes vos actions seront auditées.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ttl">Durée (minutes)</Label>
              <Input
                id="ttl"
                type="number"
                min="1"
                max="120"
                value={ttlMinutes}
                onChange={(e) => setTtlMinutes(Number.parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                Durée d&apos;activation du break-glass (1-120 minutes)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Raison <span className="text-destructive">*</span></Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Expliquez pourquoi vous activez le break-glass..."
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 caractères requis
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button
                onClick={handleEnable}
                disabled={loading || reason.length < 8}
                variant="warning"
              >
                {loading ? 'Activation...' : 'Activer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


