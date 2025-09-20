export default function ConfirmPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-20">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-extrabold">Vérifie ta boîte mail ✉️</h1>
        <p className="text-zinc-600">
          Nous t’avons envoyé un lien de confirmation. Clique dessus pour activer ton compte
          puis terminer l’onboarding.
        </p>
      </div>
    </main>
  );
}
