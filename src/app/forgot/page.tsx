"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthHeader } from "../auth/components/AuthHeader";
import { motion } from "framer-motion";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { ForgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const response = await fetch("/api/auth/forgot-password", {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError("root", { message: result.error || "Erreur lors de l'envoi" });
        toast({
          title: "Erreur",
          description: result.error || "Erreur lors de l'envoi",
          variant: "error",
        });
        return;
      }

      setSent(true);
      toast({
        title: "Email envoyé",
        description: result.message || "Vérifiez votre boîte mail",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur lors de la demande de réinitialisation:", error);
      setError("root", { message: "Erreur inattendue" });
      toast({
        title: "Erreur",
        description: "Erreur inattendue lors de l'envoi",
        variant: "error",
      });
    }
  };

  return (
    <div className="min-h-[calc(100svh-0px)] grid place-items-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }} 
        className="w-full md:max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-900"
      >
        <AuthHeader />
        <h1 className="text-2xl font-bold tracking-tight">Réinitialiser le mot de passe</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Entrez votre adresse email, nous vous enverrons un lien de réinitialisation.
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate>
            <div>
              <label 
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Email
              </label>
              <Input 
                id="email"
                type="email" 
                placeholder="vous@exemple.com" 
                {...register("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {errors.root && (
              <div 
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm text-red-600 dark:text-red-400">
                  {errors.root.message}
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </form>
        ) : (
          <div className="mt-6">
            <div 
              className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              role="alert"
            >
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Email envoyé avec succès !
              </p>
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                Si un compte existe avec cet email, vous recevrez un lien de réinitialisation. 
                Vérifiez votre boîte mail (et vos spams).
              </p>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-center">
          <Link 
            href="/login" 
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
          >
            ← Retour à la connexion
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
