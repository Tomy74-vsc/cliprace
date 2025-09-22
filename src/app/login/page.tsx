"use client";
import { useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { AuthHeader } from "../auth/components/AuthHeader";
import { motion } from "framer-motion";

export default function LoginPage() {
	const supabase = getBrowserSupabase();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const redirectParam = useMemo(() => {
		if (typeof window === "undefined") return "/";
		const params = new URLSearchParams(window.location.search);
		return params.get("redirect") || "/";
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		setLoading(false);
		if (error) {
			setError(error.message);
			return;
		}
		const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
		const role = typeof meta?.role === "string" && (meta.role === "brand" || meta.role === "creator") ? (meta.role as "brand" | "creator") : undefined;
		const fallback = role === "brand" ? "/brand" : role === "creator" ? "/creator" : "/";
		const target = redirectParam || fallback;
		window.location.href = target === "/" ? fallback : target;
	}

	return (
		<div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
				<AuthHeader />
				<h1 className="text-2xl font-bold tracking-tight">Connexion à ClipRace</h1>
				<form onSubmit={onSubmit} className="mt-6 grid gap-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Email</label>
						<Input type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
						{error && error.toLowerCase().includes("email") && <p className="mt-1 text-sm text-red-600">{error}</p>}
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Mot de passe</label>
						<Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
						{error && !error.toLowerCase().includes("email") && <p className="mt-1 text-sm text-red-600">{error}</p>}
					</div>
					<Button type="submit" disabled={loading} className="w-full">{loading ? "Connexion…" : "Se connecter"}</Button>
				</form>
				<div className="mt-4 flex items-center justify-between text-sm">
					<Link href="/forgot" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Mot de passe oublié ?</Link>
				</div>
				<p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
					Pas encore de compte ? <Link href={`/signup?redirect=${encodeURIComponent(redirectParam)}`} className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Créez-en un</Link>
				</p>
			</motion.div>
		</div>
	);
}

