import { getServerSupabase, getServerUser } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await getServerSupabase();
    const user = await getServerUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
	const { reason } = await req.json();
	const { error } = await supabase.from("submissions").update({ status: "rejected", reason }).eq("id", id);
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ ok: true });
}


