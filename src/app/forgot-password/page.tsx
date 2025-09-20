"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/login",
    });
    if (error) setErr(error.message);
    else setMsg("Email envoyé. Suis le lien pour réinitialiser ton mot de passe.");
  };

  return (
    <div aria-labelledby="forgot-title">
      <h1 id="forgot-title" className="text-2xl font-bold tracking-tight">Réinitialiser le mot de passe</h1>
      <p className="mt-1 text-sm text-zinc-500">
        <Link className="underline underline-offset-4" href="/login">Retour connexion</Link>
      </p>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
            value={email} onChange={(e)=>setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold px-6 py-3">
          Envoyer le lien
        </button>
        {err && <div role="alert" className="text-sm text-red-600">{err}</div>}
        {msg && <div role="status" className="text-sm text-emerald-600">{msg}</div>}
      </form>
    </div>
  );
}
