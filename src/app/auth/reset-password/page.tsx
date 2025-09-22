"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthHeader } from "../components/AuthHeader";
import { motion } from "framer-motion";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
	const supabase = getBrowserSupabase();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	// Ensure we have a recovery session (from emailed link). Not strictly needed for UI, but helpful to fail fast.
	useEffect(() => {
		// No-op: Supabase will have a temporary session if link was used. We keep UI simple.
	}, []);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password !== confirmPassword) {
			setError("Les mots de passe ne correspondent pas.");
			return;
		}
		setLoading(true);
		const { error } = await supabase.auth.updateUser({ password });
		setLoading(false);
		if (error) {
			setError(error.message);
			return;
		}
		setSuccess(true);
		setTimeout(() => {
			window.location.href = "/login";
		}, 3000);
	}

	return (
		<div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
				<AuthHeader />
				<h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Choisissez un nouveau mot de passe pour votre compte ClipRace.</p>
				<form onSubmit={onSubmit} className="mt-6 grid gap-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Nouveau mot de passe</label>
						<Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Confirmation du mot de passe</label>
						<Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
						{error && <p className="mt-1 text-sm text-red-600">{error}</p>}
					</div>
					<Button type="submit" disabled={loading} className="w-full">{loading ? "Changement…" : "Changer le mot de passe"}</Button>
				</form>
				{success && <p className="mt-4 text-sm text-green-600">Votre mot de passe a été changé avec succès</p>}
				<p className="mt-6 text-sm"><Link href="/login" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">← Retour à la connexion</Link></p>
			</motion.div>
		</div>
	);
}


