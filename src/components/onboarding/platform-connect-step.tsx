'use client';

import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/brand-ui/StatusBadge';
import type { OAuthPlatform } from '@/lib/oauth/platforms';

type ConnectedPlatform = {
  platform: string;
  handle: string | null;
};

interface PlatformConnectStepProps {
  connectedPlatforms: ConnectedPlatform[];
  onSkip: () => void;
  onContinue: () => void;
}

const PLATFORM_ORDER: OAuthPlatform[] = ['tiktok', 'instagram', 'youtube'];

function platformLabel(platform: OAuthPlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    default:
      return platform;
  }
}

function platformDescription(platform: OAuthPlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'Synchronise tes vidéos TikTok pour les concours.';
    case 'instagram':
      return 'Connecte ton compte Reels / Creator Instagram.';
    case 'youtube':
      return 'Ajoute ta chaîne YouTube Shorts.';
    default:
      return '';
  }
}

function platformIcon(platform: OAuthPlatform) {
  const base = 'h-5 w-5';
  switch (platform) {
    case 'tiktok':
      return (
        <span
          aria-hidden="true"
          className={`${base} rounded-full bg-[radial-gradient(circle_at_30%_30%,#25F4EE_0,#25F4EE_30%,transparent_60%),radial-gradient(circle_at_70%_70%,#FE2C55_0,#FE2C55_35%,transparent_60%)]`}
        />
      );
    case 'instagram':
      return (
        <span
          aria-hidden="true"
          className={`${base} rounded-[10px] bg-[radial-gradient(circle_at_30%_30%,#FEDA77_0,#F58529_25%,#DD2A7B_55%,#8134AF_75%,#515BD4_100%)]`}
        />
      );
    case 'youtube':
      return (
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center rounded-[8px] bg-[#FF0000] px-1.5 py-1"
        >
          <span className="block h-2.5 w-3.5 rounded-[4px] bg-white">
            <span className="block h-0 w-0 translate-x-[2px] translate-y-[3px] border-y-[5px] border-l-[8px] border-y-transparent border-l-[#FF0000]" />
          </span>
        </span>
      );
    default:
      return null;
  }
}

export function PlatformConnectStep({
  connectedPlatforms,
  onSkip,
  onContinue,
}: PlatformConnectStepProps) {
  const [localConnections, setLocalConnections] = useState<ConnectedPlatform[]>(connectedPlatforms);

  const connectedMap = useMemo(() => {
    const map = new Map<string, ConnectedPlatform>();
    for (const item of localConnections) {
      if (item.platform) {
        map.set(item.platform, item);
      }
    }
    return map;
  }, [localConnections]);

  useEffect(() => {
    setLocalConnections(connectedPlatforms);
  }, [connectedPlatforms]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('connected');
    const platform = url.searchParams.get('platform') as OAuthPlatform | null;

    if (connected === 'true' && platform && PLATFORM_ORDER.includes(platform)) {
      setLocalConnections((prev) => {
        const exists = prev.find((p) => p.platform === platform);
        if (exists) return prev;
        return [...prev, { platform, handle: null }];
      });
    }
  }, []);

  const handleConnect = (platform: OAuthPlatform) => {
    if (typeof window === 'undefined') return;
    window.location.href = `/api/auth/oauth/${platform}/connect`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[var(--text-1)]">
          Connecte tes plateformes
        </h3>
        <p className="text-sm text-[var(--text-2)]">
          Connecte tes comptes sociaux pour que les marques puissent vérifier tes profils
          et suivre automatiquement tes performances.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORM_ORDER.map((platform) => {
          const connection = connectedMap.get(platform);
          const isConnected = !!connection;
          const handle = connection?.handle ?? null;

          return (
            <div
              key={platform}
              className="flex flex-col justify-between rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {platformIcon(platform)}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--text-1)]">
                        {platformLabel(platform)}
                      </span>
                      <span className="text-xs text-[var(--text-3)]">
                        {platformDescription(platform)}
                      </span>
                    </div>
                  </div>
                  {isConnected && (
                    <StatusBadge
                      variant="success"
                      label="Connecté"
                      pulse={false}
                    />
                  )}
                </div>

                {isConnected && handle && (
                  <p className="text-xs text-[var(--text-2)] truncate">
                    <span className="text-[var(--text-3)]">Compte:&nbsp;</span>
                    <span className="font-medium text-[var(--brand-success)]">
                      {handle.startsWith('@') ? handle : `@${handle}`}
                    </span>
                  </p>
                )}
              </div>

              {!isConnected && (
                <button
                  type="button"
                  onClick={() => handleConnect(platform)}
                  className="mt-4 inline-flex items-center justify-center rounded-[999px] border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                >
                  Connecter
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-3)]">
        Tu peux connecter tes plateformes plus tard dans les Paramètres si tu préfères.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium text-[var(--text-2)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Passer cette étape
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center rounded-[999px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

