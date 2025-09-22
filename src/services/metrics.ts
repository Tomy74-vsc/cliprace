import { getAdminSupabase } from "@/lib/supabase/admin";

type Network = "tiktok" | "instagram" | "youtube";

export function detectNetworkFromUrl(url: string): Network | null {
	try {
		const u = new URL(url);
		if (u.hostname.includes("tiktok")) return "tiktok";
		if (u.hostname.includes("instagram")) return "instagram";
		if (u.hostname.includes("youtube") || u.hostname.includes("youtu.be")) return "youtube";
		return null;
	} catch {
		return null;
	}
}

export async function mockRefreshMetricsForSubmission(submissionId: string) {
	const supabase = getAdminSupabase();
	const today = new Date();
	const date = today.toISOString().slice(0, 10);
	const base = Math.floor(500 + Math.random() * 2500);
	const growth = Math.floor(base * (0.05 + Math.random() * 0.15));
	const views = base + growth;
	const likes = Math.floor(views * (0.03 + Math.random() * 0.04));
	const comments = Math.floor(views * (0.003 + Math.random() * 0.004));
	const shares = Math.floor(views * (0.002 + Math.random() * 0.003));

	await supabase.from("metrics_daily").upsert(
		{
			submission_id: submissionId,
			date,
			views,
			likes,
			comments,
			shares,
		},
		{ onConflict: "submission_id,date" }
	);
}


