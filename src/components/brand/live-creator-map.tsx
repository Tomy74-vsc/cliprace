'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface CreatorPin {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface LiveCreatorMapProps {
  /** List of creator locations (lat/lng). If empty, uses demo points. */
  creators?: CreatorPin[];
  className?: string;
}

// Equirectangular: x = (lng + 180) / 360 * width, y = (90 - lat) / 180 * height
function latLngToXY(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

const DEMO_PINS: CreatorPin[] = [
  { id: '1', lat: 48.86, lng: 2.35, label: 'Paris' },
  { id: '2', lat: 51.5, lng: -0.12, label: 'London' },
  { id: '3', lat: 40.71, lng: -74.0, label: 'New York' },
  { id: '4', lat: 34.05, lng: -118.24, label: 'Los Angeles' },
  { id: '5', lat: 35.68, lng: 139.69, label: 'Tokyo' },
  { id: '6', lat: -33.87, lng: 151.21, label: 'Sydney' },
  { id: '7', lat: 45.46, lng: 9.19, label: 'Milan' },
  { id: '8', lat: 52.52, lng: 13.4, label: 'Berlin' },
];

export function LiveCreatorMap({ creators = DEMO_PINS, className }: LiveCreatorMapProps) {
  const width = 640;
  const height = 320;

  const pins = useMemo(() => {
    return creators.map((c) => ({
      ...c,
      ...latLngToXY(c.lat, c.lng, width, height),
    }));
  }, [creators]);

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-muted/20 overflow-hidden',
        className
      )}
    >
      {/* Carte monde simplifiée (fond) */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full min-h-[200px]"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={0.1} />
          </linearGradient>
          <radialGradient id="pin-glow">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#ocean)" />
        {/* Forme continent simplifiée (Europe + Amériques + reste schématique) */}
        <path
          d="M 180 120 L 320 100 L 420 140 L 480 120 L 520 160 L 500 200 L 380 180 L 280 200 L 200 180 Z M 120 140 L 200 120 L 240 180 L 180 220 Z M 380 200 L 520 220 L 560 260 L 480 280 L 400 240 Z M 140 240 L 220 260 L 200 300 L 120 280 Z"
          fill="hsl(var(--muted))"
          fillOpacity={0.25}
          stroke="hsl(var(--border))"
          strokeWidth={0.5}
          strokeOpacity={0.5}
        />
        {/* Pins pulsants */}
        {pins.map((pin) => (
          <g key={pin.id} transform={`translate(${pin.x}, ${pin.y})`}>
            <circle
              r="24"
              fill="url(#pin-glow)"
              className="animate-ping"
              style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}
            />
            <circle r="8" fill="hsl(var(--primary))" stroke="white" strokeWidth="2" />
            <circle r="4" fill="white" opacity={0.9} />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Créateurs actifs (live)</span>
        <span>{pins.length} point{pins.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
