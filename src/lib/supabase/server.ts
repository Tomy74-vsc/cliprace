import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export function getServerSupabase() {
	return createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
	);
}

export async function getServerUser() {
	const cookieStore = await cookies();
	const access = cookieStore.get("sb-access-token")?.value || cookieStore.get("sb:token")?.value;
	if (!access) return null;
	const supabase = getServerSupabase();
	const { data } = await supabase.auth.getUser(access);
	return data.user ?? null;
}


