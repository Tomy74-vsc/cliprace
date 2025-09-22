"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AuthHeader } from "../auth/components/AuthHeader";
import { motion } from "framer-motion";
import Link from "next/link";

export default function ForgotPasswordPage() {
	const supabase = getBrowserSupabase();
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/login`,
		});
		setLoading(false);
		if (error) setError(error.message);
		else setSent(true);
	}

	return (
		<div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
				<AuthHeader />
				<h1 className="text-2xl font-bold tracking-tight">Réinitialiser le mot de passe</h1>
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Entrez votre adresse email, nous vous enverrons un lien de réinitialisation.</p>
				<form onSubmit={onSubmit} className="mt-6 grid gap-4">
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Email</label>
						<Input type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
						{error && <p className="mt-1 text-sm text-red-600">{error}</p>}
					</div>
					<Button type="submit" disabled={loading} className="w-full">{loading ? "Envoi…" : "Envoyer le lien"}</Button>
				</form>
				{sent && <p className="mt-4 text-sm text-green-600">Lien envoyé. Vérifiez votre boîte mail.</p>}
				<p className="mt-6 text-sm"><Link href="/login" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">← Retour à la connexion</Link></p>
			</motion.div>
		</div>
	);
}


