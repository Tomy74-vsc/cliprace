'use client';

import { Button } from '@/components/ui/button';

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 lg:px-8 py-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">Une erreur inattendue s’est produite. Réessaie.</p>
        {isDev() ? (
          <pre className="whitespace-pre-wrap rounded-xl bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
            {error?.message}
          </pre>
        ) : null}
        <Button onClick={() => reset()} variant="primary">
          Réessayer
        </Button>
      </div>
      {error?.digest ? (
        <p className="mt-3 text-xs text-muted-foreground">Id erreur : {error.digest}</p>
      ) : null}
    </main>
  );
}
