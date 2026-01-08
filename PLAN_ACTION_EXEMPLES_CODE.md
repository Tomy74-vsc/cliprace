# Plan d'Action — Exemples de Code Concrets

Ce document complète le plan d'action principal avec des exemples de code prêts à l'emploi pour les étapes critiques.

---

## 🔴 PHASE 1 : SÉCURITÉ CRITIQUE

### Étape 1.1 : Script d'Audit CSRF

**Fichier** : `scripts/audit-csrf.ts`

```typescript
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

interface Issue {
  file: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  line: number;
}

async function getAllRouteFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllRouteFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function auditCSRF() {
  const apiDir = join(process.cwd(), 'src/app/api/admin');
  const files = await getAllRouteFiles(apiDir);
  const issues: Issue[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      
      // Vérifier si le fichier contient des mutations
      const hasPOST = /export\s+async\s+function\s+POST/.test(content);
      const hasPATCH = /export\s+async\s+function\s+PATCH/.test(content);
      const hasDELETE = /export\s+async\s+function\s+DELETE/.test(content);
      
      // Vérifier si CSRF est présent
      const hasCSRF = /assertCsrf/.test(content);
      
      if ((hasPOST || hasPATCH || hasDELETE) && !hasCSRF) {
        const lines = content.split('\n');
        let methodLine = -1;
        let method: 'POST' | 'PATCH' | 'DELETE' = 'POST';
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('export async function POST')) {
            methodLine = i + 1;
            method = 'POST';
            break;
          } else if (lines[i].includes('export async function PATCH')) {
            methodLine = i + 1;
            method = 'PATCH';
            break;
          } else if (lines[i].includes('export async function DELETE')) {
            methodLine = i + 1;
            method = 'DELETE';
            break;
          }
        }
        
        if (methodLine > 0) {
          issues.push({ file, method, line: methodLine });
        }
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }

  console.log('\n🔍 CSRF Audit Results\n');
  if (issues.length === 0) {
    console.log('✅ All routes are protected with CSRF');
  } else {
    console.log(`❌ Found ${issues.length} unprotected routes:\n`);
    issues.forEach(i => {
      console.log(`  📄 ${i.file}`);
      console.log(`     Method: ${i.method} at line ${i.line}\n`);
    });
  }
  
  return issues.length === 0 ? 0 : 1;
}

auditCSRF().then(exitCode => process.exit(exitCode));
```

**Ajouter dans `package.json`** :
```json
{
  "scripts": {
    "audit:csrf": "tsx scripts/audit-csrf.ts"
  }
}
```

---

### Étape 1.2 : Limite Globale par Admin

**Fichier** : `src/lib/admin/rate-limit.ts` (modifier)

```typescript
import { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { createError } from '@/lib/errors';

type AdminRateLimitOptions = {
  route: string;
  max?: number;
  windowMs?: number;
};

export async function enforceAdminRateLimit(
  req: NextRequest,
  options: AdminRateLimitOptions,
  userId?: string
) {
  // Limite globale par admin (si userId fourni)
  if (userId) {
    const globalKey = `admin:global:${userId}`;
    const globalOk = await rateLimit({
      key: globalKey,
      route: 'admin:global',
      windowMs: 60 * 60 * 1000, // 1 heure
      max: 1000, // 1000 requêtes/heure par admin
    });

    if (!globalOk) {
      throw createError(
        'RATE_LIMIT',
        'Too many requests (global limit: 1000/hour)',
        429
      );
    }
  }

  // Limite par route
  const ip = req.headers.get('x-forwarded-for') || (req as any).ip || 'unknown';
  const key = `${options.route}:${ip}`;
  const ok = await rateLimit({
    key,
    route: options.route,
    windowMs: options.windowMs ?? 60_000,
    max: options.max ?? 30,
  });

  if (!ok) {
    throw createError('RATE_LIMIT', 'Too many requests', 429);
  }
}
```

