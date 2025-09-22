"use client";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function NewContestPage() {
	const supabase = getBrowserSupabase();
	const [title, setTitle] = useState("");
	const [budget, setBudget] = useState(100000);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const res = await fetch("/api/contests", { method: "POST", body: JSON.stringify({ title, total_prize_cents: budget }) });
		setLoading(false);
		if (!res.ok) {
			setError(await res.text());
			return;
		}
		const { id } = await res.json();
		window.location.href = `/brand/contests/${id}`;
	}

	return (
		<div className="mx-auto max-w-2xl px-6 py-12">
			<h1 className="text-2xl font-bold">Nouveau concours</h1>
			<form onSubmit={onCreate} className="mt-6 grid gap-4">
				<input className="border rounded px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" required />
				<input className="border rounded px-3 py-2" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} placeholder="Budget (cents)" required />
				<button className="rounded bg-black text-white px-4 py-2 disabled:opacity-50" disabled={loading}>{loading ? "..." : "Créer"}</button>
				{error && <div className="text-sm text-red-600">{error}</div>}
			</form>
		</div>
	);
}


