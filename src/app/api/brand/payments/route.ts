import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const createPaymentSchema = z.object({
  contest_id: z.string().uuid(),
  amount_cents: z.number().min(1),
  payment_method_id: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Check if user is a brand
    const { data: profile } = await supabase
      .from("profiles_brand")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil marque non trouvé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("payments_brand")
      .select(`
        *,
        contest:contests!payments_brand_contest_id_fkey(
          title,
          created_at
        )
      `)
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: payments, error } = await query;

    if (error) {
      console.error("Error fetching payments:", error);
      return NextResponse.json({ error: "Erreur lors de la récupération des paiements" }, { status: 500 });
    }

    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Error in GET /api/brand/payments:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export const POST = withRateLimit('/api/brand/payments')(async (request: Request) => {
  try {
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Check if user is a brand
    const { data: profile } = await supabase
      .from("profiles_brand")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil marque non trouvé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createPaymentSchema.parse(body);

    // Verify contest exists and belongs to user
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select("id, title, budget_cents, status")
      .eq("id", validatedData.contest_id)
      .eq("brand_id", user.id)
      .single();

    if (contestError) {
      if (contestError.code === "PGRST116") {
        return NextResponse.json({ error: "Concours non trouvé" }, { status: 404 });
      }
      console.error("Error fetching contest:", contestError);
      return NextResponse.json({ error: "Erreur lors de la récupération du concours" }, { status: 500 });
    }

    // Check if contest is in draft status
    if (contest.status !== "draft") {
      return NextResponse.json({ error: "Le concours doit être en brouillon pour être payé" }, { status: 400 });
    }

    // Verify payment amount matches contest budget
    if (validatedData.amount_cents !== contest.budget_cents) {
      return NextResponse.json({ error: "Le montant du paiement ne correspond pas au budget du concours" }, { status: 400 });
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments_brand")
      .insert({
        brand_id: user.id,
        contest_id: validatedData.contest_id,
        amount_cents: validatedData.amount_cents,
        status: "pending",
        payment_method_id: validatedData.payment_method_id,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return NextResponse.json({ error: "Erreur lors de la création du paiement" }, { status: 500 });
    }

    // Here you would integrate with Stripe to create a payment intent
    // For now, we'll simulate a successful payment
    const { error: updateError } = await supabase
      .from("payments_brand")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_intent_id: `pi_${Date.now()}`, // Mock payment intent ID
      })
      .eq("id", payment.id);

    if (updateError) {
      console.error("Error updating payment status:", updateError);
      return NextResponse.json({ error: "Erreur lors de la mise à jour du statut du paiement" }, { status: 500 });
    }

    // Update contest status to active
    const { error: contestUpdateError } = await supabase
      .from("contests")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", validatedData.contest_id);

    if (contestUpdateError) {
      console.error("Error updating contest status:", contestUpdateError);
      return NextResponse.json({ error: "Erreur lors de l'activation du concours" }, { status: 500 });
    }

    return NextResponse.json({ payment, message: "Paiement effectué avec succès" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    console.error("Error in POST /api/brand/payments:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
});
