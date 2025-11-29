'use client';

import { useEffect, type ComponentProps } from 'react';
import { track } from '@/lib/analytics';

export function TrackOnView({
  event,
  payload,
}: {
  event: string;
  payload?: Record<string, unknown>;
}) {
  useEffect(() => {
    track(event, payload ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}

export function TrackedLink({
  event,
  payload,
  children,
  ...props
}: ComponentProps<'a'> & { event: string; payload?: Record<string, unknown> }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        track(event, payload ?? {});
      }}
    >
      {children}
    </a>
  );
}
