'use client';

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { TikTokLogo, InstagramLogo, YoutubeLogo } from './platform-logos';

type PlatformKey = 'tiktok' | 'instagram' | 'youtube';

export interface PlatformConnectInlineProps {
  connectedPlatforms: string[];
  className?: string;
}

type PlatformConfig = {
  key: PlatformKey;
  label: string;
  description: string;
  connectHref: string;
  brandColor: string;
  Logo: FC<{ className?: string; size?: number }>;
};

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'tiktok',
    label: 'TikTok',
    description: 'Connecte ta chaîne pour importer tes stats TikTok.',
    Logo: TikTokLogo,
    connectHref: '/api/auth/oauth/tiktok/connect',
    brandColor: '#ffffff',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Relie ton compte Instagram Reels / Creator.',
    Logo: InstagramLogo,
    connectHref: '/api/auth/oauth/instagram/connect',
    brandColor: '#E1306C',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    description: 'Connecte ta chaîne YouTube Shorts.',
    Logo: YoutubeLogo,
    connectHref: '/api/auth/oauth/youtube/connect',
    brandColor: '#FF0000',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export const PlatformConnectInline: FC<PlatformConnectInlineProps> = ({
  connectedPlatforms,
  className,
}) => {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const connectedSet = new Set(
    connectedPlatforms.map((p) => p.toLowerCase().trim() as PlatformKey),
  );

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Tes plateformes
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Optionnel
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Connecte tes comptes pour que ClipRace puisse lire tes stats.
      </p>

      <motion.div
        initial={prefersReduced ? 'show' : 'hidden'}
        animate="show"
        variants={
          prefersReduced
            ? undefined
            : {
                show: {
                  transition: { staggerChildren: 0.05 },
                },
              }
        }
        className="grid gap-2"
      >
        {PLATFORMS.map((platform, index) => {
          const isConnected = connectedSet.has(platform.key);
          const Logo = platform.Logo;

          return (
            <motion.div
              key={platform.key}
              variants={cardVariants}
              transition={
                prefersReduced
                  ? undefined
                  : { type: 'spring', stiffness: 300, damping: 30, delay: index * 0.05 }
              }
              className={[
                'flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3',
                !isConnected
                  ? 'cursor-pointer transition-all duration-150 hover:-translate-y-px hover:border-border'
                  : 'cursor-default',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                  <Logo
                    size={22}
                    className="text-foreground"
                    // Brand color only affects icon, not backgrounds
                    style={{ color: platform.brandColor }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {platform.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {platform.description}
                  </span>
                </div>
              </div>

              {isConnected ? (
                <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
                  ✓ Connecté
                </span>
              ) : (
                <a
                  href={platform.connectHref}
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={`Connecter ${platform.label}`}
                >
                  Connecter
                </a>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Shield className="h-3 w-3" aria-hidden="true" />
        <span className="text-xs">Lecture seule • Jamais de post en ton nom</span>
      </div>
    </div>
  );
};

