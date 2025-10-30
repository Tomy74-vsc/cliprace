"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type LoginInput } from "@/lib/schemas";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import SubmitButton from "@/components/auth/SubmitButton";
import { redirectToRole } from "@/lib/redirect";

export default function LoginForm() {
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const { toast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const msg = typeof data?.error === "string" ? data.error : "Connexion refusée.";
        setServerError(msg);
        toast({ title: "Connexion échouée", description: msg, variant: "error" });
        return;
      }

      if (data.accessToken && data.refreshToken) {
        await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });
      }
      // Récupérer l'utilisateur pour déterminer le rôle
      const { data: userData } = await supabase.auth.getUser();
      const role = (userData?.user?.user_metadata as any)?.role ?? null;
      router.replace(redirectToRole(role));
    } catch (e) {
      setServerError("Erreur réseau. Réessayez.");
      toast({ title: "Erreur réseau", description: "Veuillez réessayer", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-live="polite">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="you@example.com"
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email ? (
          <p id="email-error" className="mt-1 text-sm text-rose-600">
            {errors.email.message as string}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="••••••••"
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password ? (
          <p id="password-error" className="mt-1 text-sm text-rose-600">
            {errors.password.message as string}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {serverError}
        </div>
      ) : null}

      <SubmitButton loading={loading}>Se connecter</SubmitButton>

      <p className="text-center text-sm text-gray-500">
        Pas de compte ? <a className="text-violet-700 hover:underline" href="/signup">Créer un compte</a>
      </p>
    </form>
  );
}


