import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();

  // 1) Session user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/admin"); // pas connecté → login
  }

  // 2) Check is_admin (RPC SQL déjà créée dans tes migrations)
  const { data: isAdmin, error } = await supabase.rpc("is_admin", { uid: user.id });
  if (error) {
    // Sécurité : si erreur RPC, on refuse l’accès
    console.error("is_admin RPC error:", error.message);
    redirect("/"); 
  }

  if (!isAdmin) {
    redirect("/"); // connecté mais non-admin → page d’accueil
  }

  // 3) OK: on rend l’espace admin
  return <>{children}</>;
}
