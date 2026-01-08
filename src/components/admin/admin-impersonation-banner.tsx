'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Bannière d'impersonation affichée en haut de l'interface
 * quand un admin est en mode impersonation
 */
export function AdminImpersonationBanner() {
  const router = useRouter();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationData, setImpersonationData] = useState<{
    target_user_id: string;
    target_email?: string;
    expires_at?: string;
  } | null>(null);

  useEffect(() => {
    // Vérifier si on est en mode impersonation
    const stored = localStorage.getItem('admin_impersonation_data');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.target_user_id) {
          // Vérifier expiration
          if (data.expires_at) {
            const expiresAt = new Date(data.expires_at);
            if (expiresAt < new Date()) {
              // Expiré, nettoyer
              localStorage.removeItem('admin_impersonation_data');
              localStorage.removeItem('admin_impersonation_return_url');
              setIsImpersonating(false);
              setImpersonationData(null);
              return;
            }
          }
          setIsImpersonating(true);
          setImpersonationData(data);
        }
      } catch {
        // Invalid data, nettoyer
        localStorage.removeItem('admin_impersonation_data');
        localStorage.removeItem('admin_impersonation_return_url');
      }
    }
  }, []);

  const handleExit = () => {
    // Retourner à l'interface admin
    const returnUrl = localStorage.getItem('admin_impersonation_return_url') || '/app/admin/dashboard';
    localStorage.removeItem('admin_impersonation_data');
    localStorage.removeItem('admin_impersonation_return_url');
    router.push(returnUrl);
  };

  if (!isImpersonating || !impersonationData) {
    return null;
  }

  const expiresAt = impersonationData.expires_at ? new Date(impersonationData.expires_at) : null;
  const timeRemaining = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60)) : null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-yellow-500/50 bg-yellow-500/10 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="font-semibold">
              Mode Impersonation
            </Badge>
            <span className="text-sm text-foreground">
              Vous visualisez en tant que{' '}
              <strong>{impersonationData.target_email || impersonationData.target_user_id.slice(0, 8)}</strong>
            </span>
            {timeRemaining !== null && timeRemaining > 0 && (
              <span className="text-xs text-muted-foreground">
                (expire dans {timeRemaining} min)
              </span>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExit}
          className="bg-yellow-500/20 hover:bg-yellow-500/30"
        >
          <X className="h-4 w-4 mr-2" />
          Quitter l&apos;impersonation
        </Button>
      </div>
    </div>
  );
}


