import { redirect } from "next/navigation";

export default function SignupAliasPage() {
  // Alias route to keep /signup working
  redirect("/auth/signup");
}