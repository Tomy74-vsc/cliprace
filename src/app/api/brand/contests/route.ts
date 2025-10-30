import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
// import { assertRole } from "@/lib/auth/roles";
import { z } from "zod";

const createContestSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  visual_url: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  rules_text: z.string().min(1, "Les règles sont requises"),
  terms_file_url: z.string().optional(),
  creator_selection: z.enum(["all", "specific"]).default("all"),
  selected_creators: z.array(z.string()).optional(),
  budget_cents: z.number().min(1, "Le budget doit être supérieur à 0"),
  prize_distribution: z.array(z.object({
    position: z.number().min(1),
    percentage: z.number().min(0).max(100),
  })),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
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
      .from("contests")
      .select(`
        *,
        submissions:submissions(count)
      `)
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: contests, error } = await query;

    if (error) {
      console.error("Error fetching contests:", error);
      return NextResponse.json({ error: "Erreur lors de la récupération des concours" }, { status: 500 });
    }

    return NextResponse.json({ contests });
  } catch (error) {
    console.error("Error in GET /api/brand/contests:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const validatedData = createContestSchema.parse(body);

    // Validate dates
    const startsAt = new Date(validatedData.starts_at);
    const endsAt = new Date(validatedData.ends_at);
    
    if (startsAt >= endsAt) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
    }

    // Calculate prize pool
    const totalPercentage = validatedData.prize_distribution.reduce((sum, prize) => sum + prize.percentage, 0);
    if (totalPercentage > 100) {
      return NextResponse.json({ error: "La répartition des prix ne peut pas dépasser 100%" }, { status: 400 });
    }

    const prizePoolCents = Math.round(validatedData.budget_cents * 0.85); // 15% commission

    // Create contest
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .insert({
        brand_id: user.id,
        title: validatedData.title,
        description: validatedData.description,
        visual_url: validatedData.visual_url,
        hashtags: validatedData.hashtags || [],
        rules_text: validatedData.rules_text,
        terms_file_url: validatedData.terms_file_url,
        creator_selection: validatedData.creator_selection,
        selected_creators: validatedData.selected_creators || [],
        budget_cents: validatedData.budget_cents,
        prize_pool_cents: prizePoolCents,
        starts_at: validatedData.starts_at,
        ends_at: validatedData.ends_at,
        status: "draft",
      })
      .select()
      .single();

    if (contestError) {
      console.error("Error creating contest:", contestError);
      return NextResponse.json({ error: "Erreur lors de la création du concours" }, { status: 500 });
    }

    // Create prize distribution
    const prizeDistributionData = validatedData.prize_distribution.map(prize => ({
      contest_id: contest.id,
      position: prize.position,
      percentage: prize.percentage,
      amount_cents: Math.round(prizePoolCents * prize.percentage / 100),
    }));

    const { error: prizeError } = await supabase
      .from("contest_prizes")
      .insert(prizeDistributionData);

    if (prizeError) {
      console.error("Error creating prize distribution:", prizeError);
      // Rollback contest creation
      await supabase.from("contests").delete().eq("id", contest.id);
      return NextResponse.json({ error: "Erreur lors de la création de la répartition des prix" }, { status: 500 });
    }

    return NextResponse.json({ contest }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    console.error("Error in POST /api/brand/contests:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
