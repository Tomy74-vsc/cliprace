"use client";
import { useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { AuthHeader } from "../auth/components/AuthHeader";
import { motion } from "framer-motion";

type Role = "brand" | "creator";

export default function SignupPage() {
	const supabase = getBrowserSupabase();
	const [role, setRole] = useState<Role>("creator");
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
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
		if (password !== confirmPassword) {
			setError("Les mots de passe ne correspondent pas.");
			return;
		}
		setLoading(true);
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { role, fullName }, emailRedirectTo: `${window.location.origin}/auth/confirm` },
		});
		setLoading(false);
		if (error) setError(error.message);
		else window.location.href = "/auth/check-email";
	}

	return (
		<div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
				<AuthHeader />
				<h1 className="text-2xl font-bold tracking-tight">Créer un compte</h1>
				<div className="mt-4 inline-flex rounded-full border border-zinc-300 p-1 dark:border-zinc-700">
					<button type="button" onClick={() => setRole("creator")} className={`px-4 py-1 rounded-full text-sm ${role === "creator" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-700 dark:text-zinc-200"}`}>Créateur</button>
					<button type="button" onClick={() => setRole("brand")} className={`px-4 py-1 rounded-full text-sm ${role === "brand" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-700 dark:text-zinc-200"}`}>Marque</button>
				</div>
				<form onSubmit={onSubmit} className="mt-6 grid gap-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Nom complet</label>
						<Input placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Email</label>
						<Input type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Mot de passe</label>
						<Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Confirmer le mot de passe</label>
						<Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
						{error && <p className="mt-1 text-sm text-red-600">{error}</p>}
					</div>
					<Button type="submit" disabled={loading} className="w-full">{loading ? "Création…" : "S’inscrire"}</Button>
				</form>
				<p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">En créant un compte, vous acceptez nos Conditions et Politique de confidentialité.</p>
				<p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">Déjà un compte ? <Link href={`/login?redirect=${encodeURIComponent(redirectParam)}`} className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Connectez-vous</Link></p>
			</motion.div>
		</div>
	);
}

