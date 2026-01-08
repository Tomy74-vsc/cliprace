# Plan d'Action Concret - Corrections Interface Admin

**Date** : 2024  
**Objectif** : Corriger tous les problèmes identifiés dans `ANALYSE_COMPLETE_PROBLEMES_INTERFACE_ADMIN.md`

---

## 🔴 PHASE 1 : CONNEXIONS ENTRE INTERFACES (Semaine 1-2)

### 1.1 Intégrer AdminViewAsButton dans les pages

#### Fichier : `src/app/app/admin/users/[id]/page.tsx`

**Ajouter après ligne 157** (dans `actions` de `AdminPageHeader`) :

```tsx
import { AdminViewAsButton } from '@/components/admin/admin-view-as-button';

// Dans le JSX, modifier la section actions :
actions={
  <div className="flex items-center gap-2">
    {profile.role === 'brand' && (
      <AdminViewAsButton userId={profile.id} role="brand" />
    )}
    {profile.role === 'creator' && (
      <AdminViewAsButton userId={profile.id} role="creator" />
    )}
    <AdminUserActions 
      userId={profile.id} 
      role={profile.role} 
      isActive={profile.is_active} 
      canWrite={canWrite} 
    />
  </div>
}
```

#### Fichier : `src/app/app/admin/contests/[id]/page.tsx`

**Ajouter après ligne 156** (dans `actions` de `AdminPageHeader`) :

```tsx
import { AdminViewAsButton } from '@/components/admin/admin-view-as-button';

// Dans le JSX, modifier la section actions :
actions={
  <div className="flex items-center gap-2">
    {data.contest.brand_id && (
      <AdminViewAsButton userId={data.contest.brand_id} role="brand" />
    )}
    <AdminContestActions
      contestId={data.contest.id}
      status={data.contest.status as 'draft' | 'active' | 'paused' | 'ended' | 'archived'}
      canWrite={canWrite}
    />
  </div>
}
```

---

### 1.2 Créer Modal d'Impersonation Professionnel

#### Nouveau fichier : `src/components/admin/admin-impersonation-modal.tsx`

```tsx
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
import { Slider } from '@/components/ui/slider';
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
  const [ttlMinutes, setTtlMinutes] = useState([15]);

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
          ttl_minutes: ttlMinutes[0],
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
            Vous allez être redirigé vers l'interface {roleLabel} de cet utilisateur.
            Cette action sera enregistrée dans les logs d'audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Raison de l'impersonation *</Label>
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
            <Select value={reasonCode} onValueChange={(v: any) => setReasonCode(v)}>
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
            <Label htmlFor="ttl">Durée de validité : {ttlMinutes[0]} minutes</Label>
            <Slider
              id="ttl"
              min={1}
              max={60}
              step={1}
              value={ttlMinutes}
              onValueChange={setTtlMinutes}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 min</span>
              <span>60 min</span>
            </div>
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
```

#### Modifier : `src/components/admin/admin-view-as-button.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminImpersonationModal } from './admin-impersonation-modal';

interface AdminViewAsButtonProps {
  userId: string;
  role: 'brand' | 'creator';
}

export function AdminViewAsButton({ userId, role }: AdminViewAsButtonProps) {
  const [open, setOpen] = useState(false);
  const roleLabel = role === 'brand' ? 'marque' : 'créateur';

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
        role={role}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

---

### 1.3 Créer Bannière de Retour Admin

#### Nouveau fichier : `src/components/admin/admin-impersonation-banner.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ImpersonationData {
  target_user_id: string;
  target_email: string;
  expires_at: string;
}

