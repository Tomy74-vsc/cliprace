import { getServerSupabase, getServerUser } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const supabase = getServerSupabase();
    const user = await getServerUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
	const { error } = await supabase.from("submissions").update({ status: "approved" }).eq("id", params.id);
	if (error) return new Response(error.message, { status: 400 });
	return Response.json({ ok: true });
}


