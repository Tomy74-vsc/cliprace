'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useToastContext } from '@/hooks/use-toast-context';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type AdminActionPanelProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: ButtonProps['variant'];
  cancelLabel?: string;
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
  preview?: ReactNode;
  onConfirm: (args: { reason: string }) => Promise<void>;
};

export function AdminActionPanel({
  trigger,
  title,
  description,
  confirmLabel = 'Confirmer',
  confirmVariant = 'primary',
  cancelLabel = 'Annuler',
  requiresReason = false,
  reasonLabel = 'Raison',
  reasonPlaceholder = 'Explique brièvement…',
  minReasonLength = 2,
  preview,
  onConfirm,
}: AdminActionPanelProps) {
  const { toast } = useToastContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const reasonTrimmed = useMemo(() => reason.trim(), [reason]);
  const canConfirm = useMemo(() => {
    if (loading) return false;
    if (!requiresReason) return true;
    return reasonTrimmed.length >= minReasonLength;
  }, [loading, minReasonLength, reasonTrimmed, requiresReason]);

  const confirm = async () => {
    setLoading(true);
    try {
      await onConfirm({ reason: reasonTrimmed });
      setOpen(false);
      setReason('');
    } catch (error) {
      toast({
        type: 'error',
        title: 'Action impossible',
        message: error instanceof Error ? error.message : "Une erreur s'est produite.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason('');
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {preview ? <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">{preview}</div> : null}

        {requiresReason ? (
          <Textarea
            label={reasonLabel}
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={confirm} loading={loading} disabled={!canConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

