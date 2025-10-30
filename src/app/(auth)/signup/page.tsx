"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { SignupSchema, type SignupInput } from "@/lib/schemas";

type Step = 1 | 2;

export default function SignupPage() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState<string>("");
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
    trigger,
    watch,
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { email: "", password: "", role: "creator" },
    mode: "onBlur",
  });
  const currentRole = watch("role");

  const onSubmit = useCallback(
    async (values: SignupInput) => {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: values.email, password: values.password, role: values.role }),
        });
        type SignupRes = { success?: boolean; error?: string };
        const result = (await res.json().catch(() => null)) as SignupRes | null;
        if (!res.ok || result?.success !== true) {
          const raw = typeof result?.error === "string" ? result.error : "Creation impossible.";
          const isTaken = res.status === 409 || /already|existe/i.test(raw);
          toast({ title: "Echec", description: isTaken ? "Adresse deja utilisee." : raw, variant: "error" });
          if (isTaken) setError("email", { type: "manual", message: "Adresse deja utilisee" });
          return;
        }
        setEmail(values.email);
        toast({ title: "Verifiez votre email", description: "Un lien de confirmation a ete envoye." });
        setStep(2);
      } catch (e) {
        toast({ title: "Erreur", description: "Creation impossible.", variant: "error" });
      }
    },
    [setError, toast],
  );

  // Sauvegarde locale du wizard
  const handleSaveForLater = useCallback(() => {
    try {
      const draft = {
        email: (document.getElementById('email') as HTMLInputElement)?.value || "",
        password: (document.getElementById('password') as HTMLInputElement)?.value || "",
        role: currentRole,
        ts: Date.now(),
      };
      localStorage.setItem('signup_draft', JSON.stringify(draft));
      toast({ title: "Brouillon sauvegarde", description: "Vous pourrez reprendre plus tard." });
    } catch {
      toast({ title: "Impossible de sauvegarder", variant: "error" });
    }
  }, [currentRole, toast]);

  // Timer de 10 minutes pour la vérification email
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (step !== 2) return;
    const started = Date.now();
    const it = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(it);
  }, [step]);
  const tenMinutes = 10 * 60 * 1000;

  const handleResend = useCallback(async () => {
    if (!email) return;
    try {
      await supabase.auth.resend({ type: "signup", email });
      toast({ title: "Email renvoye" });
    } catch (e) {
      toast({ title: "Renvoi impossible", description: "Reessayez.", variant: "error" });
    }
  }, [email, supabase, toast]);

  const handleContinue = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const confirmed = Boolean(data?.user?.email_confirmed_at);
      if (confirmed && typeof window !== "undefined") window.location.replace("/");
      if (!confirmed) toast({ title: "Email non confirme", description: "Cliquez sur le lien recu par email." });
    } catch {
      toast({ title: "Verification indisponible", variant: "error" });
    }
  }, [supabase, toast]);

  return (
    <div className="mx-auto max-w-md space-y-8 p-6">
      <header className="space-y-2 text-left">
        <h1 className="text-2xl font-semibold">Inscription</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Creez votre compte.</p>
      </header>
      {step === 1 ? (
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate aria-live="polite">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} />
          {errors.email ? (<p className="text-sm text-rose-600" role="alert" aria-live="polite">{errors.email.message}</p>) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
          {errors.password ? (<p className="text-sm text-rose-600" role="alert" aria-live="polite">{errors.password.message}</p>) : null}
          </div>
          {/* Confirmation de mot de passe retirée pour coller au schéma minimal */}
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choisissez votre role">
              {(["creator","brand"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setValue("role", r, { shouldDirty: true, shouldTouch: true, shouldValidate: true }); trigger("role"); }}
                  className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-violet-500 ${currentRole===r?"border-violet-400 bg-violet-50 text-violet-800":"border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  role="button"
                  aria-pressed={currentRole===r}
                >
                  {r === 'creator' ? 'Createur' : 'Marque'}
                </button>
              ))}
            </div>
            {/* bind RHF field so role value is submitted (RHF controls the value via setValue) */}
            <input type="hidden" {...register("role")} />
          </div>
          <div className="flex items-center gap-2">
          <Button type="submit" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (<><Loader2 className="mr-2 size-4 animate-spin" />Creation...</>) : ("Continuer")}
          </Button>
          <Button type="button" variant="outline" onClick={handleSaveForLater}>Reprendre plus tard</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <p className="text-sm">Nous avons envoye un lien de confirmation a <span className="font-medium">{email}</span>.</p>
          <p className="text-xs text-zinc-600">Le lien peut expirer sous 10 min. {elapsed > tenMinutes ? <span className="text-rose-600">Le delai est depasse, renvoyez l'email.</span> : null}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleResend}>Renvoyer</Button>
            <Button type="button" onClick={handleContinue}>Continuer</Button>
          </div>
        </div>
      )}
    </div>
  );
}
