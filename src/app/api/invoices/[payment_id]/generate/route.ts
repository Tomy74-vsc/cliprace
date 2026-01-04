/*
Source: POST /api/invoices/[payment_id]/generate
Effects: génère une facture PDF pour un paiement et la stocke dans Supabase Storage
*/
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { assertCsrf } from '@/lib/csrf';
import { createError, formatErrorResponse } from '@/lib/errors';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/pdf/invoice-pdf';
import crypto from 'crypto';
import { createElement, type ReactElement } from 'react';

export async function POST(req: NextRequest, { params }: { params: Promise<{ payment_id: string }> }) {
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
      throw createError('FORBIDDEN', 'Seules les marques ou admins peuvent générer des factures', 403);
    }

    // Bypass CSRF pour les requêtes internes (webhook Stripe)
    const isInternalRequest = req.headers.get('x-internal-request') === 'true';
    if (!isInternalRequest) {
      try {
        assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
      } catch {
        throw createError('FORBIDDEN', 'Jeton CSRF invalide ou manquant', 403);
      }
    }

    const admin = getSupabaseAdmin();

    // Récupérer le paiement avec les détails
    const { data: payment, error: paymentError } = await admin
      .from('payments_brand')
      .select(
        `
        id,
        brand_id,
        contest_id,
        amount_cents,
        currency,
        status,
        stripe_payment_intent_id,
        created_at,
        contest:contest_id (
          title,
          prize_pool_cents
        ),
        brand:brand_id (
          display_name,
          profile_brands!inner (
            company_name,
            address_line1,
            address_line2,
            address_city,
            address_postal_code,
            address_country,
            vat_number
          )
        )
      `
      )
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      throw createError('NOT_FOUND', 'Paiement introuvable', 404);
    }

    // Vérifier ownership
    if (payment.brand_id !== user.id && role !== 'admin') {
      throw createError('FORBIDDEN', 'Tu n\'as pas les droits pour générer cette facture', 403);
    }

    // Vérifier que le paiement est réussi
    if (payment.status !== 'succeeded') {
      throw createError('VALIDATION_ERROR', 'Le paiement doit être réussi pour générer une facture', 400);
    }

    const contest = (Array.isArray((payment as any).contest)
      ? (payment as any).contest[0]
      : (payment as any).contest) as { title: string; prize_pool_cents: number } | null;

    const brand = (Array.isArray((payment as any).brand)
      ? (payment as any).brand[0]
      : (payment as any).brand) as {
      display_name?: string | null;
      profile_brands?: {
        company_name: string;
        address_line1?: string | null;
        address_line2?: string | null;
        address_city?: string | null;
        address_postal_code?: string | null;
        address_country?: string | null;
        vat_number?: string | null;
      } | null;
    } | null;

    if (!contest || !brand?.profile_brands) {
      throw createError('NOT_FOUND', 'Données incomplètes pour générer la facture', 404);
    }

    // Générer le numéro de facture
    const invoiceNumber = `INV-${payment.created_at.slice(0, 10).replace(/-/g, '')}-${payment_id.slice(0, 8).toUpperCase()}`;

    // Calculer les montants (prize pool + commission 15%)
    const prizePoolCents = contest.prize_pool_cents;
    const commissionRate = 0.15;
    const commissionCents = Math.round(prizePoolCents * commissionRate);
    const subtotalCents = prizePoolCents + commissionCents;
    
    // TVA (20% en France par défaut, peut être configuré)
    const vatRate = 20;
    const vatAmountCents = Math.round(subtotalCents * (vatRate / 100));
    const totalCents = subtotalCents + vatAmountCents;

    // Construire l'adresse
    const addressParts = [
      brand.profile_brands.address_line1,
      brand.profile_brands.address_line2,
      brand.profile_brands.address_city,
      brand.profile_brands.address_postal_code,
      brand.profile_brands.address_country,
    ].filter(Boolean);
    const address = addressParts.join(', ');

    // Générer le PDF
    const pdfDoc = createElement(InvoicePDF, {
      invoice: {
        number: invoiceNumber,
        issued_at: payment.created_at,
        due_date: payment.created_at,
      },
      brand: {
        company_name: brand.profile_brands.company_name,
        address: address || undefined,
        vat_number: brand.profile_brands.vat_number || undefined,
      },
      contest: {
        title: contest.title,
        id: payment.contest_id,
      },
      payment: {
        amount_cents: payment.amount_cents,
        currency: payment.currency || 'EUR',
        stripe_payment_intent_id: payment.stripe_payment_intent_id || undefined,
        created_at: payment.created_at,
      },
      items: [
        {
          description: `Prize pool - Concours "${contest.title}"`,
          quantity: 1,
          unit_price_cents: prizePoolCents,
          total_cents: prizePoolCents,
        },
        {
          description: 'Commission de plateforme (15%)',
          quantity: 1,
          unit_price_cents: commissionCents,
          total_cents: commissionCents,
        },
      ],
      subtotal_cents: subtotalCents,
      vat_rate: vatRate,
      vat_amount_cents: vatAmountCents,
      total_cents: totalCents,
    }) as unknown as ReactElement<DocumentProps>;

    // Générer le PDF
    const pdfInstance = pdf(pdfDoc);
    const pdfBlob = await pdfInstance.toBlob();
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Stocker le PDF dans Supabase Storage
    const fileName = `invoice-${payment_id}-${Date.now()}.pdf`;
    const filePath = `${payment.brand_id}/invoices/${fileName}`;

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('invoices')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading invoice PDF:', uploadError);
      throw createError('STORAGE_ERROR', 'Impossible de stocker la facture', 500, uploadError.message);
    }

    // Récupérer l'URL publique
    const { data: urlData } = admin.storage.from('invoices').getPublicUrl(filePath);

    // Créer ou mettre à jour l'enregistrement dans la table invoices (si elle existe)
    // Note: La table invoices nécessite org_id, donc on peut stocker l'URL dans payments_brand.metadata
    const { error: updateError } = await admin
      .from('payments_brand')
      .update({
        metadata: {
          ...((payment as any).metadata || {}),
          invoice_pdf_url: urlData.publicUrl,
          invoice_number: invoiceNumber,
          invoice_generated_at: new Date().toISOString(),
        },
      })
      .eq('id', payment_id);

    if (updateError) {
      console.error('Error updating payment metadata:', updateError);
      // Ne pas bloquer, on a quand même le PDF
    }

    // Audit log
    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'invoice_generate',
      table_name: 'payments_brand',
      row_pk: payment_id,
      new_values: { invoice_number: invoiceNumber, invoice_pdf_url: urlData.publicUrl },
    });
    if (auditError) {
      console.error('Audit log failed for invoice_generate', auditError);
    }

    // Retourner l'URL du PDF
    return NextResponse.json({
      ok: true,
      invoice_url: urlData.publicUrl,
      invoice_number: invoiceNumber,
      download_url: `/api/invoices/${payment_id}/download`,
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

