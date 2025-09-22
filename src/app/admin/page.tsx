import { getServerSupabase } from "@/lib/supabase/server";

export default async function AdminPage() {
	const supabase = getServerSupabase();
	const { data: users } = await supabase.from("users").select("id,email,role,created_at").order("created_at", { ascending: false }).limit(50);
	const { data: contests } = await supabase.from("contests").select("id,title,status").order("created_at", { ascending: false }).limit(20);
	return (
		<div className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-2xl font-bold">Admin</h1>
			<h2 className="mt-6 font-semibold">Utilisateurs</h2>
			<ul className="mt-2 text-sm grid gap-1">
				{(users ?? []).map((u) => (
					<li key={u.id}>{u.email} — {u.role}</li>
				))}
			</ul>
			<h2 className="mt-6 font-semibold">Concours</h2>
			<ul className="mt-2 text-sm grid gap-1">
				{(contests ?? []).map((c) => (
					<li key={c.id}>{c.title} — {c.status}</li>
				))}
			</ul>
		</div>
	);
}


