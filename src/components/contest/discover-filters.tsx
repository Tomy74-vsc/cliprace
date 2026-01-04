/*
Source: Component DiscoverFilters
Purpose: Filtres pour la page discover (plateformes, recherche, statut, tri)
*/
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import type { Platform } from "@/lib/validators/platforms";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

type StatusFilter = "active" | "upcoming" | "ended";
type SortOption = "ending_soon" | "prize_desc" | "newest";

interface DiscoverFiltersProps {
  value: {
    search: string;
    platforms: Platform[];
    status: StatusFilter;
    sort: SortOption;
  };
  isPending?: boolean;
  onFiltersChange: (filters: { search: string; platforms: Platform[]; status: StatusFilter; sort: SortOption }) => void;
}

export function DiscoverFilters({ value, isPending, onFiltersChange }: DiscoverFiltersProps) {
  const handlePlatformToggle = (platform: Platform) => {
    const newPlatforms = value.platforms.includes(platform)
      ? value.platforms.filter((p) => p !== platform)
      : [...value.platforms, platform];
    onFiltersChange({ search: value.search, platforms: newPlatforms, status: value.status, sort: value.sort });
  };

  const handleSearchChange = (valueStr: string) => {
    onFiltersChange({ search: valueStr, platforms: value.platforms, status: value.status, sort: value.sort });
  };

  const clearFilters = () => {
    onFiltersChange({ search: "", platforms: [], status: "active", sort: "ending_soon" });
  };

  const handleStatusChange = (status: StatusFilter) => {
    onFiltersChange({ search: value.search, platforms: value.platforms, status, sort: value.sort });
  };

  const handleSortChange = (sort: SortOption) => {
    onFiltersChange({ search: value.search, platforms: value.platforms, status: value.status, sort });
  };

  const hasActiveFilters =
    value.search.length > 0 ||
    value.platforms.length > 0 ||
    value.status !== "active" ||
    value.sort !== "ending_soon";

  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-border bg-card/60 p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative w-full md:w-auto flex-1 min-w-[240px]">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="text"
            placeholder="Rechercher"
            value={value.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-12 pr-12 h-11 text-base rounded-full"
            aria-label="Rechercher un concours"
            disabled={isPending}
          />
          {value.search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Effacer la recherche"
              disabled={isPending}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Plateformes :</span>
        </div>
        {(["tiktok", "instagram", "youtube"] as Platform[]).map((platform) => {
          const isSelected = value.platforms.includes(platform);
          return (
            <button
              key={platform}
              onClick={() => handlePlatformToggle(platform)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? "bg-gradient-to-r from-[#635BFF] to-[#7C3AED] text-white shadow-lg shadow-[#635BFF]/30"
                  : "bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              disabled={isPending}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {[
          { value: "active", label: "Actifs" },
          { value: "upcoming", label: "À venir" },
          { value: "ended", label: "Terminés" },
        ].map((s) => {
          const active = value.status === s.value;
          return (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value as StatusFilter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              disabled={isPending}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span>Trier par :</span>
        </div>
        {[
          { value: "ending_soon", label: "Fin proche" },
          { value: "prize_desc", label: "Prize pool" },
          { value: "newest", label: "Nouveaux" },
        ].map((s) => {
          const active = value.sort === s.value;
          return (
            <button
              key={s.value}
              onClick={() => handleSortChange(s.value as SortOption)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              disabled={isPending}
            >
              {s.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto text-muted-foreground hover:text-foreground"
            disabled={isPending}
          >
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>
    </div>
  );
}
