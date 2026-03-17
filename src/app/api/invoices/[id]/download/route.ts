import { NextResponse } from 'next/server'
import { getSupabaseSSR } from '@/lib/supabase/ssr'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseSSR()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: payment } = await supabase
    .from('payments_brand')
    .select(
      'id, brand_id, contest_id, amount_cents, currency, created_at, status, stripe_payment_intent_id'
    )
    .eq('id', params.id)
    .eq('brand_id', user.id)
    .single()

  if (!payment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (payment.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Invoice only available for completed payments' },
      { status: 422 }
    )
  }

  if (payment.stripe_payment_intent_id) {
    return NextResponse.redirect(
      `https://dashboard.stripe.com/payments/${payment.stripe_payment_intent_id}`
    )
  }

  return NextResponse.json({
    id: payment.id,
    amount_cents: payment.amount_cents,
    currency: payment.currency,
    created_at: payment.created_at,
    status: payment.status,
  })
}

