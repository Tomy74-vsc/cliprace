"use client";

import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LoginSchema, type LoginInput } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = useCallback(
    async (values: LoginInput) => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: values.email, password: values.password }),
        });

        type LoginRes = {
          success?: boolean;
          error?: string;
          accessToken?: string;
          refreshToken?: string;
          redirect?: string;
        };
        const result = (await response.json().catch(() => null)) as LoginRes | null;
        if (!response.ok || !result?.success) {
          const message = typeof result?.error === "string" ? result.error : "Connexion impossible.";
          toast({ title: "Echec", description: message, variant: "error" });
          setError("password", { type: "manual", message: "Verifier vos identifiants." });
          return;
        }

        try {
          if (typeof result.accessToken === "string" && typeof result.refreshToken === "string") {
            const { error } = await supabase.auth.setSession({
              access_token: result.accessToken,
              refresh_token: result.refreshToken,
            });
            if (error) throw error;
          }
        } catch (e) {
          toast({ title: "Session indisponible", description: "Reessayez.", variant: "error" });
          return;
        }

        const redirect = typeof result.redirect === "string" ? result.redirect : "/";
        if (typeof window !== "undefined") window.location.replace(redirect);
      } catch (error) {
        toast({ title: "Erreur", description: "Connexion impossible.", variant: "error" });
      }
    },
    [setError, supabase, toast],
  );

  return (
    <div className="mx-auto max-w-md space-y-8 p-6">
      <header className="space-y-2 text-left">
        <h1 className="text-2xl font-semibold">Se connecter</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Accedez a votre espace.</p>
      </header>
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate aria-live="polite">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email ? (
            <p className="text-sm text-rose-600" role="alert" aria-live="polite">{errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={!!errors.password} />
          {errors.password ? (
            <p className="text-sm text-rose-600" role="alert" aria-live="polite">{errors.password.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Connexion...
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>
    </div>
  );
}
