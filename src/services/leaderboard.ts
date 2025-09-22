import { getAdminSupabase } from "@/lib/supabase/admin";

export const STANDARD_PCT: number[] = [
	20, 15, 10, 8, 7, 5, 4, 3, 2.5, 2,
	1.2, 1.2, 1.2, 1.2, 1.2,
	1, 1, 1, 1, 1,
	0.8, 0.8, 0.8, 0.8, 0.8,
	0.5, 0.5, 0.5, 0.5, 0.5,
];

export async function recomputeLeaderboard(contestId: string) {
	const supabase = getAdminSupabase();
	const { data: totals, error } = await supabase
		.from("submissions")
		.select(
			"id, creator_id, metrics_daily!inner(sum_views:views.sum, sum_likes:likes.sum, sum_comments:comments.sum, sum_shares:shares.sum)"
		)
		.eq("contest_id", contestId)
		.eq("status", "approved");
	if (error) throw error;

	const rows = (totals ?? []).map((s: any) => ({
		submission_id: s.id,
		creator_id: s.creator_id,
		views: Number(s.metrics_daily?.[0]?.sum_views ?? 0),
	}));
	rows.sort((a, b) => b.views - a.views);

	const { data: contest } = await supabase
		.from("contests")
		.select("total_prize_cents")
		.eq("id", contestId)
		.single();
	const totalPrize = Number(contest?.total_prize_cents ?? 0);

	const now = new Date().toISOString();
	const upserts = rows.slice(0, 30).map((r, idx) => ({
		contest_id: contestId,
		rank: idx + 1,
		submission_id: r.submission_id,
		creator_id: r.creator_id,
		views_weighted: r.views,
		prize_cents: Math.floor((STANDARD_PCT[idx] ?? 0) / 100 * totalPrize),
		computed_at: now,
	}));

	await supabase.from("leaderboards").delete().eq("contest_id", contestId);
	if (upserts.length > 0) {
		await supabase.from("leaderboards").upsert(upserts, { onConflict: "contest_id,rank" });
	}
	return { count: rows.length, updated: upserts.length };
}


