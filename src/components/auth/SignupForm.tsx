"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignupSchema, type SignupInput } from "@/lib/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";
import RoleSelector from "@/components/auth/RoleSelector";
import PasswordStrength from "@/components/auth/PasswordStrength";
import SubmitButton from "@/components/auth/SubmitButton";
import { useToast } from "@/components/ui/toast";

export default function SignupForm() {
  const supabase = getBrowserSupabase();
  const { toast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SignupInput>({ resolver: zodResolver(SignupSchema), defaultValues: { role: "creator" } });

  async function onSubmit(values: SignupInput) {
    setServerError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 => déjà existant
        if (res.status === 409) {
          setServerError("Un compte existe déjà avec cet email.");
          toast({ title: "Email déjà utilisé", description: "Essayez de vous connecter", variant: "warning" });
        } else {
          const msg = typeof data?.error === "string" ? data.error : "Inscription impossible.";
          setServerError(msg);
          toast({ title: "Inscription échouée", description: msg, variant: "error" });
        }
        return;
      }
      setEmailSent(values.email);
      toast({ title: "Vérifiez votre e-mail", description: "Cliquez sur le lien reçu pour confirmer" , variant: "success"});
    } catch (e) {
      setServerError("Erreur réseau. Réessayez.");
      toast({ title: "Erreur réseau", description: "Veuillez réessayer", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!emailSent) return;
    try {
      await supabase.auth.resend({ type: "signup", email: emailSent });
    } catch {
      // silencieux
    }
  }

  const role = watch("role");

  if (emailSent) {
    return (
      <div className="space-y-4" aria-live="polite">
        <div className="rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-900">
          Confirmez votre e-mail pour continuer.
        </div>
        <p className="text-sm text-gray-600">
          Nous avons envoyé un lien de confirmation à <span className="font-medium">{emailSent}</span>.
          Cliquez sur le lien pour activer votre compte.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resend}
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-violet-600/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            Renvoyer l'email
          </button>
          <a className="text-sm text-violet-700 hover:underline" href="/login">Déjà confirmé ? Se connecter</a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-live="polite">
      <div>
        <span className="block text-sm font-medium text-gray-700">Rôle</span>
        <div className="mt-2">
          <RoleSelector value={role as "creator" | "brand"} onChange={(r) => setValue("role", r, { shouldDirty: true, shouldTouch: true })} />
        </div>
        {/* bind RoleSelector to RHF */}
        <input type="hidden" value={role} {...register("role")} readOnly />
      </div>

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
          autoComplete="new-password"
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
        ) : (
          <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères, lettres et chiffres.</p>
        )}
        <PasswordStrength password={watch("password") || ""} />
      </div>

      {serverError ? (
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {serverError}
        </div>
      ) : null}

      <SubmitButton loading={loading}>Créer un compte</SubmitButton>

      <p className="text-center text-sm text-gray-500">
        Déjà inscrit ? <a className="text-violet-700 hover:underline" href="/login">Se connecter</a>
      </p>
    </form>
  );
}


