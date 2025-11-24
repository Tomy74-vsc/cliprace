/*
Source: Component DiscoverFilters
Purpose: Filtres pour la page discover (plateformes, recherche)
*/
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import type { Platform } from '@/lib/validators/platforms';

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

interface DiscoverFiltersProps {
  value: {
    search: string;
    platforms: Platform[];
  };
  isPending?: boolean;
  onFiltersChange: (filters: { search: string; platforms: Platform[] }) => void;
}

export function DiscoverFilters({ value, isPending, onFiltersChange }: DiscoverFiltersProps) {
  const handlePlatformToggle = (platform: Platform) => {
    const newPlatforms = value.platforms.includes(platform)
      ? value.platforms.filter((p) => p !== platform)
      : [...value.platforms, platform];
    onFiltersChange({ search: value.search, platforms: newPlatforms });
  };

  const handleSearchChange = (valueStr: string) => {
    onFiltersChange({ search: valueStr, platforms: value.platforms });
  };

  const clearFilters = () => {
    onFiltersChange({ search: '', platforms: [] });
  };

  const hasActiveFilters = value.search.length > 0 || value.platforms.length > 0;

  return (
    <div className="mb-8 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Rechercher un concours..."
          value={value.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-12 pr-12 h-12 text-base"
          aria-label="Rechercher un concours"
          disabled={isPending}
        />
        {value.search && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Effacer la recherche"
            disabled={isPending}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Platform Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Plateformes :</span>
        </div>
        {(['tiktok', 'instagram', 'youtube'] as Platform[]).map((platform) => {
          const isSelected = value.platforms.includes(platform);
          return (
            <button
              key={platform}
              onClick={() => handlePlatformToggle(platform)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-r from-[#635BFF] to-[#7C3AED] text-white shadow-lg shadow-[#635BFF]/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              aria-pressed={isSelected}
              disabled={isPending}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          );
        })}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>
    </div>
  );
}

