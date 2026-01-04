import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

const RuleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  rule_type: z.enum(['content', 'spam', 'duplicate', 'domain', 'flood']),
  config: z.record(z.any()).default({}),
  status: z.enum(['draft', 'published']).optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdminPermission('moderation.read');
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('moderation_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load moderation rules', 500, error.message);
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminPermission('moderation.write');
    await enforceAdminRateLimit(req, { route: 'admin:moderation:rules:create', max: 30, windowMs: 60_000 });
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    const body = await req.json();
    const parsed = RuleSchema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();

    const desiredStatus = parsed.data.status ?? 'published';
    const desiredIsActive =
      desiredStatus === 'draft' ? false : (parsed.data.is_active ?? true);

    const baseInsert = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      rule_type: parsed.data.rule_type,
      config: parsed.data.config ?? {},
      is_active: desiredIsActive,
    } as Record<string, unknown>;

    const insertWithStatus = { ...baseInsert, status: desiredStatus };

    const tryInsert = async (payload: Record<string, unknown>) =>
      admin.from('moderation_rules').insert(payload).select('*').single();

    let insertRes = await tryInsert(insertWithStatus);
    if (insertRes.error && insertRes.error.message?.includes('column \"status\"')) {
      insertRes = await tryInsert(baseInsert);
    }

    const { data, error } = insertRes;

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to create rule', 500, error.message);
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
