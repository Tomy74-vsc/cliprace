'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import createGlobe from 'cobe';

import { cn } from '@/lib/utils';

export type GlobeMarker = {
  location: [number, number]; // [lat, lng]
  size: number;
};

export interface LiveCreatorMapProps {
  markers?: GlobeMarker[];
  className?: string;
}

const DEMO_MARKERS: GlobeMarker[] = [
  { location: [48.86, 2.35], size: 0.12 }, // Europe
  { location: [40.71, -74.0], size: 0.1 }, // US East
  { location: [34.05, -118.24], size: 0.08 }, // US West
];

export function LiveCreatorMap({ markers = DEMO_MARKERS, className }: LiveCreatorMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const normalizedMarkers = useMemo(() => {
    return markers.map((m) => ({
      location: m.location,
      size: Math.max(0.02, Math.min(0.22, m.size)),
    }));
  }, [markers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let phi = 0;
    let width = 0;
    let height = 0;
    let destroyed = false;

    const pointer = {
      down: false,
      startX: 0,
      phiOnDown: 0,
    };

    const updateSize = () => {
      if (!canvas) return;
      const nextWidth = canvas.offsetWidth;
      const nextHeight = canvas.offsetHeight;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
    };

    updateSize();
    setCanvasReady(true);

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
      width,
      height,
      phi,
      theta: 0.22,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 2.2,
      baseColor: [0.1, 0.1, 0.1],
      markerColor: [0.1, 1, 0.5],
      glowColor: [0.1, 1, 0.5],
      markers: normalizedMarkers,
      onRender: (state) => {
        if (destroyed) return;

        updateSize();
        state.width = width;
        state.height = height;

        if (!pointer.down) {
          phi += 0.005;
        }
        state.phi = phi;
      },
    });

    const handlePointerDown = (event: PointerEvent) => {
      pointer.down = true;
      pointer.startX = event.clientX;
      pointer.phiOnDown = phi;
      (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointer.down) return;
      const deltaX = event.clientX - pointer.startX;
      phi = pointer.phiOnDown + deltaX / 220;
    };

    const handlePointerUp = () => {
      pointer.down = false;
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(canvas);

    return () => {
      destroyed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      globe.destroy();
    };
  }, [normalizedMarkers]);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          'h-full w-full',
          canvasReady ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-700'
        )}
        aria-label="Globe des créateurs (live)"
      />
    </div>
  );
}

