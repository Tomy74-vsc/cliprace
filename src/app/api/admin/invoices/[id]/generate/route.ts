import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { assertCsrf } from '@/lib/csrf';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { enforceNotReadOnly } from '@/lib/admin/middleware-readonly';
import { invoiceValidators } from '@/lib/admin/validators';
import { notifyAdminAction } from '@/lib/admin/notifications';
import { createError, formatErrorResponse } from '@/lib/errors';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { AdminInvoicePDF } from '@/components/pdf/admin-invoice-pdf';
import { createElement, type ReactElement } from 'react';

function buildInvoiceNumber(id: string, issuedAt: string | null, stripeId: string | null) {
  if (stripeId) return stripeId;
  const datePart = issuedAt ? issuedAt.slice(0, 10).replace(/-/g, '') : 'unknown';
  return `INV-${datePart}-${id.slice(0, 8).toUpperCase()}`;
}

function normalizeVatRate(vatRate: unknown) {
  if (vatRate === null || vatRate === undefined) return null;
  const parsed = Number(vatRate);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('invoices.write');
    await enforceNotReadOnly(req, user.id);
    await enforceAdminRateLimit(req, { route: 'admin:invoices:generate', max: 10, windowMs: 60_000 }, user.id);
    try {
      assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
    } catch (csrfError) {
      throw createError('FORBIDDEN', 'Invalid CSRF token', 403, csrfError);
    }

    // Validation métier
    const validation = await invoiceValidators.canGenerate(id);
    if (!validation.valid) {
      throw createError(
        'VALIDATION_ERROR',
        'Cannot generate invoice PDF',
        400,
        { errors: validation.errors }
      );
    }

    const admin = getAdminClient();
    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select(
        'id, org_id, stripe_invoice_id, amount_cents, currency, vat_rate, pdf_url, status, issued_at, created_at, org:orgs(id, name, billing_email)'
      )
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      throw createError('NOT_FOUND', 'Invoice not found', 404, invoiceError?.message);
    }

    const { data: taxRows, error: taxError } = await admin
      .from('tax_evidence')
      .select('country_code, vat_number, collected_at')
      .eq('org_id', invoice.org_id)
      .order('collected_at', { ascending: false })
      .limit(1);

    if (taxError) {
      throw createError('DATABASE_ERROR', 'Failed to load tax evidence', 500, taxError.message);
    }

    const taxEvidence = (taxRows ?? [])[0] ?? null;
    const org = Array.isArray(invoice.org) ? invoice.org[0] ?? null : invoice.org ?? null;

    const issuedAt = invoice.issued_at ?? invoice.created_at;
    const invoiceNumber = buildInvoiceNumber(invoice.id, issuedAt, invoice.stripe_invoice_id ?? null);
    const amountCents = Number(invoice.amount_cents ?? 0);
    const vatRate = normalizeVatRate(invoice.vat_rate);

    let vatAmountCents: number | null = null;
    let subtotalCents = amountCents;
    if (vatRate !== null && vatRate > 0) {
      vatAmountCents = Math.round(amountCents * (vatRate / (100 + vatRate)));
      subtotalCents = amountCents - vatAmountCents;
    }

    const pdfDoc = createElement(AdminInvoicePDF, {
      invoice: {
        number: invoiceNumber,
        status: invoice.status,
        issued_at: issuedAt,
      },
      org: {
        name: org?.name ?? 'Unknown org',
        billing_email: org?.billing_email ?? undefined,
        vat_number: taxEvidence?.vat_number ?? undefined,
        country_code: taxEvidence?.country_code ?? undefined,
      },
      payment: {
        amount_cents: amountCents,
        currency: invoice.currency || 'EUR',
        stripe_invoice_id: invoice.stripe_invoice_id ?? undefined,
      },
      items: [
        {
          description: 'ClipRace services',
          quantity: 1,
          unit_price_cents: subtotalCents,
          total_cents: subtotalCents,
        },
      ],
      subtotal_cents: subtotalCents,
      vat_rate: vatRate ?? undefined,
      vat_amount_cents: vatAmountCents ?? undefined,
      total_cents: amountCents,
    }) as unknown as ReactElement<DocumentProps>;

    const pdfInstance = pdf(pdfDoc);
    const pdfBlob = await pdfInstance.toBlob();
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    const fileName = `invoice-${invoice.id}-${Date.now()}.pdf`;
    const filePath = `${invoice.org_id}/invoices/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from('invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw createError('STORAGE_ERROR', 'Failed to store invoice PDF', 500, uploadError.message);
    }

    const pdfPath = filePath;

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('invoices')
      .update({ pdf_url: pdfPath, updated_at: now })
      .eq('id', invoice.id);

    if (updateError) {
      throw createError('DATABASE_ERROR', 'Failed to update invoice PDF', 500, updateError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'invoice_generate',
      table_name: 'invoices',
      row_pk: invoice.id,
      new_values: { pdf_path: pdfPath },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    // Notifier l'org owner (via billing_email ou org owner)
    if (invoice.org_id) {
      const { data: org } = await admin
        .from('orgs')
        .select('id, billing_email, owner_id')
        .eq('id', invoice.org_id)
        .single();

      if (org) {
        // Trouver le user_id du billing_email ou utiliser owner_id
        let notifyUserId: string | null = org.owner_id || null;
        if (!notifyUserId && org.billing_email) {
          const { data: profile } = await admin
            .from('profiles')
            .select('id')
            .eq('email', org.billing_email)
            .single();
          notifyUserId = profile?.id || null;
        }

        if (notifyUserId) {
          await notifyAdminAction({
            userId: notifyUserId,
            type: 'invoice_generated',
            data: {
              invoice_id: invoice.id,
              org_id: invoice.org_id,
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      pdf_path: pdfPath,
      download_url: `/api/admin/invoices/${invoice.id}/download`,
      invoice_number: invoiceNumber,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
