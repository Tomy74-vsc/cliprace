import { redirect } from "next/navigation";

export default function LoginAliasPage() {
  // Alias route to keep /login working
  redirect("/auth/login");
}