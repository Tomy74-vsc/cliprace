import { NextRequest } from "next/server";
import { getServerSupabase, getServerUser } from "@/lib/supabase/server";
import { computePlatformFeeCents } from "@/services/payments";
import { createNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
    const supabase = await getServerSupabase();
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
	
	// Send notification about cashout request
	try {
		await createNotification(
			user.id,
			'payment_received',
			{
				amount_cents: insert.net_cents,
				cashout_id: data.id
			}
		);
	} catch (notificationError) {
		console.error('Notification error:', notificationError);
		// Don't fail the cashout if notification fails
	}
	
	return Response.json({ id: data.id });
}


