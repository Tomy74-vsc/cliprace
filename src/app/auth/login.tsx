"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // TODO: remplace par ton appel server action / API
      await new Promise((r) => setTimeout(r, 600));
      console.log("LOGIN", { email, pwd });
      // redirect ici si besoin
    } catch {
      setErr("Impossible de vous connecter. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 hero-surface">
      <div className="w-full max-w-md">
        <header className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#635BFF]" />
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Connexion</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Accédez à votre compte ClipRace.
          </p>
        </header>

        <form onSubmit={onSubmit} className="mt-8 space-y-5 feature-card p-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 outline-none focus:ring-2 focus:ring-[#635BFF]"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Mot de passe
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-[#635BFF] hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <div className="mt-2 relative">
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-[#635BFF]"
                placeholder="Votre mot de passe"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPwd ? true : false}
              >
                {showPwd ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          {err && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${loading ? "opacity-90" : ""} inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#635BFF] hover:bg-[#534BFF] text-white font-semibold shadow-[0_10px_25px_-10px_rgba(99,91,255,0.6)] transition`}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
            Pas encore de compte ?{" "}
            <Link href="/auth/signup" className="font-semibold text-[#635BFF] hover:underline">
              Créer un compte
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
