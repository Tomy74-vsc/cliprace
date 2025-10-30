import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/guards";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUserAndRole();
  if (!user) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}


