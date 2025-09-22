import { NextRequest } from "next/server";
import { getServerSupabase, getServerUser } from "@/lib/supabase/server";
import { computePlatformFeeCents } from "@/services/payments";

export async function POST(req: NextRequest) {
    const supabase = getServerSupabase();
    const user = await getServerUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
	const body = await req.json();
	const gross_cents = Number(body.gross_cents || 0);
	const fee = computePlatformFeeCents(gross_cents);
	const insert = {
		creator_id: user.id,
		gross_cents,
		platform_fee_cents: fee,
		net_cents: Math.max(gross_cents - fee, 0),
		status: "pending",
		created_at: new Date().toISOString(),
	};
	const { data, error } = await supabase.from("cashouts").insert(insert).select("id").single();
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ id: data.id });
}


