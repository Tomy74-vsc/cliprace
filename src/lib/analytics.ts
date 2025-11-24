/*
Client-side analytics stub for instrumentation.
Use: track('event_name', { contest_id, network, ... })
*/
'use client';

export function track(event: string, payload: Record<string, unknown> = {}) {
  try {
    if (typeof window === 'undefined') return;
    if ((window as any).analytics?.track) {
      (window as any).analytics.track(event, payload);
      return;
    }
    console.debug('[track]', event, payload);
  } catch (e) {
    console.error('track error', e);
  }
}