export function AdminImpersonationBanner() {
  const router = useRouter();
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    const data = localStorage.getItem('admin_impersonation_data');
    const url = localStorage.getItem('admin_impersonation_return_url');
    if (data) {
      try {
        const parsed = JSON.parse(data) as ImpersonationData;
        // Vérifier expiration
        if (new Date(parsed.expires_at) > new Date()) {
          setImpersonationData(parsed);
          setReturnUrl(url);
        } else {
          // Expiré, nettoyer
          localStorage.removeItem('admin_impersonation_data');
          localStorage.removeItem('admin_impersonation_return_url');
        }
      } catch {
        // Données invalides, nettoyer
        localStorage.removeItem('admin_impersonation_data');
        localStorage.removeItem('admin_impersonation_return_url');
      }
    }
  }, []);

  const handleReturn = () => {
    if (returnUrl) {
      // Nettoyer localStorage
      localStorage.removeItem('admin_impersonation_data');
      localStorage.removeItem('admin_impersonation_return_url');
      // Rediriger vers admin
      router.push(returnUrl || '/app/admin/dashboard');
    }
  };

  const handleDismiss = () => {
    localStorage.removeItem('admin_impersonation_data');
    localStorage.removeItem('admin_impersonation_return_url');
    setImpersonationData(null);
    setReturnUrl(null);
  };

  if (!impersonationData) return null;

  return (
    <Alert className="border-warning bg-warning/10 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <AlertDescription>
            Vous visualisez l'interface en tant que <strong>{impersonationData.target_email}</strong>
            {returnUrl && (
              <>
                {' '}
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary underline"
                  onClick={handleReturn}
                >
                  Retour à l'admin
                </Button>
              </>
            )}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
```

#### Modifier : `src/app/app/brand/layout.tsx`

**Ajouter en haut du contenu** :

```tsx
import { AdminImpersonationBanner } from '@/components/admin/admin-impersonation-banner';

// Dans le JSX, ajouter après l'ouverture de <main> :
<main>
  <AdminImpersonationBanner />
  {/* ... reste du contenu ... */}
</main>
```

#### Modifier : `src/app/app/creator/layout.tsx`

**Même modification que pour brand**

---

### 1.4 Implémenter Supabase Realtime

#### Modifier : `src/components/admin/admin-inbox-provider.tsx`

**Remplacer le polling par Realtime** :

```tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AdminInboxSummary } from './admin-inbox-dropdown';

// ... types existants ...

export function AdminInboxProvider({
  children,
  initialSummary,
}: {
  children: ReactNode;
  initialSummary?: AdminInboxSummary | null;
}) {
  const [summary, setSummary] = useState<AdminInboxSummary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/inbox/summary', { cache: 'no-store' });
      if (!res.ok) throw new Error("Impossible de charger l'inbox admin.");
      const data = (await res.json()) as AdminInboxSummary;
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSummary) return;
    void refresh();
  }, [initialSummary, refresh]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin_inbox_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_tasks',
          filter: 'status=eq.pending',
        },
        () => {
          // Rafraîchir quand une tâche change
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cashouts',
          filter: 'status=eq.requested',
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: 'status=eq.pending',
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const value = useMemo<AdminInboxContextValue>(
    () => ({ summary, loading, error, refresh }),
    [summary, loading, error, refresh]
  );

  return <AdminInboxContext.Provider value={value}>{children}</AdminInboxContext.Provider>;
}
```

---

## 🟠 PHASE 2 : SÉCURITÉ & LOGIQUE (Semaine 3-4)

### 2.1 Créer RPC Function pour Publication Concours

#### Nouveau fichier : `db_refonte/55_admin_contest_transactions.sql`

```sql
-- Fonction SQL avec transaction pour publication concours
CREATE OR REPLACE FUNCTION admin_publish_contest(
  p_contest_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_contest contests%ROWTYPE;
  v_brand_id uuid;
BEGIN
  -- Transaction implicite dans la fonction
  
  -- Verrouiller la ligne
  SELECT * INTO v_contest 
  FROM contests 
  WHERE id = p_contest_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contest not found: %', p_contest_id;
  END IF;
  
  IF v_contest.status != 'draft' THEN
    RAISE EXCEPTION 'Contest cannot be published from status: %', v_contest.status;
  END IF;
  
  -- Vérifier que start_at < end_at
  IF v_contest.start_at >= v_contest.end_at THEN
    RAISE EXCEPTION 'Invalid dates: start_at must be before end_at';
  END IF;
  
  -- Vérifier que budget est suffisant
  IF v_contest.budget_cents <= 0 THEN
    RAISE EXCEPTION 'Budget must be greater than 0';
  END IF;
  
  v_brand_id := v_contest.brand_id;
  
  -- Mettre à jour concours
  UPDATE contests 
  SET 
    status = 'active',
    updated_at = now()
  WHERE id = p_contest_id;
  
  -- Status history
  INSERT INTO status_history (
    table_name, row_id, old_status, new_status, 
    changed_by, reason
  ) VALUES (
    'contests',
    p_contest_id,
    'draft',
    'active',
    p_actor_id,
    p_reason
  );
  
  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, table_name, row_pk, 
    old_values, new_values
  ) VALUES (
    p_actor_id,
    'contest_publish',
    'contests',
    p_contest_id::text,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'active')
  );
  
  -- Notification brand (si brand_id existe)
  IF v_brand_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, type, content, read
    ) VALUES (
      v_brand_id,
      'contest_published',
      jsonb_build_object(
        'contest_id', p_contest_id,
        'contest_title', v_contest.title,
        'created_by_admin', true
      ),
      false
    );
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'contest_id', p_contest_id,
    'status', 'active'
  );
