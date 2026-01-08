/*
Source: GET /api/invoices/[payment_id]/download
Effects: télécharge la facture PDF depuis Supabase Storage
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { createError, formatErrorResponse } from '@/lib/errors';

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike) {
  return String((error as UnsafeAny)?.code || '').toUpperCase() === '42P01';
}

async function isOrgMember(admin: ReturnType<typeof getSupabaseAdmin>, orgId: string, userId: string) {
  const { data, error } = await admin
    .from('org_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return false;
    throw createError('DATABASE_ERROR', 'Failed to check organization membership', 500, error.message);
  }
  return Boolean(data);
}

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ payment_id: string }> }) {
  try {
    const { payment_id } = await params;
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) {
      throw createError('UNAUTHORIZED', 'Authentification requise', 401);
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent télécharger des factures', 403);
    }

    const admin = getSupabaseAdmin();

    // Récupérer le paiement
    const { data: payment, error: paymentError } = await admin
      .from('payments_brand')
      .select('id, brand_id, org_id, metadata')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw createError('NOT_FOUND', 'Paiement introuvable', 404);
    }

    const orgId = (payment as UnsafeAny).org_id as string | null;
    const canAccess =
      role === 'admin' ||
      payment.brand_id === user.id ||
      (orgId ? await isOrgMember(admin, orgId, user.id) : false);
    if (!canAccess) {
      throw createError('FORBIDDEN', "Tu n'as pas les droits pour télécharger cette facture", 403);
    }

    const metadata = (payment.metadata as UnsafeAny) || {};
    let invoicePdfPath =
      typeof metadata.invoice_pdf_path === 'string' ? (metadata.invoice_pdf_path as string) : null;

    if (!invoicePdfPath && typeof metadata.invoice_pdf_url === 'string') {
      invoicePdfPath = extractInvoicesPathFromUrl(metadata.invoice_pdf_url as string);
    }

    let generatedInvoiceNumber: string | null = null;

    if (!invoicePdfPath) {
      const generateResponse = await fetch(`${req.nextUrl.origin}/api/invoices/${payment_id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') || '',
          'x-internal-request': 'true',
        },
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json().catch(() => ({}));
        throw createError('GENERATION_ERROR', 'Impossible de générer la facture', 500, (errorData as UnsafeAny).message);
      }

      const generateData = await generateResponse.json().catch(() => ({}));
      invoicePdfPath =
        typeof (generateData as UnsafeAny).invoice_path === 'string' ? (generateData as UnsafeAny).invoice_path : null;
      generatedInvoiceNumber =
        typeof (generateData as UnsafeAny).invoice_number === 'string' ? (generateData as UnsafeAny).invoice_number : null;
    }

    const expectedPrefix = `${payment.brand_id}/invoices/`;

    if (!invoicePdfPath || !isSafeStoragePath(invoicePdfPath) || !invoicePdfPath.startsWith(expectedPrefix)) {
      throw createError('NOT_FOUND', 'Facture PDF introuvable', 404);
    }

    const { data: file, error: downloadError } = await admin.storage.from('invoices').download(invoicePdfPath);
    if (downloadError || !file) {
      throw createError('DOWNLOAD_ERROR', 'Impossible de télécharger la facture', 500, downloadError?.message);
    }

    const pdfBuffer = await file.arrayBuffer();
    const invoiceNumber =
      metadata.invoice_number || generatedInvoiceNumber || `INV-${payment_id.slice(0, 8).toUpperCase()}`;
    const safeInvoiceNumber = sanitizeFilenamePart(String(invoiceNumber)) || `INV-${payment_id.slice(0, 8).toUpperCase()}`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"facture-${safeInvoiceNumber}.pdf\"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}


