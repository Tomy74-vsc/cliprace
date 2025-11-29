/*
Client-side analytics stub for instrumentation.
Use: track('event_name', { contest_id, network, ... })
*/
'use client';

export function track(event: string, payload: Record<string, unknown> = {}) {
  try {
    if (typeof window === 'undefined') return;
    const globalAny = window as any;
    if (globalAny.analytics?.track) {
      globalAny.analytics.track(event, payload);
    } else if (globalAny.dispatchEvent) {
      globalAny.dispatchEvent(new CustomEvent('analytics', { detail: { event, payload } }));
    } else {
      console.debug('[track]', event, payload);
    }
  } catch (e) {
    console.error('track error', e);
  }
}
