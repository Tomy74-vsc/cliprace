'use client';

import { Button } from '@/components/ui/button';

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
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={() => reset()} variant="primary">
          Retry
        </Button>
      </div>
      {error?.digest ? (
        <p className="mt-3 text-xs text-muted-foreground">Error id: {error.digest}</p>
      ) : null}
    </main>
  );
}
