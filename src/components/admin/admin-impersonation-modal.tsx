'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getCsrfToken } from '@/lib/csrf-client';
import { useRouter } from 'next/navigation';

interface AdminImpersonationModalProps {
  userId: string;
  role: 'brand' | 'creator';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminImpersonationModal({
  userId,
  role,
  open,
  onOpenChange,
}: AdminImpersonationModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<'support' | 'debugging' | 'testing' | 'other'>('support');
  const [ttlMinutes, setTtlMinutes] = useState(15);

  const handleImpersonate = async () => {
    if (reason.length < 8) {
      alert('La raison doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken,
        },
        body: JSON.stringify({
          reason,
          reason_code: reasonCode,
          ttl_minutes: ttlMinutes,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Erreur inconnue' }));
        throw new Error(error.message || 'Échec de l\'impersonation');
      }

      const data = await res.json();
      if (data.action_link) {
        localStorage.setItem('admin_impersonation_data', JSON.stringify({
          target_user_id: userId,
          target_email: data.email,
          expires_at: data.expires_at,
        }));
        localStorage.setItem('admin_impersonation_return_url', window.location.href);
        window.location.href = data.action_link;
      } else {
        router.push(`/app/${role}/dashboard`);
      }
    } catch (error) {
      console.error('Impersonation error:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de l\'impersonation');
      setLoading(false);
    }
  };

  const roleLabel = role === 'brand' ? 'marque' : 'créateur';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voir en tant que {roleLabel}</DialogTitle>
          <DialogDescription>
            Vous allez être redirigé vers l&apos;interface {roleLabel} de cet utilisateur.
            Cette action sera enregistrée dans les logs d&apos;audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Raison de l&apos;impersonation *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Minimum 8 caractères"
              minLength={8}
            />
            {reason.length > 0 && reason.length < 8 && (
              <p className="text-sm text-destructive">
                La raison doit contenir au moins 8 caractères ({reason.length}/8)
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason-code">Type de raison</Label>
            <Select
              value={reasonCode}
              onValueChange={(v) => setReasonCode(v as 'support' | 'debugging' | 'testing' | 'other')}
            >
              <SelectTrigger id="reason-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="debugging">Debugging</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ttl">Durée de validité (minutes)</Label>
            <Input
              id="ttl"
              type="number"
              min={1}
              max={60}
              value={ttlMinutes}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 60) {
                  setTtlMinutes(value);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Entre 1 et 60 minutes (recommandé: 15 minutes)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleImpersonate}
            disabled={loading || reason.length < 8}
          >
            {loading ? 'Chargement...' : `Voir en tant que ${roleLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

