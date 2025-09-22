import { getAdminSupabase } from "@/lib/supabase/admin";
import { detectNetworkFromUrl, mockRefreshMetricsForSubmission } from "@/services/metrics";

async function main() {
	const db = getAdminSupabase();
	console.log("Seeding demo data...");

	// Create brands and creators minimal profiles
	const { data: brandUser } = await db.auth.admin.createUser({ email: `brand@example.com`, password: "password", email_confirm: true, user_metadata: { role: "brand" } });
	const { data: creatorUser } = await db.auth.admin.createUser({ email: `creator@example.com`, password: "password", email_confirm: true, user_metadata: { role: "creator" } });

	if (brandUser?.user) {
		await db.from("profiles_brand").upsert({ user_id: brandUser.user.id, company_name: "Acme Brand", country: "FR" });
	}
	if (creatorUser?.user) {
		await db.from("profiles_creator").upsert({ user_id: creatorUser.user.id, handle: "creator1", country: "FR", avg_views_30d: 20000, followers_total: 15000 });
	}

	// One contest
	const { data: contest } = await db
		.from("contests")
		.insert({
			brand_id: brandUser?.user?.id,
			title: "Concours Démo",
			description: "Postez un short !",
			status: "active",
			total_prize_cents: 100000,
			created_at: new Date().toISOString(),
		})
		.select("id")
		.single();

	// Submissions
	if (contest?.id && creatorUser?.user?.id) {
		const video_url = "https://www.tiktok.com/@demo/video/123456";
		const network = detectNetworkFromUrl(video_url);
		const { data: sub } = await db
			.from("submissions")
			.insert({
				contest_id: contest.id,
				creator_id: creatorUser.user.id,
				network,
				video_url,
				status: "approved",
				created_at: new Date().toISOString(),
			})
			.select("id")
			.single();
		if (sub?.id) {
			await mockRefreshMetricsForSubmission(sub.id);
		}
	}

	console.log("Seed done.");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});