**Modifier `requireAdminPermission()` pour passer userId** :
```typescript
// src/lib/admin/rbac.ts
export async function requireAdminPermission(permission: string) {
  const user = await requireAdminUser();
  const access = await getAdminAccess(user.id);
  if (!hasAdminPermission(access, permission)) {
    throw createError('FORBIDDEN', 'Accès refusé', 403, { permission });
  }
  return { user, access }; // user contient user.id
}
```

**Utilisation dans routes** :
```typescript
export async function POST(req: NextRequest) {
  const { user } = await requireAdminPermission('contests.write');
  await enforceAdminRateLimit(
    req,
    { route: 'admin:contests:create', max: 10, windowMs: 60_000 },
    user.id // Passer userId pour limite globale
  );
  // ...
}
```

---

### Étape 1.3 : Helpers Audit Standardisés

**Fichier** : `src/lib/admin/audit.ts` (nouveau)

```typescript
import { getAdminClient } from '@/lib/admin/supabase';

export interface LogAdminActionParams {
  actorId: string;
  action: string;
  tableName: string;
  rowPk: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminAction(params: LogAdminActionParams) {
  const admin = getAdminClient();
  
  await admin.from('audit_logs').insert({
    actor_id: params.actorId,
    action: params.action,
    table_name: params.tableName,
    row_pk: params.rowPk,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
    ip: params.ip,
    user_agent: params.userAgent,
    metadata: params.metadata ?? null,
  });
}

export interface LogStatusChangeParams {
  tableName: string;
  rowId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function logStatusChange(params: LogStatusChangeParams) {
  const admin = getAdminClient();
  
  await admin.from('status_history').insert({
    table_name: params.tableName,
    row_id: params.rowId,
    old_status: params.oldStatus,
    new_status: params.newStatus,
    changed_by: params.changedBy,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  });
}

// Helper combiné pour actions avec changement de statut
export async function logAdminActionWithStatus(
  actionParams: LogAdminActionParams,
  statusParams: LogStatusChangeParams
) {
  await Promise.all([
    logAdminAction(actionParams),
    logStatusChange(statusParams),
  ]);
}
```

**Exemple d'utilisation** :
```typescript
// src/app/api/admin/cashouts/[id]/approve/route.ts
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user } = await requireAdminPermission('finance.write');
  // ... CSRF, rate limit, validation ...

  const { data: cashout } = await admin.from('cashouts').select('*').eq('id', id).single();
  
  // Mise à jour
  await admin.from('cashouts').update({ status: 'processing' }).eq('id', id);
  
  // Audit (version simplifiée avec helper)
  await logAdminActionWithStatus(
    {
      actorId: user.id,
      action: 'cashout_approve',
      tableName: 'cashouts',
      rowPk: id,
      oldValues: { status: cashout.status },
      newValues: { status: 'processing' },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
    {
      tableName: 'cashouts',
      rowId: id,
      oldStatus: cashout.status,
      newStatus: 'processing',
      changedBy: user.id,
      reason: 'Approved by admin',
    }
  );
}
```

---

### Étape 1.4 : Fonction SQL avec Transaction

**Fichier** : `db_refonte/51_admin_transactions.sql` (nouveau)

