'use client';

import type { ReactElement } from 'react';
import { ErrorState } from '@/components/brand-ui';

export default function BrandDashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}): ReactElement {
  return (
    <div className="brand-scope max-w-7xl mx-auto px-6 py-8">
      <ErrorState
        title="Dashboard unavailable"
        description="We couldn't load your dashboard. Please try again."
        retry={() => reset()}
        error={error}
      />
    </div>
  );
}

