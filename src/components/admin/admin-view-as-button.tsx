'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminImpersonationModal } from './admin-impersonation-modal';

interface AdminViewAsButtonProps {
  userId: string;
  targetRole: 'brand' | 'creator';
}

export function AdminViewAsButton({ userId, targetRole }: AdminViewAsButtonProps) {
  const [open, setOpen] = useState(false);
  const roleLabel = targetRole === 'brand' ? 'marque' : 'créateur';

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
      >
        Voir en tant que {roleLabel}
      </Button>
      <AdminImpersonationModal
        userId={userId}
        role={targetRole}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

