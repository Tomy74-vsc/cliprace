"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { redirectToRole } from "@/lib/redirect";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getBrowserSupabase();
  const code = useMemo(() => params.get("code"), [params]);
  const [message, setMessage] = useState<string>("Chargement de votre session...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!code) {
          setError("Lien invalide ou expiré.");
          return;
        }

        // 1) Échange le code contre une session
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          setError(exErr.message || "Impossible d'initialiser la session");
          return;
        }

        setMessage("Session créée. Vérification du profil...");

        // 2) Récupérer l'utilisateur et le token
        const [{ data: u }, { data: s }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        const user = u?.user ?? null;
        const accessToken = s?.session?.access_token ?? null;

        if (!user || !accessToken) {
          setError("Impossible de récupérer la session utilisateur.");
          return;
        }

        const role = (user.user_metadata as any)?.role ?? null;

        // 3) Compléter le profil minimal si nécessaire (ou ping idempotent)
        const defaultName = user.user_metadata?.name
          || (user.email ? user.email.split("@")[0] : "Utilisateur");
        await fetch("/api/profile/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: defaultName, role }),
        }).catch(() => {});

        // 4) Rediriger selon le rôle
        const target = redirectToRole(role);
        if (!cancelled) {
          router.replace(target);
        }
      } catch (e) {
        setError("Une erreur est survenue. Réessayez.");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [code, router, supabase]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white/90 shadow-xl ring-1 ring-black/5 backdrop-blur px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Connexion en cours</h1>
        {error ? (
          <p className="mt-4 text-sm text-rose-600" aria-live="assertive">{error}</p>
        ) : (
          <p className="mt-4 text-sm text-gray-600" aria-live="polite">{message}</p>
        )}
      </div>
    </div>
  );
}


