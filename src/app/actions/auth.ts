"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Schémas de validation
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères min."),
  role: z.enum(["brand", "creator"]),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type ActionState = { ok: boolean; message?: string; issues?: string[] };

export async function signupAction(
  _: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const supabase = createSupabaseServerClient();

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => i.message) };
  }
  const { email, password, role } = parsed.data;

  // 1) Sign up + metadata {role}
  const { data: sign, error: signErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.SUPABASE_REDIRECT_URL || `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
      data: { role }, // user_metadata.role
    },
  });
  if (signErr) return { ok: false, message: signErr.message };

  // Dev: si email auto-confirmé côté dashboard, on a une session directe
  // 2) Récupérer le user & insérer un profil (RLS: user_id = auth.uid())
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? sign.user;
  if (user?.id) {
    if (role === "brand") {
      await supabase.from("profiles_brand").insert({
        user_id: user.id,
        company_name: "",
        legal_name: "",
        country: "FR",
      });
    } else {
      await supabase.from("profiles_creator").insert({
        user_id: user.id,
        handle: "",
        country: "FR",
      });
    }
  }

  // Redirections post-signup
  if (role === "brand") redirect("/onboarding/brand");
  if (role === "creator") redirect("/onboarding/creator");
  return { ok: true };
}

export async function loginAction(
  _: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const supabase = createSupabaseServerClient();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => i.message) };
  }
  const { email, password } = parsed.data;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };

  // Récup rôle et admin pour router intelligemment
  const { data: u } = await supabase.auth.getUser();
  type UserMetadata = { role?: "brand" | "creator" };
  const role = (u?.user?.user_metadata as UserMetadata)?.role;

  // admin → /admin, sinon on route par rôle
  const { data: isAdmin } = await supabase.rpc("is_admin", { uid: u?.user?.id ?? null });
  if (isAdmin) redirect("/admin");

  if (role === "brand") redirect("/dashboard/brand");
  if (role === "creator") redirect("/dashboard/creator");

  // fallback si pas de rôle (ex: vieux compte)
  redirect("/");
}

export async function logoutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
