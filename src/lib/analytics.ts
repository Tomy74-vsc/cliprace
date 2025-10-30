/**
 * Configuration des analytics et métriques pour ClipRace
 * Surveillance des performances et des interactions utilisateur
 */

// Types pour les métriques
export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  url: string;
  userAgent?: string;
}

// Configuration des métriques Core Web Vitals
export const coreWebVitals = {
  LCP: 'largest-contentful-paint',
  FID: 'first-input-delay',
  CLS: 'cumulative-layout-shift',
  FCP: 'first-contentful-paint',
  TTFB: 'time-to-first-byte',
} as const;

// Fonction pour envoyer les métriques
export const sendMetric = async (metric: MetricData) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Metric:', metric);
    return;
  }

  try {
    await fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metric),
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la métrique:', error);
  }
};

// Surveillance des Core Web Vitals
export const reportWebVitals = (metric: any) => {
  const metricData: MetricData = {
    name: metric.name,
    value: metric.value,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  sendMetric(metricData);
};

// Surveillance des erreurs JavaScript
export const setupErrorTracking = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    const errorMetric: MetricData = {
      name: 'javascript-error',
      value: 1,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    sendMetric(errorMetric);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const errorMetric: MetricData = {
      name: 'unhandled-promise-rejection',
      value: 1,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    sendMetric(errorMetric);
  });
};

// Surveillance des performances de navigation
export const trackNavigationPerformance = () => {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        
        const navigationMetric: MetricData = {
          name: 'navigation-timing',
          value: navEntry.loadEventEnd - navEntry.fetchStart,
          timestamp: Date.now(),
          url: window.location.href,
        };

        sendMetric(navigationMetric);
      }
    }
  });

  observer.observe({ entryTypes: ['navigation'] });
};

// Surveillance des interactions utilisateur
export const trackUserInteractions = () => {
  if (typeof window === 'undefined') return;

  const trackInteraction = (event: Event) => {
    const target = event.target as HTMLElement;
    const interactionMetric: MetricData = {
      name: 'user-interaction',
      value: 1,
      timestamp: Date.now(),
      url: window.location.href,
    };

    sendMetric(interactionMetric);
  };

  // Écouter les clics, touches, et scrolls
  document.addEventListener('click', trackInteraction, { passive: true });
  document.addEventListener('keydown', trackInteraction, { passive: true });
  document.addEventListener('scroll', trackInteraction, { passive: true });
};

// Surveillance des ressources lentes
export const trackSlowResources = () => {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource') {
        const resourceEntry = entry as PerformanceResourceTiming;
        
        // Marquer comme lent si > 1 seconde
        if (resourceEntry.duration > 1000) {
          const slowResourceMetric: MetricData = {
            name: 'slow-resource',
            value: resourceEntry.duration,
            timestamp: Date.now(),
            url: window.location.href,
          };

          sendMetric(slowResourceMetric);
        }
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });
};

// Initialisation de toutes les surveillances
export const initializeAnalytics = () => {
  if (typeof window === 'undefined') return;

  setupErrorTracking();
  trackNavigationPerformance();
  trackUserInteractions();
  trackSlowResources();
};

// Configuration des métriques personnalisées
export const customMetrics = {
  // Temps de chargement des composants
  componentLoadTime: (componentName: string, loadTime: number) => {
    const metric: MetricData = {
      name: `component-load-${componentName}`,
      value: loadTime,
      timestamp: Date.now(),
      url: window.location.href,
    };
    sendMetric(metric);
  },

  // Temps de réponse des API
  apiResponseTime: (endpoint: string, responseTime: number) => {
    const metric: MetricData = {
      name: `api-response-${endpoint}`,
      value: responseTime,
      timestamp: Date.now(),
      url: window.location.href,
    };
    sendMetric(metric);
  },

  // Taux de conversion
  conversion: (funnel: string, step: string) => {
    const metric: MetricData = {
      name: `conversion-${funnel}-${step}`,
      value: 1,
      timestamp: Date.now(),
      url: window.location.href,
    };
    sendMetric(metric);
  },
};
