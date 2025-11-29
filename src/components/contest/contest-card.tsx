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
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { PlatformBadge, getPlatformLabel } from '@/components/creator/platform-badge';

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

function formatPrize(amount: number, currency: string): string {
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
  min_followers?: number | null;
  min_views?: number | null;
  eligibility?: { ok: boolean; reasons?: string[] };
  brand?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface ContestCardProps {
  contest: ContestCardData;
}

export function ContestCard({ contest }: ContestCardProps) {
  const isActive = contest.status === 'active';
  const isEnded = contest.status === 'ended' || contest.status === 'archived';
  const endDate = new Date(contest.end_at);
  const timeRemaining = isActive ? formatTimeRemaining(endDate) : null;
  const eligibility = contest.eligibility;

  const handleClick = () => {
    track('view_contest', { contest_id: contest.id, status: contest.status });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full transition-transform md:hover:-translate-y-1"
      onClick={handleClick}
    >
      <Link href={`/app/creator/contests/${contest.id}`}>
        <Card className="group h-full overflow-hidden relative transition-all duration-300 hover:shadow-card-hover">
          <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/0 via-accent/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

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
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
              {isActive && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Badge variant="success" className="shadow-lg backdrop-blur-sm">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Actif
                  </Badge>
                </motion.div>
              )}
              {isEnded && (
                <Badge variant="default" className="shadow-lg backdrop-blur-sm">
                  Terminé
                </Badge>
              )}
              {timeRemaining && !isEnded && (
                <Badge className="bg-muted/60 text-foreground shadow-sm backdrop-blur-sm">
                  <Clock className="mr-1 h-3 w-3" />
                  Se termine {timeRemaining}
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="relative z-10 p-5">
            <h3 className="mb-2 line-clamp-2 text-lg font-bold text-foreground transition-colors duration-300 group-hover:text-primary">
              {contest.title}
            </h3>
            {contest.brief_md && (
              <div
                className="prose prose-sm mb-4 line-clamp-2 max-w-none text-sm text-muted-foreground dark:prose-invert"
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/30 text-xs font-semibold text-primary">
                  {contest.brand?.display_name?.slice(0, 2).toUpperCase() ?? 'CR'}
                </div>
              )}
              <span className="font-medium">{contest.brand?.display_name || 'Marque'}</span>
            </div>

            <div className="mb-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-2xl font-bold text-transparent">
                  {formatPrize(contest.prize_pool_cents, contest.currency)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">À gagner</div>
            </div>

            {contest.networks.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {contest.networks.map((platform) => (
                  <motion.div key={platform} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <PlatformBadge platform={platform} />
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {contest.min_followers ? (
                <Badge variant="secondary">
                  Min {contest.min_followers.toLocaleString('fr-FR')} followers
                </Badge>
              ) : null}
              {contest.min_views ? (
                <Badge variant="secondary">
                  Min {contest.min_views.toLocaleString('fr-FR')} vues moy.
                </Badge>
              ) : null}
              {eligibility ? (
                <Badge variant={eligibility.ok ? 'success' : 'warning'}>
                  {eligibility.ok ? 'Éligibilité : OK' : 'Éligibilité : manquants'}
                </Badge>
              ) : null}
            </div>

            {timeRemaining && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Se termine {timeRemaining}</span>
              </div>
            )}
          </CardContent>

          <CardFooter className="relative z-10 flex w-full items-center justify-between gap-3 border-t border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {contest.networks.slice(0, 2).map((p) => getPlatformLabel(p)).join(' · ')}
            </div>
            <Button asChild size="sm" variant={isActive ? 'primary' : 'secondary'}>
              <Link href={`/app/creator/contests/${contest.id}`}>
                {isActive ? 'Participer' : 'Voir le concours'}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}