```sql
-- Fonction pour approbation cashout avec transaction
CREATE OR REPLACE FUNCTION admin_approve_cashout(
  p_cashout_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_cashout cashouts%ROWTYPE;
  v_available_cents bigint;
BEGIN
  -- Transaction implicite dans la fonction
  
  -- Verrouiller la ligne pour éviter race conditions
  SELECT * INTO v_cashout 
  FROM cashouts 
  WHERE id = p_cashout_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cashout not found: %', p_cashout_id;
  END IF;
  
  IF v_cashout.status != 'requested' AND v_cashout.status != 'failed' THEN
    RAISE EXCEPTION 'Cashout cannot be approved from status: %', v_cashout.status;
  END IF;
  
  -- Vérifier solde disponible
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_available_cents
  FROM contest_winnings
  WHERE creator_id = v_cashout.creator_id
    AND paid_at IS NULL;
  
  IF v_cashout.amount_cents > v_available_cents THEN
    RAISE EXCEPTION 'Insufficient balance: required %, available %', 
      v_cashout.amount_cents, v_available_cents;
  END IF;
  
  -- Mettre à jour cashout
  UPDATE cashouts 
  SET 
    status = 'processing',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('approved_by', p_actor_id)
  WHERE id = p_cashout_id;
  
  -- Audit log
  INSERT INTO audit_logs (
    actor_id, action, table_name, row_pk, 
    old_values, new_values
  ) VALUES (
    p_actor_id,
    'cashout_approve',
    'cashouts',
    p_cashout_id::text,
    jsonb_build_object('status', v_cashout.status),
    jsonb_build_object('status', 'processing')
  );
  
  -- Status history
  INSERT INTO status_history (
    table_name, row_id, old_status, new_status, 
    changed_by, reason
  ) VALUES (
    'cashouts',
    p_cashout_id,
    v_cashout.status,
    'processing',
    p_actor_id,
    p_reason
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'cashout_id', p_cashout_id,
    'old_status', v_cashout.status,
    'new_status', 'processing'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour création concours complète avec transaction
CREATE OR REPLACE FUNCTION admin_create_contest_complete(
  p_brand_id uuid,
  p_title text,
  p_slug text,
  p_brief_md text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_budget_cents bigint,
  p_currency text DEFAULT 'EUR',
  p_actor_id uuid,
  p_assets jsonb DEFAULT '[]'::jsonb,
  p_terms jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb AS $$
DECLARE
  v_contest_id uuid;
  v_asset jsonb;
  v_term jsonb;
BEGIN
  -- Validation
  IF p_start_at >= p_end_at THEN
    RAISE EXCEPTION 'Start date must be before end date';
  END IF;
  
  IF p_budget_cents <= 0 THEN
    RAISE EXCEPTION 'Budget must be greater than 0';
  END IF;
  
  -- Créer concours
  INSERT INTO contests (
    brand_id, title, slug, brief_md, 
    start_at, end_at, budget_cents, currency,
    status, created_at, updated_at
  ) VALUES (
    p_brand_id, p_title, p_slug, p_brief_md,
    p_start_at, p_end_at, p_budget_cents, p_currency,
    'draft', now(), now()
  ) RETURNING id INTO v_contest_id;
  
  -- Ajouter assets
  FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets)
  LOOP
    INSERT INTO contest_assets (
      contest_id, asset_type, url, metadata, created_at
    ) VALUES (
      v_contest_id,
      (v_asset->>'asset_type')::contest_asset_type,
      v_asset->>'url',
      v_asset->'metadata',
      now()
    );
  END LOOP;
  
  -- Ajouter terms
  FOR v_term IN SELECT * FROM jsonb_array_elements(p_terms)
  LOOP
    INSERT INTO contest_terms (
      contest_id, term_type, content, created_at
    ) VALUES (
      v_contest_id,
      (v_term->>'term_type')::contest_term_type,
      v_term->>'content',
      now()
    );
  END LOOP;
  
  -- Audit
  INSERT INTO audit_logs (
    actor_id, action, table_name, row_pk, new_values
  ) VALUES (
    p_actor_id,
    'contest_create',
    'contests',
    v_contest_id::text,
    jsonb_build_object('title', p_title, 'status', 'draft')
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'contest_id', v_contest_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Utilisation dans route** :
```typescript
// src/app/api/admin/contests/route.ts
export async function POST(req: NextRequest) {
  const { user } = await requireAdminPermission('contests.write');
  // ... CSRF, rate limit, validation ...
  
  const body = await req.json();
  
  // Utiliser fonction SQL avec transaction
  const { data, error } = await admin.rpc('admin_create_contest_complete', {
    p_brand_id: body.brand_id,
    p_title: body.title,
    p_slug: body.slug,
    // ... autres paramètres
    p_actor_id: user.id,
    p_assets: JSON.stringify(body.assets),
    p_terms: JSON.stringify(body.terms),
  });
  
  if (error) {
    throw createError('DATABASE_ERROR', 'Failed to create contest', 500, error.message);
  }
  
  return NextResponse.json({ ok: true, contest_id: data.contest_id });
}
```

---

## 🟠 PHASE 2 : LOGIQUE & VALIDATIONS

### Étape 2.1 : Validators Métier

**Fichier** : `src/lib/admin/validators.ts` (nouveau)

```typescript
import { getAdminClient } from '@/lib/admin/supabase';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const contestValidators = {
  canPublish: async (contestId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: contest, error } = await admin
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();
    
    if (error || !contest) {
      return { valid: false, errors: ['Contest not found'] };
    }
    
    // Validation budget
    if (contest.budget_cents <= 0) {
      errors.push('Budget must be greater than 0');
    }
    
    // Validation dates
    if (new Date(contest.start_at) >= new Date(contest.end_at)) {
      errors.push('Start date must be before end date');
    }
    
    if (new Date(contest.end_at) < new Date()) {
      errors.push('End date must be in the future');
    }
    
    // Validation assets
    const { data: assets } = await admin
      .from('contest_assets')
      .select('id')
      .eq('contest_id', contestId);
    
    if (!assets || assets.length === 0) {
      errors.push('At least one asset is required');
    }
    
    // Validation terms
    const { data: terms } = await admin
      .from('contest_terms')
      .select('id')
      .eq('contest_id', contestId);
    
    if (!terms || terms.length === 0) {
      errors.push('At least one term is required');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const cashoutValidators = {
  canApprove: async (cashoutId: string): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    const { data: cashout, error } = await admin
      .from('cashouts')
      .select('*')
      .eq('id', cashoutId)
      .single();
    
    if (error || !cashout) {
      return { valid: false, errors: ['Cashout not found'] };
    }
    
    // Validation statut
    if (!['requested', 'failed'].includes(cashout.status)) {
      errors.push(`Cashout cannot be approved from status: ${cashout.status}`);
    }
    
    // Validation solde
    const { data: winnings } = await admin
      .from('contest_winnings')
      .select('amount_cents')
      .eq('creator_id', cashout.creator_id)
      .is('paid_at', null);
    
    const available = (winnings ?? []).reduce((sum, w) => sum + Number(w.amount_cents), 0);
    
    if (cashout.amount_cents > available) {
      errors.push(
        `Insufficient balance: required ${cashout.amount_cents / 100}€, ` +
        `available ${available / 100}€`
      );
    }
    
    // Validation minimum
    const MIN_CASHOUT = 1000; // 10€ en centimes
    if (cashout.amount_cents < MIN_CASHOUT) {
      errors.push(`Minimum cashout amount is ${MIN_CASHOUT / 100}€`);
    }
    
    // Validation KYC
    const { data: kyc } = await admin
      .from('kyc_checks')
      .select('status')
      .eq('user_id', cashout.creator_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!kyc || kyc.status !== 'verified') {
      errors.push('KYC verification required');
    }
    
    return { valid: errors.length === 0, errors };
  },
};

export const userValidators = {
  canChangeRole: async (
    userId: string,
    newRole: 'admin' | 'brand' | 'creator',
    actorId: string
  ): Promise<ValidationResult> => {
    const admin = getAdminClient();
    const errors: string[] = [];
    
    // Vérifier que l'acteur est super-admin pour changer vers admin
    if (newRole === 'admin') {
      const { data: actor } = await admin
        .from('admin_staff')
        .select('is_super_admin')
        .eq('user_id', actorId)
        .single();
      
      if (!actor || !actor.is_super_admin) {
        errors.push('Only super-admins can assign admin role');
      }
    }
    
    // Vérifier que l'utilisateur existe
    const { data: user } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return { valid: false, errors: ['User not found'] };
    }
    
    // Validation métier : ne pas changer le rôle de soi-même vers non-admin
    if (userId === actorId && newRole !== 'admin') {
      errors.push('Cannot change your own role to non-admin');
    }
    
    return { valid: errors.length === 0, errors };
  },
};
```

**Utilisation dans route** :
```typescript
// src/app/api/admin/contests/[id]/publish/route.ts
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { user } = await requireAdminPermission('contests.write');
  // ... CSRF, rate limit ...
  
  // Validation métier
  const validation = await contestValidators.canPublish(id);
  if (!validation.valid) {
    throw createError(
      'VALIDATION_ERROR',
      'Cannot publish contest',
      400,
      { errors: validation.errors }
    );
  }
  
  // Continuer avec publication
  // ...
}
```

---

## 🟡 PHASE 3 : PUISSANCE & ACTIONS

### Étape 3.1 : Actions Bulk

**Fichier** : `src/app/api/admin/submissions/bulk/route.ts` (nouveau)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { createError, formatErrorResponse } from '@/lib/errors';
import { getAdminClient } from '@/lib/admin/supabase';

const BulkActionSchema = z.object({
  submission_ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['approve', 'reject', 'ban']),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission('submissions.write');
    await enforceAdminRateLimit(req, { 
      route: 'admin:submissions:bulk', 
      max: 10, 
      windowMs: 60_000 
    }, user.id);
    
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }
    
    const body = await req.json();
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }
    
    const { submission_ids, action, reason } = parsed.data;
    const admin = getAdminClient();
    
    // Déterminer nouveau statut
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      ban: 'banned',
    };
    const newStatus = statusMap[action];
    
    // Mise à jour en batch
    const { data: updated, error: updateError } = await admin
      .from('submissions')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .in('id', submission_ids)
      .select('id, status');
    
    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update submissions', 500, updateError.message);
    }
    
    // Audit log
    await logAdminAction({
      actorId: user.id,
      action: `submissions_bulk_${action}`,
      tableName: 'submissions',
      rowPk: submission_ids.join(','),
      oldValues: { count: submission_ids.length },
      newValues: { 
        action,
        status: newStatus,
        count: updated?.length ?? 0,
        reason,
      },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
    
    // Notifications (optionnel)
    // await notifyBulkAction(submission_ids, action, reason);
    
    return NextResponse.json({ 
      ok: true, 
      updated_count: updated?.length ?? 0,
      submission_ids: updated?.map(s => s.id) ?? [],
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
```