END;
$$ LANGUAGE plpgsql;
```

#### Modifier : `src/app/api/admin/contests/[id]/publish/route.ts`

**Utiliser la RPC function** :

```tsx
// Remplacer la logique manuelle par :
const { data: result, error: rpcError } = await admin.rpc('admin_publish_contest', {
  p_contest_id: id,
  p_actor_id: actor.id,
  p_reason: reason || null,
});

if (rpcError) {
  throw createError('DATABASE_ERROR', 'Failed to publish contest', 500, rpcError.message);
}
```

---

### 2.2 Compléter Notifications Manquantes

#### Modifier : `src/app/api/admin/contests/[id]/end/route.ts`

**Ajouter notification** :

```tsx
import { notifyAdminAction } from '@/lib/admin/notifications';

// Après la mise à jour du statut :
if (data.contest.brand_id) {
  await notifyAdminAction({
    userId: data.contest.brand_id,
    type: 'contest_ended',
    data: {
      contest_id: id,
      contest_title: data.contest.title,
    },
  });
}
```

#### Modifier : `src/app/api/admin/contests/[id]/archive/route.ts`

**Ajouter notification** :

```tsx
import { notifyAdminAction } from '@/lib/admin/notifications';

// Après la mise à jour du statut :
if (data.contest.brand_id) {
  await notifyAdminAction({
    userId: data.contest.brand_id,
    type: 'contest_archived',
    data: {
      contest_id: id,
      contest_title: data.contest.title,
    },
  });
}
```

---

## 🟡 PHASE 3 : PERFORMANCE (Semaine 5-6)

### 3.1 Implémenter Cache Redis

#### Nouveau fichier : `src/lib/admin/cache-redis.ts`

```tsx
import { Redis } from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (process.env.REDIS_URL && !redis) {
    redis = new Redis(process.env.REDIS_URL);
  }
  return redis;
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const redis = getRedis();
  
  // Si Redis non disponible, utiliser cache mémoire
  if (!redis) {
    const { getCached: getMemoryCached } = await import('./cache');
    return getMemoryCached(key, fetcher, ttlSeconds);
  }
  
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    
    const data = await fetcher();
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Redis error, falling back to fetcher:', error);
    return fetcher();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis invalidation error:', error);
  }
}
```

---

## ✅ CHECKLIST DE VALIDATION

### Phase 1 : Connexions
- [ ] AdminViewAsButton intégré dans users/[id]/page.tsx
- [ ] AdminViewAsButton intégré dans contests/[id]/page.tsx
- [ ] AdminImpersonationModal créé et fonctionnel
- [ ] AdminImpersonationBanner créé et intégré dans layouts brand/creator
- [ ] Realtime implémenté pour inbox

### Phase 2 : Sécurité & Logique
- [ ] RPC admin_publish_contest créé
- [ ] Route publish utilise RPC
- [ ] Notifications contest_ended ajoutées
- [ ] Notifications contest_archived ajoutées

### Phase 3 : Performance
- [ ] Cache Redis implémenté
- [ ] Fallback cache mémoire si Redis indisponible
- [ ] Invalidation cache après mutations

---

**Document créé le** : 2024  
**Version** : 1.0

