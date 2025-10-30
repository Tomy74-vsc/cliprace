import LoginForm from "@/components/auth/LoginForm";
import { Card } from "@/components/auth/ui/Card";

export const metadata = {
  title: "Connexion",
};

export default function Page() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <Card title="Bienvenue 👋" subtitle="Connectez-vous pour continuer">
        <LoginForm />
      </Card>
    </div>
  );
}


