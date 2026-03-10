'use client'

import { useState } from 'react'
import { LeaderboardAutoRefresh } from './leaderboard-auto-refresh'

interface LeaderboardLiveIndicatorProps {
  initialTime: string
}

export function LeaderboardLiveIndicator({ initialTime }: LeaderboardLiveIndicatorProps) {
  const [lastUpdated, setLastUpdated] = useState(initialTime)

  return (
    <div className="flex items-center gap-2">
      {/* Dot "live" — Race Light emerald, conforme BRAND_UI_SPEC */}
      <span
        className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">
        Mis à jour à {lastUpdated}
      </span>
      {/* Auto-refresh invisible — déclenche router.refresh() toutes les 60s */}
      <LeaderboardAutoRefresh onRefresh={setLastUpdated} />
    </div>
  )
}

