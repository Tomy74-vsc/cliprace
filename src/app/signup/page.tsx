"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AuthHeader } from "@/app/_components/AuthHeader";
import { createClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function signUpEmail() {
    setError(null);
    if (email !== email2) return setError("Les e‑mails ne correspondent pas.");
    if (password !== password2) return setError("Les mots de passe ne correspondent pas.");
    const { error } = await s.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`,
        data: { source: "email" },
      },
    });
    if (error) setError(error.message);
    // Supabase envoie l’e‑mail de confirmation. On affiche un message simple.
    else window.location.href = "/verify-email";
  }

  function signInOAuth(provider: "google" | "apple") {
    setError(null);
    startTransition(async () => {
      const { error } = await s.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/callback`,
          queryParams: provider === "apple" ? { response_mode: "form_post" } : {},
        },
      });
      if (error) setError(error.message);
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4">
        <AuthHeader />
        <h1 className="text-center text-4xl font-black">S’inscrire</h1>
        <p className="mt-2 text-center">
          Vous avez déjà un compte ? <Link href="/login" className="text-[#635BFF] underline">Se connecter</Link>
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {/* Colonne formulaire email */}
          <div className="space-y-3">
            <input className="w-full rounded-xl border p-3" placeholder="E‑mail"
              type="email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Confirmer votre e‑mail"
              type="email" value={email2} onChange={e=>setEmail2(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Choisir un mot de passe"
              type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Confirmer votre mot de passe"
              type="password" value={password2} onChange={e=>setPassword2(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={signUpEmail}
              disabled={pending}
              className="w-full rounded-full bg-[#635BFF] text-white font-semibold py-3 hover:bg-[#534BFF]"
            >
              S’inscrire
            </button>
            <p className="text-xs text-zinc-500">
              En vous inscrivant, vous acceptez nos Conditions et notre Politique de confidentialité.
            </p>
          </div>

          {/* Colonne OAuth */}
          <div className="space-y-4">
            <div className="text-center font-semibold mt-2">ou</div>
            <button
              onClick={() => signInOAuth("google")}
              className="w-full rounded-full border py-3 font-semibold bg-white hover:bg-zinc-50"
            >
              <span className="inline-flex items-center gap-2 justify-center">
                <span>G</span> Continuer avec Google
              </span>
            </button>
            <button
              onClick={() => signInOAuth("apple")}
              className="w-full rounded-full border py-3 font-semibold bg-white hover:bg-zinc-50"
            >
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
