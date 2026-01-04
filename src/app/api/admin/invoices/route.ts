import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  status: z.string().optional(),
  org_id: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  page: z.coerce.number().min(1).default(1),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission('invoices.read');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const query = parsed.success ? parsed.data : QuerySchema.parse({});
    const limit = query.limit;
    const from = (query.page - 1) * limit;
    const to = from + limit - 1;

    const admin = getAdminClient();
    let invoicesQuery = admin
      .from('invoices')
      .select(
        'id, org_id, stripe_invoice_id, amount_cents, currency, vat_rate, pdf_url, status, issued_at, created_at, org:orgs(id, name, billing_email)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      invoicesQuery = invoicesQuery.eq('status', query.status);
    }
    if (query.org_id) {
      invoicesQuery = invoicesQuery.eq('org_id', query.org_id);
    }
    if (query.q) {
      const trimmed = query.q.trim();
      if (uuidPattern.test(trimmed)) {
        invoicesQuery = invoicesQuery.eq('id', trimmed);
      } else {
        invoicesQuery = invoicesQuery.ilike('stripe_invoice_id', `%${trimmed}%`);
      }
    }

    const { data: invoices, error, count } = await invoicesQuery;
    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load invoices', 500, error.message);
    }

    const items = (invoices ?? []).map((invoice) => ({
      ...invoice,
      amount_cents: Number(invoice.amount_cents ?? 0),
      vat_rate: invoice.vat_rate === null ? null : Number(invoice.vat_rate),
    }));

    return NextResponse.json({
      items,
      pagination: {
        total: count ?? 0,
        page: query.page,
        limit,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
