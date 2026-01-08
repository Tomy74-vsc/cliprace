import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { createError, formatErrorResponse } from '@/lib/errors';

function sanitizeFilenamePart(input: string) {
  return input
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function isSafeStoragePath(path: string) {
  if (!path) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (path.split('/').includes('..')) return false;
  return true;
}

function extractInvoicesPathFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const bucketIndex = parts.findIndex((p) => p === 'invoices');
    if (bucketIndex === -1) return null;
    const maybePath = decodeURIComponent(parts.slice(bucketIndex + 1).join('/'));
    if (!maybePath) return null;
    return isSafeStoragePath(maybePath) ? maybePath : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireAdminPermission('invoices.read');
    await enforceAdminRateLimit(req, { route: 'admin:invoices:download', max: 60, windowMs: 60_000 }, user.id);

    const admin = getAdminClient();
    const { data: invoice, error: invoiceError } = await admin
      .from('invoices')
      .select('id, stripe_invoice_id, issued_at, created_at, pdf_url')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      throw createError('NOT_FOUND', 'Invoice not found', 404, invoiceError?.message);
    }

    let pdfPath = invoice.pdf_url;
    if (!pdfPath) {
      throw createError('NOT_FOUND', 'Invoice PDF not available', 404);
    }
    if (pdfPath.startsWith('http')) {
      pdfPath = extractInvoicesPathFromUrl(pdfPath) ?? pdfPath;
    }
    if (!isSafeStoragePath(pdfPath)) {
      throw createError('VALIDATION_ERROR', 'Invalid invoice PDF path', 400);
    }

    const { data: file, error: downloadError } = await admin.storage.from('invoices').download(pdfPath);
    if (downloadError || !file) {
      throw createError('STORAGE_ERROR', 'Failed to download invoice PDF', 500, downloadError?.message);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const invoiceNumber = invoice.stripe_invoice_id || `INV-${id.slice(0, 8).toUpperCase()}`;
    const safeName = sanitizeFilenamePart(invoiceNumber) || `invoice-${id.slice(0, 8).toUpperCase()}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"${safeName}.pdf\"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
