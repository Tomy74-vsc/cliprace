import { NextRequest } from "next/server";
import { getServerSupabase, getServerUser } from "@/lib/supabase/server";
import { detectNetworkFromUrl } from "@/services/metrics";

export async function POST(req: NextRequest) {
    const supabase = getServerSupabase();
    const user = await getServerUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
	const body = await req.json();
	const network = detectNetworkFromUrl(body.video_url);
	if (!network) return new Response("Invalid video URL", { status: 400 });
	const insert = {
		contest_id: body.contest_id,
		creator_id: user.id,
		network,
		video_url: body.video_url,
		posted_at: body.posted_at ?? new Date().toISOString(),
		status: "pending",
		created_at: new Date().toISOString(),
	};
	const { data, error } = await supabase.from("submissions").insert(insert).select("id").single();
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ id: data.id });
}


