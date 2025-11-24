/*
Component: ContestCard
Affiche une carte concours pour Discover / listings créateur avec fallback cover/logo.
*/
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trophy, Clock } from 'lucide-react';
import type { Platform } from '@/lib/validators/platforms';

function formatTimeRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `dans ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `dans ${hours} heure${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `dans ${minutes} minute${minutes > 1 ? 's' : ''}`;
  return 'bientôt';
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

export interface ContestCardData {
  id: string;
  title: string;
  slug: string;
  brief_md?: string | null;
  cover_url?: string | null;
  prize_pool_cents: number;
  currency: string;
  start_at: string;
  end_at: string;
  networks: Platform[];
  status: 'draft' | 'active' | 'paused' | 'ended' | 'archived';
  brand?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface ContestCardProps {
  contest: ContestCardData;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  tiktok: 'bg-black text-white',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  youtube: 'bg-red-600 text-white',
};

export function ContestCard({ contest }: ContestCardProps) {
  const isActive = contest.status === 'active';
  const isEnded = contest.status === 'ended' || contest.status === 'archived';
  const endDate = new Date(contest.end_at);
  const timeRemaining = isActive ? formatTimeRemaining(endDate) : null;

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      import('@/lib/analytics').then(({ track }) =>
        track('view_contest', { contest_id: contest.id, status: contest.status })
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="h-full"
      onClick={handleClick}
    >
      <Link href={`/app/creator/contests/${contest.id}`}>
        <Card className="group h-full transition-all duration-300 hover:shadow-card-hover overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-accent/0 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none z-0" />

          <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
            {contest.cover_url ? (
              <Image
                src={contest.cover_url}
                alt={contest.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15">
                <span className="text-sm font-semibold text-muted-foreground">Concours ClipRace</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {isActive && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
                <Badge variant="success" className="shadow-lg backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Actif
                </Badge>
              </motion.div>
            )}
            {isEnded && (
              <div className="absolute top-3 right-3">
                <Badge variant="default" className="shadow-lg backdrop-blur-sm">
                  Terminé
                </Badge>
              </div>
            )}
          </div>

          <CardContent className="p-5 relative z-10">
            <h3 className="mb-2 line-clamp-2 text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300">
              {contest.title}
            </h3>
            {contest.brief_md && (
              <div
                className="mb-4 line-clamp-2 text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                aria-label="Résumé du concours"
              >
                <ReactMarkdown
                  rehypePlugins={[rehypeSanitize]}
                  components={{ p: ({ children }) => <span>{children}</span> }}
                >
                  {contest.brief_md.slice(0, 280)}
                </ReactMarkdown>
              </div>
            )}
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              {contest.brand?.avatar_url ? (
                <motion.div whileHover={{ scale: 1.05 }} className="relative">
                  <Image
                    src={contest.brand.avatar_url}
                    alt={contest.brand.display_name || 'Marque'}
                    width={20}
                    height={20}
                    className="rounded-full ring-2 ring-border"
                  />
                </motion.div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {contest.brand?.display_name?.[0] ?? 'C'}
                </div>
              )}
              <span className="font-medium">{contest.brand?.display_name || 'Marque'}</span>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-primary" />
                <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {formatCurrency(contest.prize_pool_cents, contest.currency)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">À gagner</div>
            </div>

            {contest.networks.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {contest.networks.map((platform) => (
                  <motion.div key={platform} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Badge variant="default" className={`text-xs font-medium ${PLATFORM_COLORS[platform]} shadow-sm`}>
                      {PLATFORM_LABELS[platform]}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}

            {timeRemaining && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Se termine {timeRemaining}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-border p-4 bg-muted/40 relative z-10">
            <div className="w-full">
              {isActive ? (
                <motion.div
                  className="flex items-center justify-between"
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <span className="text-sm font-semibold text-foreground">Participer</span>
                  <motion.span
                    className="text-sm text-primary"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    → 
                  </motion.span>
                </motion.div>
              ) : (
                <span className="text-sm text-muted-foreground">Voir les détails</span>
              )}
            </div>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
