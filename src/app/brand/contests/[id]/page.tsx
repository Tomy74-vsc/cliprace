import { getServerSupabase } from "@/lib/supabase/server";
import { recomputeLeaderboard } from "@/services/leaderboard";

export default async function ContestDetail({ params }: { params: { id: string } }) {
	const supabase = getServerSupabase();
	const { data: contest } = await supabase.from("contests").select("id,title,status,total_prize_cents").eq("id", params.id).single();
	const { data: leaderboard } = await supabase
		.from("leaderboards")
		.select("rank,creator_id,views_weighted,prize_cents")
		.eq("contest_id", params.id)
		.order("rank");

	async function recompute() {
		"use server";
		await recomputeLeaderboard(params.id);
	}

	return (
		<div className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-2xl font-bold">{contest?.title}</h1>
			<div className="mt-2 text-sm text-zinc-500">Statut: {contest?.status} · Budget: {contest?.total_prize_cents} cts</div>
			<form action={recompute} className="mt-4">
				<button className="underline" type="submit">Recalculer le classement</button>
			</form>
			<table className="mt-6 w-full text-sm">
				<thead><tr><th className="text-left">Rang</th><th className="text-left">Creator</th><th className="text-right">Vues</th><th className="text-right">Gain (cts)</th></tr></thead>
				<tbody>
					{(leaderboard ?? []).map((r) => (
						<tr key={r.rank} className="border-t border-zinc-200 dark:border-zinc-800">
							<td>#{r.rank}</td>
							<td>{r.creator_id}</td>
							<td className="text-right">{r.views_weighted?.toLocaleString?.("fr-FR") ?? r.views_weighted}</td>
							<td className="text-right">{r.prize_cents}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}


