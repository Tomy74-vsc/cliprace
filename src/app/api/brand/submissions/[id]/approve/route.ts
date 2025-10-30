import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function POST(
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

    // Check if user is a brand
    const { data: profile } = await supabase
      .from("profiles_brand")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil marque non trouvé" }, { status: 403 });
    }

    // Get submission and verify it belongs to a contest owned by this brand
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(`
        *,
        contest:contests!submissions_contest_id_fkey(
          id,
          brand_id,
          status
        )
      `)
      .eq("id", id)
      .single();

    if (submissionError) {
      if (submissionError.code === "PGRST116") {
        return NextResponse.json({ error: "Participation non trouvée" }, { status: 404 });
      }
      console.error("Error fetching submission:", submissionError);
      return NextResponse.json({ error: "Erreur lors de la récupération de la participation" }, { status: 500 });
    }

    // Verify the contest belongs to this brand
    if (submission.contest.brand_id !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Check if contest is still active
    if (submission.contest.status !== "active") {
      return NextResponse.json({ error: "Le concours n'est plus actif" }, { status: 400 });
    }

    // Update submission status
    const { data: updatedSubmission, error: updateError } = await supabase
      .from("submissions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating submission:", updateError);
      return NextResponse.json({ error: "Erreur lors de l'approbation de la participation" }, { status: 500 });
    }

    // Update contest metrics
    const { error: metricsError } = await supabase
      .from("contests")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.contest_id);

    if (metricsError) {
      console.error("Error updating contest metrics:", metricsError);
      // Don't fail the request, just log the error
    }

    // Send notification to creator about approval
    try {
      await createNotification(
        submission.creator_id,
        'submission_status',
        {
          status: 'approved',
          submission_id: id
        }
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Don't fail the approval if notification fails
    }

    return NextResponse.json({ submission: updatedSubmission });
  } catch (error) {
    console.error("Error in POST /api/brand/submissions/[id]/approve:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
