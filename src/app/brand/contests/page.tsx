import { getServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export default async function BrandContestsPage() {
	const supabase = getServerSupabase();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return <div className="mx-auto max-w-4xl px-6 py-12">Veuillez vous connecter.</div>;
	const { data } = await supabase.from("contests").select("id,title,status,created_at").eq("brand_id", user.id).order("created_at", { ascending: false });
	return (
		<div className="mx-auto max-w-5xl px-6 py-12">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Mes concours</h1>
				<Link className="underline" href="/brand/contests/new">Créer un concours</Link>
			</div>
			<ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
				{(data ?? []).map((c) => (
					<li key={c.id} className="py-3 flex items-center justify-between">
						<div>
							<div className="font-medium">{c.title}</div>
							<div className="text-sm text-zinc-500">{c.status}</div>
						</div>
						<Link className="underline text-sm" href={`/brand/contests/${c.id}`}>Voir</Link>
					</li>
				))}
			</ul>
		</div>
	);
}


