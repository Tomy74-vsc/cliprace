'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Bannière read-only affichée en haut de l'interface admin
 * quand le mode read-only est activé
 */
export function AdminReadOnlyBanner() {
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    const checkReadOnly = async () => {
      try {
        const res = await fetch('/api/admin/settings/admin_read_only');
        if (res.ok) {
          const data = await res.json();
          setReadOnly(data.value === true || data.value === 'true');
        }
      } catch {
        // Ignore errors
      }
    };

    void checkReadOnly();
    const interval = setInterval(checkReadOnly, 30_000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  if (!readOnly) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full border-b border-orange-500/50 bg-orange-500/10 backdrop-blur-sm">
      <div className="flex items-center justify-center px-4 py-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-500" />
          <Badge variant="warning" className="font-semibold">
            Mode Maintenance
          </Badge>
          <span className="text-sm text-foreground">
            Le système est en mode read-only. Toutes les modifications sont bloquées.
          </span>
        </div>
      </div>
    </div>
  );
}

