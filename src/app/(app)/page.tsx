import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/guards";
import { redirectToRole } from "@/lib/redirect";

export default async function AppHome() {
  const { user, role } = await getUserAndRole();
  if (!user) {
    redirect("/login");
  }
  redirect(redirectToRole(role));
}


