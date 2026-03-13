'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/brand-ui';

export default function BrandContestDetailError({
  reset,
}: {
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: could log to an error reporting service here.
  }, []);

  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-8">
      <ErrorState
        title="Campaign unavailable"
        description="We couldn't load this campaign. Please try again."
        retry={reset}
      />
    </div>
  );
}

