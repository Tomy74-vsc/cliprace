import { getAdminSupabase } from "@/lib/supabase/admin";

export const STANDARD_PCT: number[] = [
	20, 15, 10, 8, 7, 5, 4, 3, 2.5, 2,
	1.2, 1.2, 1.2, 1.2, 1.2,
	1, 1, 1, 1, 1,
	0.8, 0.8, 0.8, 0.8, 0.8,
	0.5, 0.5, 0.5, 0.5, 0.5,
];

/**
 * Calcule le score pondéré d'une soumission
 * @param views - Nombre de vues
 * @param engagementRate - Taux d'engagement (en pourcentage)
 * @returns Score pondéré (vues + bonus d'engagement)
 */
function calculateWeightedScore(views: number, engagementRate: number): number {
	return views + (engagementRate * views / 100);
}

export async function recomputeLeaderboard(contestId: string) {
	const supabase = getAdminSupabase();
	const { data: totals, error } = await supabase
		.from("submissions")
		.select("id, creator_id")
		.eq("contest_id", contestId)
		.eq("status", "approved");
	if (error) throw error;

	// Récupérer les métriques depuis metrics_daily
	const submissionIds = (totals ?? []).map((s: any) => s.id);
	
	const metricsData: Record<string, { views: number; likes: number; comments: number; engagement_rate: number }> = {};
	
	if (submissionIds.length > 0) {
		// Récupérer les métriques les plus récentes pour chaque soumission
		const { data: metrics, error: metricsError } = await supabase
			.from("metrics_daily")
			.select("submission_id, views, likes, comments, engagement_rate, date")
			.in("submission_id", submissionIds)
			.order("date", { ascending: false });
		
		if (metricsError) {
			console.warn("Erreur lors de la récupération des métriques:", metricsError);
		} else if (metrics) {
			// Prendre la métrique la plus récente pour chaque soumission
			const latestMetrics = new Map<string, { views: number; likes: number; comments: number; engagement_rate: number; date: string }>();
			metrics.forEach((metric: any) => {
				const existing = latestMetrics.get(metric.submission_id);
				if (!existing || new Date(metric.date) > new Date(existing.date)) {
					latestMetrics.set(metric.submission_id, metric);
				}
			});
			
			// Convertir en objet pour faciliter l'accès
			latestMetrics.forEach((metric, submissionId) => {
				metricsData[submissionId] = {
					views: metric.views || 0,
					likes: metric.likes || 0,
					comments: metric.comments || 0,
					engagement_rate: metric.engagement_rate || 0
				};
			});
		}
	}
	
	const rows = (totals ?? []).map((s: { id: string; creator_id: string }) => {
		const metrics = metricsData[s.id] || { views: 0, likes: 0, comments: 0, engagement_rate: 0 };
		return {
			submission_id: s.id,
			creator_id: s.creator_id,
			views: metrics.views,
			likes: metrics.likes,
			comments: metrics.comments,
			engagement_rate: metrics.engagement_rate
		};
	});
	// Trier par score pondéré (vues + engagement)
	rows.sort((a, b) => {
		const scoreA = calculateWeightedScore(a.views, a.engagement_rate);
		const scoreB = calculateWeightedScore(b.views, b.engagement_rate);
		return scoreB - scoreA;
	});

	const { data: contest } = await supabase
		.from("contests")
		.select("total_prize_cents")
		.eq("id", contestId)
		.single();
	const totalPrize = Number((contest as any)?.total_prize_cents ?? 0);

	const now = new Date().toISOString();
	const upserts = rows.slice(0, 30).map((r, idx) => {
		const weightedScore = calculateWeightedScore(r.views, r.engagement_rate);
		return {
			contest_id: contestId,
			rank: idx + 1,
			submission_id: r.submission_id,
			creator_id: r.creator_id,
			views_weighted: Math.round(weightedScore),
			prize_cents: Math.floor((STANDARD_PCT[idx] ?? 0) / 100 * totalPrize),
			computed_at: now,
		};
	});

	await supabase.from("leaderboards").delete().eq("contest_id", contestId);
	if (upserts.length > 0) {
		await supabase.from("leaderboards").upsert(upserts as any, { onConflict: "contest_id,rank" });
	}
	return { count: rows.length, updated: upserts.length };
}


