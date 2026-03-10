'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function computeRemaining(target: Date): CountdownParts {
  const now = Date.now();
  const end = target.getTime();
  if (end <= now) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
  const diff = end - now;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);
  return { days, hours, minutes, seconds, isExpired: false };
}

/**
 * Countdown to a target date. Uses setInterval (1s) with clearInterval on cleanup.
 * @param targetDate ISO string or Date; null = no countdown (caller shows "lancement imminent")
 */
export function useCountdown(targetDate: string | Date | null): CountdownParts | null {
  const [parts, setParts] = useState<CountdownParts | null>(() => {
    if (targetDate == null) return null;
    const t = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    return computeRemaining(t);
  });

  const update = useCallback(() => {
    if (targetDate == null) return;
    const t = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    setParts(computeRemaining(t));
  }, [targetDate]);

  useEffect(() => {
    if (targetDate == null) return;
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate, update]);

  return parts;
}
