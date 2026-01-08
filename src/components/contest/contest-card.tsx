/*
Component: ContestCard
Affiche une carte concours pour Discover / listings créateur avec cover, statut, éligibilité.
*/
"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, Clock } from "lucide-react";
import type { Platform } from "@/lib/validators/platforms";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { PlatformBadge, getPlatformLabel } from "@/components/creator/platform-badge";

function formatTimeRemaining(endDate: Date): { label: string; tone: "urgent" | "soon" | "calm" } {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { label: "Terminé", tone: "calm" };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return {
      label: days === 1 ? "Se termine dans 1 jour" : `Se termine dans ${days} jours`,
      tone: days <= 2 ? "urgent" : "soon",
    };
  }
  if (hours > 0) {
    return {
      label: hours === 1 ? "Se termine dans 1 heure" : `Se termine dans ${hours} heures`,
      tone: "urgent",
    };
  }
  if (minutes > 0) {
    return {
      label: minutes <= 5 ? "Dernières minutes" : `Se termine dans ${minutes} minutes`,
      tone: "urgent",
    };
  }
  return { label: "Se termine très bientôt", tone: "urgent" };
}

function formatPrize(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
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
  status: "draft" | "active" | "paused" | "ended" | "archived";
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

function getEmotionalLabels(contest: ContestCardData): string[] {
  const labels: string[] = [];

  if (!contest.min_followers || contest.min_followers < 1000) {
    labels.push("Facile à tourner");
  }

  if (contest.networks.includes("tiktok" as Platform)) {
    labels.push("Idéal TikTok");
  }

  if (contest.prize_pool_cents >= 50000) {
    labels.push("Gros cashprize");
  }

  if (contest.brand?.display_name) {
    labels.push("Marque connue");
  }

  return labels.slice(0, 3);
}

export function ContestCard({ contest }: ContestCardProps) {
  const isActive = contest.status === "active";
  const isEnded = contest.status === "ended" || contest.status === "archived";
  const endDate = new Date(contest.end_at);
  const timeInfo = formatTimeRemaining(endDate);
  const eligibility = contest.eligibility;
  const emotionalLabels = getEmotionalLabels(contest);

  const handleClick = () => {
    track("view_contest", { contest_id: contest.id, status: contest.status });
  };

  const timeBadgeVariant =
    timeInfo.tone === "urgent" ? ("warning" as const) : ("secondary" as const);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="h-full motion-safe:will-change-transform"
      onClick={handleClick}
    >
      <Link href={`/app/creator/contests/${contest.id}`}>
        <Card className="group h-full overflow-hidden relative transition-shadow duration-300 hover:shadow-card-hover">
          <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/0 via-accent/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

          <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-muted">
            {contest.cover_url ? (
              <Image
                src={contest.cover_url}
                alt={contest.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110 motion-safe:will-change-transform"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15">
                <span className="text-sm font-semibold text-muted-foreground">Concours ClipRace</span>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {!isEnded && (
                <Badge variant={timeBadgeVariant} className="shadow-md backdrop-blur-sm">
                  <Clock className="mr-1 h-3 w-3" />
                  {timeInfo.label}
                </Badge>
              )}
            </div>

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
                <Badge variant="secondary" className="shadow-lg backdrop-blur-sm">
                  Terminé
                </Badge>
              )}
            </div>

            <div className="absolute bottom-3 left-4 right-4 flex flex-col gap-2 text-white">
              <h3 className="line-clamp-2 text-base sm:text-lg font-semibold drop-shadow-md">
                {contest.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-white/80">
                {contest.brand?.avatar_url ? (
                  <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/60">
                    <Image
                      src={contest.brand.avatar_url}
                      alt={contest.brand.display_name || "Marque"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-[11px] font-semibold">
                    {contest.brand?.display_name?.slice(0, 2).toUpperCase() ?? "CR"}
                  </div>
                )}
                <span className="font-medium">
                  {contest.brand?.display_name || "Marque partenaire"}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="relative z-10 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3">
              {contest.brief_md && (
                <div
                  className="prose prose-sm line-clamp-2 max-w-none text-sm text-muted-foreground dark:prose-invert"
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

              <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-2xl font-bold text-transparent">
                      {formatPrize(contest.prize_pool_cents, contest.currency)}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
                    À gagner
                  </span>
                </div>
                {emotionalLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {emotionalLabels.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="border-primary/20 bg-background/40 text-[11px]"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
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

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {contest.min_followers ? (
                <Badge variant="secondary">
                  Min {contest.min_followers.toLocaleString("fr-FR")} followers
                </Badge>
              ) : null}
              {contest.min_views ? (
                <Badge variant="secondary">
                  Min {contest.min_views.toLocaleString("fr-FR")} vues moy.
                </Badge>
              ) : null}
              {eligibility ? (
                <Badge variant={eligibility.ok ? "success" : "warning"}>
                  {eligibility.ok ? "Éligibilité : OK" : "Éligibilité : conditions à remplir"}
                </Badge>
              ) : null}
            </div>
          </CardContent>

          <CardFooter className="relative z-10 flex w-full items-center justify-between gap-3 border-t border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {contest.networks.slice(0, 2).map((p) => getPlatformLabel(p)).join(" · ")}
              {contest.networks.length > 2 ? (
                <span>+{contest.networks.length - 2} réseaux</span>
              ) : null}
            </div>
            <Button asChild size="sm" variant={isActive ? "primary" : "secondary"}>
              <Link href={`/app/creator/contests/${contest.id}`}>
                {isActive ? "Participer" : "Voir le concours"}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
