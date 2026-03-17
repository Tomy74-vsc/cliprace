'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const REFRESH_INTERVAL_MS = 60_000 // 60 secondes

interface LeaderboardAutoRefreshProps {
  /** Appelé à chaque refresh réussi pour mettre à jour le timestamp affiché */
  onRefresh?: (time: string) => void
}

export function LeaderboardAutoRefresh({ onRefresh }: LeaderboardAutoRefreshProps) {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [_lastUpdated, setLastUpdated] = useState<string>(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )

  const doRefresh = useCallback(() => {
    // Ne pas rafraîchir si l'onglet est en arrière-plan
    if (document.visibilityState !== 'visible') return
    router.refresh()
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setLastUpdated(time)
    onRefresh?.(time)
  }, [router, onRefresh])

  useEffect(() => {
    // Démarrer le polling
    intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS)

    // Pause quand l'onglet devient invisible, reprend quand visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh immédiat au retour sur l'onglet si > 60s depuis le dernier refresh
        doRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [doRefresh])

  // Ce composant ne rend rien de visible — il expose juste lastUpdated
  // Le parent le wrap dans un contexte si besoin
  return null
}

// Hook utilitaire pour les pages qui veulent afficher le timestamp dynamique
export function useLeaderboardLastUpdated(initial: string) {
  const [lastUpdated, setLastUpdated] = useState(initial)
  return { lastUpdated, setLastUpdated }
}

