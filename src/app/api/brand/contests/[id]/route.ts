import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const updateContestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  visual_url: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  rules_text: z.string().min(1).optional(),
  terms_file_url: z.string().optional(),
  creator_selection: z.enum(["all", "specific"]).optional(),
  selected_creators: z.array(z.string()).optional(),
  budget_cents: z.number().min(1).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data: contest, error } = await supabase
      .from("contests")
      .select(`
        *,
        submissions:submissions(
          *,
          creator:profiles!submissions_creator_id_fkey(
            username,
            avatar_url,
            followers_count
          )
        ),
        prizes:contest_prizes(*)
      `)
      .eq("id", id)
      .eq("brand_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Concours non trouvé" }, { status: 404 });
      }
      console.error("Error fetching contest:", error);
      return NextResponse.json({ error: "Erreur lors de la récupération du concours" }, { status: 500 });
    }

    return NextResponse.json({ contest });
  } catch (error) {
    console.error("Error in GET /api/brand/contests/[id]:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateContestSchema.parse(body);

    // Check if contest exists and belongs to user
    const { error: fetchError } = await supabase
      .from("contests")
      .select("id, status")
      .eq("id", id)
      .eq("brand_id", user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Concours non trouvé" }, { status: 404 });
      }
      console.error("Error fetching contest:", fetchError);
      return NextResponse.json({ error: "Erreur lors de la récupération du concours" }, { status: 500 });
    }

    // Validate dates if provided
    if (validatedData.starts_at && validatedData.ends_at) {
      const startsAt = new Date(validatedData.starts_at);
      const endsAt = new Date(validatedData.ends_at);
      
      if (startsAt >= endsAt) {
        return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
      }
    }

    // Update contest
    const { data: contest, error: updateError } = await supabase
      .from("contests")
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("brand_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating contest:", updateError);
      return NextResponse.json({ error: "Erreur lors de la mise à jour du concours" }, { status: 500 });
    }

    return NextResponse.json({ contest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    console.error("Error in PUT /api/brand/contests/[id]:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Check if contest exists and belongs to user
    const { data: existingContest, error: fetchError } = await supabase
      .from("contests")
      .select("id, status")
      .eq("id", id)
      .eq("brand_id", user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Concours non trouvé" }, { status: 404 });
      }
      console.error("Error fetching contest:", fetchError);
      return NextResponse.json({ error: "Erreur lors de la récupération du concours" }, { status: 500 });
    }

    // Only allow deletion of draft contests
    if (existingContest.status !== "draft") {
      return NextResponse.json({ error: "Seuls les concours en brouillon peuvent être supprimés" }, { status: 400 });
    }

    // Delete contest (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from("contests")
      .delete()
      .eq("id", id)
      .eq("brand_id", user.id);

    if (deleteError) {
      console.error("Error deleting contest:", deleteError);
      return NextResponse.json({ error: "Erreur lors de la suppression du concours" }, { status: 500 });
    }

    return NextResponse.json({ message: "Concours supprimé avec succès" });
  } catch (error) {
    console.error("Error in DELETE /api/brand/contests/[id]:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
