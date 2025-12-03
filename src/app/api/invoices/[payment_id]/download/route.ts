/*
Source: GET /api/invoices/[payment_id]/download
Effects: télécharge la facture PDF depuis Supabase Storage
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { createError, formatErrorResponse } from '@/lib/errors';

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
      .select('id, brand_id, metadata')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw createError('NOT_FOUND', 'Paiement introuvable', 404);
    }

    // Vérifier ownership
    if (payment.brand_id !== user.id && role !== 'admin') {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour télécharger cette facture', 403);
    }

    // Récupérer l'URL du PDF depuis les métadonnées
    const metadata = (payment.metadata as any) || {};
    const invoicePdfUrl = metadata.invoice_pdf_url;

    if (!invoicePdfUrl) {
      // Générer la facture si elle n'existe pas encore
      const generateResponse = await fetch(
        `${req.nextUrl.origin}/api/invoices/${payment_id}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: req.headers.get('cookie') || '',
            'x-csrf': req.headers.get('x-csrf') || '',
          },
        }
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw createError('GENERATION_ERROR', 'Impossible de générer la facture', 500, errorData.message);
      }

      const generateData = await generateResponse.json();
      const newInvoiceUrl = generateData.invoice_url;

      // Télécharger le PDF depuis l'URL publique
      const pdfResponse = await fetch(newInvoiceUrl);
      if (!pdfResponse.ok) {
        throw createError('DOWNLOAD_ERROR', 'Impossible de télécharger la facture', 500);
      }

      const pdfBuffer = await pdfResponse.arrayBuffer();

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="facture-${payment_id}.pdf"`,
        },
      });
    }

    // Télécharger le PDF depuis l'URL stockée
    const pdfResponse = await fetch(invoicePdfUrl);
    if (!pdfResponse.ok) {
      throw createError('DOWNLOAD_ERROR', 'Impossible de télécharger la facture', 500);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    const invoiceNumber = metadata.invoice_number || `INV-${payment_id.slice(0, 8)}`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="facture-${invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

