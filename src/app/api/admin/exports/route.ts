import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasAdminPermission, requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

const QuerySchema = z.object({
  type: z.enum([
    'users',
    'brands',
    'orgs',
    'contests',
    'submissions',
    'payments_brand',
    'invoices',
    'platform_accounts',
    'ingestion_jobs',
    'ingestion_errors',
    'webhook_endpoints',
    'webhook_deliveries',
    'kyc_checks',
    'risk_flags',
    'assets',
  ]),
  q: z.string().optional(),
  limit: z.coerce.number().min(1).max(50_000).default(5_000),
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const needsQuotes = raw.includes(',') || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { access } = await requireAdminPermission('exports.write');
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Paramètres invalides', 400, parsed.error.flatten());
    }

    const admin = getAdminClient();
    const query = parsed.data;

    const requiredPermissions: Record<string, string | string[]> = {
      users: 'users.read',
      brands: 'brands.read',
      orgs: [
        'invoices.read',
        'finance.read',
        'integrations.read',
        'brands.read',
        'support.read',
        'crm.read',
        'audit.read',
      ],
      contests: 'contests.read',
      submissions: 'submissions.read',
      payments_brand: 'finance.read',
      invoices: 'invoices.read',
      platform_accounts: 'ingestion.read',
      ingestion_jobs: 'ingestion.read',
      ingestion_errors: 'ingestion.read',
      webhook_endpoints: 'integrations.read',
      webhook_deliveries: 'integrations.read',
      kyc_checks: 'risk.read',
      risk_flags: 'risk.read',
      assets: 'taxonomy.read',
    };

    const required = requiredPermissions[query.type];
    const allowed = Array.isArray(required)
      ? required.some((permission) => hasAdminPermission(access, permission))
      : hasAdminPermission(access, required);

    if (!allowed) {
      throw createError('FORBIDDEN', 'Accès refusé', 403, { type: query.type });
    }

    const rawQ = query.q ? query.q.trim() : '';
    const likePattern = rawQ ? `%${rawQ}%` : '';
    const like = rawQ ? likePattern : null;
    const qIsUuid = rawQ ? uuidPattern.test(rawQ) : false;
    const qIsNumber = rawQ ? /^[0-9]+$/.test(rawQ) : false;

    if (query.type === 'users') {
      let q = admin
        .from('profiles')
        .select('id, email, display_name, role, is_active, onboarding_complete, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.eq('id', rawQ) : q.or(`email.ilike.${like},display_name.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export utilisateurs impossible', 500, error.message);
      const headers = ['id', 'email', 'display_name', 'role', 'is_active', 'onboarding_complete', 'created_at', 'updated_at'];
      const csv = toCsv(
        headers,
        (data ?? []).map((row) => [
          row.id,
          row.email,
          row.display_name,
          row.role,
          row.is_active,
          row.onboarding_complete,
          row.created_at,
          row.updated_at,
        ])
      );
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="users.csv"',
        },
      });
    }

    if (query.type === 'brands') {
      let q = admin
        .from('profile_brands')
        .select('user_id, company_name, website, industry, vat_number, created_at, updated_at, profile:profiles(id, email, display_name, is_active, onboarding_complete)')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) q = q.or(`company_name.ilike.${like},website.ilike.${like}`);
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export marques impossible', 500, error.message);

      const headers = ['user_id', 'email', 'display_name', 'company_name', 'website', 'industry', 'vat_number', 'is_active', 'onboarding_complete', 'created_at', 'updated_at'];
      const csv = toCsv(
        headers,
        (data ?? []).map((row: any) => {
          const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          return [
            row.user_id,
            profile?.email ?? '',
            profile?.display_name ?? '',
            row.company_name,
            row.website,
            row.industry,
            row.vat_number,
            profile?.is_active ?? '',
            profile?.onboarding_complete ?? '',
            row.created_at,
            row.updated_at,
          ];
        })
      );
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="brands.csv"',
        },
      });
    }

    if (query.type === 'orgs') {
      let q = admin
        .from('orgs')
        .select('id, name, billing_email, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.eq('id', rawQ) : q.or(`name.ilike.${like},billing_email.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export organisations impossible', 500, error.message);
      const headers = ['id', 'name', 'billing_email', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row) => [row.id, row.name, row.billing_email, row.created_at, row.updated_at]));
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="orgs.csv"',
        },
      });
    }

    if (query.type === 'contests') {
      let q = admin
        .from('contests')
        .select('id, title, slug, status, brand_id, org_id, start_at, end_at, prize_pool_cents, budget_cents, currency, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.eq('id', rawQ) : q.or(`title.ilike.${like},slug.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export concours impossible', 500, error.message);
      const headers = ['id', 'title', 'slug', 'status', 'brand_id', 'org_id', 'start_at', 'end_at', 'prize_pool_cents', 'budget_cents', 'currency', 'created_at', 'updated_at'];
      const csv = toCsv(
        headers,
        (data ?? []).map((row) => [
          row.id,
          row.title,
          row.slug,
          row.status,
          row.brand_id,
          row.org_id,
          row.start_at,
          row.end_at,
          row.prize_pool_cents,
          row.budget_cents,
          row.currency,
          row.created_at,
          row.updated_at,
        ])
      );
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="contests.csv"',
        },
      });
    }

    if (query.type === 'submissions') {
      let q = admin
        .from('submissions')
        .select('id, contest_id, creator_id, platform, external_url, status, rejection_reason, submitted_at, approved_at, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid
          ? q.or(`id.eq.${rawQ},contest_id.eq.${rawQ},creator_id.eq.${rawQ}`)
          : q.or(`external_url.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export soumissions impossible', 500, error.message);
      const headers = ['id', 'contest_id', 'creator_id', 'platform', 'external_url', 'status', 'rejection_reason', 'submitted_at', 'approved_at', 'created_at', 'updated_at'];
      const csv = toCsv(
        headers,
        (data ?? []).map((row) => [
          row.id,
          row.contest_id,
          row.creator_id,
          row.platform,
          row.external_url,
          row.status,
          row.rejection_reason,
          row.submitted_at,
          row.approved_at,
          row.created_at,
          row.updated_at,
        ])
      );
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="submissions.csv"',
        },
      });
    }

    if (query.type === 'payments_brand') {
      let q = admin
        .from('payments_brand')
        .select('id, brand_id, contest_id, amount_cents, currency, status, stripe_payment_intent_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid
          ? q.or(`id.eq.${rawQ},brand_id.eq.${rawQ},contest_id.eq.${rawQ}`)
          : q.or(`stripe_payment_intent_id.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export paiements marques impossible', 500, error.message);
      const headers = ['id', 'brand_id', 'contest_id', 'amount_cents', 'currency', 'status', 'stripe_payment_intent_id', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row) => [row.id, row.brand_id, row.contest_id, row.amount_cents, row.currency, row.status, row.stripe_payment_intent_id, row.created_at, row.updated_at]));
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="payments_brand.csv"',
        },
      });
    }

    if (query.type === 'invoices') {
      let q = admin
        .from('invoices')
        .select('id, org_id, stripe_invoice_id, amount_cents, currency, vat_rate, status, issued_at, pdf_url, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.or(`id.eq.${rawQ},org_id.eq.${rawQ}`) : q.or(`stripe_invoice_id.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export factures impossible', 500, error.message);
      const headers = ['id', 'org_id', 'stripe_invoice_id', 'amount_cents', 'currency', 'vat_rate', 'status', 'issued_at', 'pdf_url', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row) => [row.id, row.org_id, row.stripe_invoice_id, row.amount_cents, row.currency, row.vat_rate, row.status, row.issued_at, row.pdf_url, row.created_at, row.updated_at]));
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="invoices.csv"',
        },
      });
    }

    if (query.type === 'platform_accounts') {
      let q = admin
        .from('platform_accounts')
        .select('id, user_id, platform, handle, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.or(`id.eq.${rawQ},user_id.eq.${rawQ}`) : q.or(`handle.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export comptes plateformes impossible', 500, error.message);
      const headers = ['id', 'user_id', 'platform', 'handle', 'status', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row) => [row.id, row.user_id, row.platform, row.handle, row.status, row.created_at, row.updated_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="platform_accounts.csv"' } });
    }

    if (query.type === 'ingestion_jobs') {
      let q = admin
        .from('ingestion_jobs')
        .select('id, account_id, kind, status, started_at, finished_at, created_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsNumber) q = q.eq('id', Number(rawQ));
        else q = q.or(`account_id.ilike.${likePattern},kind.ilike.${likePattern},status.ilike.${likePattern}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export jobs ingestion impossible', 500, error.message);
      const headers = ['id', 'account_id', 'kind', 'status', 'started_at', 'finished_at', 'created_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.account_id, row.kind, row.status, row.started_at, row.finished_at, row.created_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="ingestion_jobs.csv"' } });
    }

    if (query.type === 'ingestion_errors') {
      let q = admin
        .from('ingestion_errors')
        .select('id, job_id, error_code, details, created_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsNumber) q = q.or(`id.eq.${Number(rawQ)},job_id.eq.${Number(rawQ)}`);
        else q = q.ilike('error_code', likePattern);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export erreurs ingestion impossible', 500, error.message);
      const headers = ['id', 'job_id', 'error_code', 'details', 'created_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.job_id, row.error_code, row.details, row.created_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="ingestion_errors.csv"' } });
    }

    if (query.type === 'webhook_endpoints') {
      let q = admin
        .from('webhook_endpoints')
        .select('id, org_id, endpoint_url, secret_hash, active, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (like) {
        q = qIsUuid ? q.or(`id.eq.${rawQ},org_id.eq.${rawQ}`) : q.ilike('endpoint_url', like);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export endpoints webhooks impossible', 500, error.message);
      const headers = ['id', 'org_id', 'endpoint_url', 'secret_hash', 'active', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row) => [row.id, row.org_id, row.endpoint_url, row.secret_hash, row.active, row.created_at, row.updated_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="webhook_endpoints.csv"' } });
    }

    if (query.type === 'webhook_deliveries') {
      let q = admin
        .from('webhook_deliveries')
        .select('id, endpoint_id, event, status, retry_count, last_error, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsNumber) q = q.eq('id', Number(rawQ));
        else if (qIsUuid) q = q.eq('endpoint_id', rawQ);
        else q = q.or(`event.ilike.${likePattern},status.ilike.${likePattern},last_error.ilike.${likePattern}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export livraisons webhooks impossible', 500, error.message);
      const headers = ['id', 'endpoint_id', 'event', 'status', 'retry_count', 'last_error', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.endpoint_id, row.event, row.status, row.retry_count, row.last_error, row.created_at, row.updated_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="webhook_deliveries.csv"' } });
    }

    if (query.type === 'kyc_checks') {
      let q = admin
        .from('kyc_checks')
        .select('id, user_id, provider, status, reason, reviewed_at, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsUuid) q = q.eq('user_id', rawQ);
        else q = q.or(`provider.ilike.${likePattern},status.ilike.${likePattern},reason.ilike.${likePattern}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export KYC impossible', 500, error.message);
      const headers = ['id', 'user_id', 'provider', 'status', 'reason', 'reviewed_at', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.user_id, row.provider, row.status, row.reason, row.reviewed_at, row.created_at, row.updated_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="kyc_checks.csv"' } });
    }

    if (query.type === 'risk_flags') {
      let q = admin
        .from('risk_flags')
        .select('id, user_id, reason, severity, resolved_at, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsUuid) q = q.eq('user_id', rawQ);
        else q = q.or(`reason.ilike.${likePattern},severity.ilike.${likePattern}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export signaux de risque impossible', 500, error.message);
      const headers = ['id', 'user_id', 'reason', 'severity', 'resolved_at', 'created_at', 'updated_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.user_id, row.reason, row.severity, row.resolved_at, row.created_at, row.updated_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="risk_flags.csv"' } });
    }

    if (query.type === 'assets') {
      let q = admin
        .from('assets')
        .select('id, bucket, path, mime_type, size_bytes, owner_id, created_at')
        .order('created_at', { ascending: false })
        .limit(query.limit);
      if (rawQ) {
        if (qIsUuid) q = q.or(`id.eq.${rawQ},owner_id.eq.${rawQ}`);
        else q = q.or(`bucket.ilike.${likePattern},path.ilike.${likePattern}`);
      }
      const { data, error } = await q;
      if (error) throw createError('DATABASE_ERROR', 'Export assets impossible', 500, error.message);
      const headers = ['id', 'bucket', 'path', 'mime_type', 'size_bytes', 'owner_id', 'created_at'];
      const csv = toCsv(headers, (data ?? []).map((row: any) => [row.id, row.bucket, row.path, row.mime_type, row.size_bytes, row.owner_id, row.created_at]));
      return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="assets.csv"' } });
    }

    throw createError('BAD_REQUEST', 'Type export non supporté', 400);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
