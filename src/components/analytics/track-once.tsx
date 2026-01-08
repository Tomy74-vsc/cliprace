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
  href,
  ...props
}: ComponentProps<'a'> & { href: string; event: string; payload?: Record<string, unknown> }) {
  return (
    <a
      href={href}
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
