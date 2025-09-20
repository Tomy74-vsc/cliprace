"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AuthHeader } from "@/app/_components/AuthHeader";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function signInEmail() {
    setError(null);
    const { error } = await s.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else window.location.href = "/"; // on ajustera après vers /app selon le rôle
  }

  function signInOAuth(provider: "google" | "apple") {
    startTransition(async () => {
      const { error } = await s.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/callback` },
      });
      if (error) setError(error.message);
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4">
        <AuthHeader />
        <h1 className="text-center text-4xl font-black">Se connecter</h1>
        <p className="mt-2 text-center">
          Vous n’avez pas de compte ? <Link href="/signup" className="text-[#635BFF] underline">S’inscrire</Link>
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <input className="w-full rounded-xl border p-3" placeholder="E‑mail"
              type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Mot de passe"
              type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={signInEmail}
              disabled={pending}
              className="w-full rounded-full bg-[#635BFF] text-white font-semibold py-3 hover:bg-[#534BFF]"
            >
              Se connecter
            </button>
            <div className="text-center">
              <Link href="/forgot-password" className="text-sm underline">Mot de passe oublié ?</Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-center font-semibold mt-2">ou</div>
            <button onClick={() => signInOAuth("google")} className="w-full rounded-full border py-3 font-semibold bg-white hover:bg-zinc-50">
              <span className="inline-flex items-center gap-2 justify-center">
                <span>G</span> Continuer avec Google
              </span>
            </button>
            <button onClick={() => signInOAuth("apple")} className="w-full rounded-full border py-3 font-semibold bg-white hover:bg-zinc-50">
              <span className="inline-flex items-center gap-2 justify-center">
                <span></span> Continuer avec Apple
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
