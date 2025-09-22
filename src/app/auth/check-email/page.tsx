"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthHeader } from "../components/AuthHeader";
import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function CheckEmailPage() {
	const supabase = getBrowserSupabase();
	const [loading, setLoading] = useState(false);
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const email = useMemo(() => {
		if (typeof window === "undefined") return undefined;
		return new URLSearchParams(window.location.search).get("email") || undefined;
	}, []);

	async function resend() {
		if (!email) return;
		setError(null);
		setInfo(null);
		setLoading(true);
		const { error } = await supabase.auth.resend({ type: "signup", email });
		setLoading(false);
		if (error) setError(error.message);
		else setInfo("Email renvoyé.");
	}

	return (
		<div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900">
				<AuthHeader />
				<div className="flex flex-col items-center text-center">
					<MailCheck className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
					<h1 className="mt-2 text-2xl font-bold">Vérifiez votre email</h1>
					<p className="mt-3 text-zinc-600 dark:text-zinc-300">
						Un email de vérification a été envoyé{email ? ` à ${email}` : ""}. Veuillez cliquer sur le lien dans l’email pour activer votre compte.
					</p>
					<div className="mt-6 flex w-full items-center gap-3">
						<Button onClick={resend} disabled={loading || !email} className="flex-1">{loading ? "Envoi…" : "Renvoyer l’email"}</Button>
					</div>
					{info && <p className="mt-3 text-sm text-green-600">{info}</p>}
					{error && <p className="mt-3 text-sm text-red-600">{error}</p>}
					<p className="mt-6 text-sm"><Link href="/login" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">← Retour à la connexion</Link></p>
				</div>
			</motion.div>
		</div>
	);
}