**Composant UI** : `src/components/admin/admin-bulk-actions.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface BulkActionsProps {
  selectedIds: Set<string>;
  onActionComplete: () => void;
}

export function AdminBulkActions({ selectedIds, onActionComplete }: BulkActionsProps) {
  const [action, setAction] = useState<'approve' | 'reject' | 'ban' | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  
  const handleBulkAction = async (actionType: 'approve' | 'reject' | 'ban') => {
    setAction(actionType);
  };
  
  const confirmAction = async () => {
    if (!action || selectedIds.size === 0) return;
    
    setLoading(true);
    try {
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf='))
        ?.split('=')[1];
      
      const res = await fetch('/api/admin/submissions/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({
          submission_ids: Array.from(selectedIds),
          action,
          reason: reason || undefined,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Action failed');
      }
      
      onActionComplete();
      setAction(null);
      setReason('');
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Erreur lors de l\'action bulk');
    } finally {
      setLoading(false);
    }
  };
  
  if (selectedIds.size === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">
        {selectedIds.size} élément(s) sélectionné(s)
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleBulkAction('approve')}
        >
          Approuver
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleBulkAction('reject')}
        >
          Rejeter
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleBulkAction('ban')}
        >
          Bannir
        </Button>
      </div>
      
      <AlertDialog open={action !== null} onOpenChange={() => setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === 'approve' && 'Approuver les soumissions'}
              {action === 'reject' && 'Rejeter les soumissions'}
              {action === 'ban' && 'Bannir les soumissions'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action affectera {selectedIds.size} soumission(s).
              {action === 'reject' || action === 'ban' ? ' Raison (optionnelle) :' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(action === 'reject' || action === 'ban') && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison de l'action..."
              className="w-full p-2 border rounded"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={loading}>
              {loading ? 'Traitement...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

## 📝 NOTES IMPORTANTES

1. **Tests** : Chaque étape doit être accompagnée de tests unitaires et d'intégration
2. **Documentation** : Mettre à jour la documentation à chaque étape
3. **Migration** : Les fonctions SQL doivent être ajoutées dans `db_refonte/` et exécutées
4. **Review** : Chaque modification doit être revue avant merge

---

**Document créé le** : 2024  
**Version** : 1.0

