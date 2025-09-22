import { NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { mockRefreshMetricsForSubmission } from "@/services/metrics";

export async function POST(req: NextRequest) {
	const supabase = getAdminSupabase();
	const { contestId } = await req.json().catch(() => ({ contestId: null }));
	let query = supabase.from("submissions").select("id").eq("status", "approved");
	if (contestId) query = query.eq("contest_id", contestId);
	const { data } = await query.limit(2000);
	const ids = (data ?? []).map((r) => r.id);
	for (const id of ids) {
		await mockRefreshMetricsForSubmission(id);
	}
	return Response.json({ ok: true, updated: ids.length });
}


