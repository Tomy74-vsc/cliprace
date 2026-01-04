import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const Schema = z.object({
  rule_type: z.enum(['content', 'spam', 'duplicate', 'domain', 'flood']),
  config: z.record(z.any()).default({}),
});

type SubmissionRow = {
  id: string;
  created_at: string;
  title: string | null;
  external_url: string;
};

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function normalize(s: string) {
  return s.toLowerCase();
}

function matches(ruleType: string, config: Record<string, unknown>, row: SubmissionRow) {
  if (ruleType === 'domain') {
    const domains = toStringArray((config as any).domains);
    if (domains.length === 0) return false;
    const url = normalize(row.external_url);
    return domains.some((d) => url.includes(normalize(d)));
  }

  if (ruleType === 'spam') {
    const keywords = toStringArray((config as any).keywords);
    if (keywords.length === 0) return false;
    const hay = normalize(`${row.title ?? ''} ${row.external_url ?? ''}`);
    return keywords.some((k) => hay.includes(normalize(k)));
  }

  if (ruleType === 'content') {
    const contains = typeof (config as any).contains === 'string' ? (config as any).contains.trim() : '';
    const field = (config as any).field === 'external_url' ? 'external_url' : 'title';
    if (!contains) return false;
    const value = field === 'external_url' ? row.external_url : row.title ?? '';
    return normalize(value).includes(normalize(contains));
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminPermission('moderation.read');

    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Invalid payload', 400, parsed.error.flatten());
    }

    if (!['domain', 'spam', 'content'].includes(parsed.data.rule_type)) {
      return NextResponse.json({
        supported: false,
        message: 'Simulation non disponible pour ce type de règle.',
      });
    }

    const admin = getAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const maxRows = 5000;

    const { data, error } = await admin
      .from('submissions')
      .select('id, created_at, title, external_url')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(maxRows);

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load submissions for simulation', 500, error.message);
    }

    const rows = (data ?? []) as unknown as SubmissionRow[];
    const truncated = rows.length >= maxRows;

    const counts = new Map<string, number>();
    let matchedTotal = 0;
    for (const row of rows) {
      if (!matches(parsed.data.rule_type, parsed.data.config, row)) continue;
      matchedTotal += 1;
      const day = row.created_at.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push(d.toISOString().slice(0, 10));
    }

    return NextResponse.json({
      supported: true,
      scanned_total: rows.length,
      matched_total: matchedTotal,
      truncated,
      daily: days.map((date) => ({ date, matched: counts.get(date) ?? 0 })),
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

