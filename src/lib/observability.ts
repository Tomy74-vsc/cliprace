import { NextRequest } from 'next/server';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface AuthEvent {
  type: 'signup' | 'login' | 'logout' | 'email_verification' | 'password_reset' | 'auth_error';
  success: boolean;
  error?: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  context: LogContext;
  metadata?: Record<string, unknown>;
}

/**
 * Service de logging enrichi
 */
export class ObservabilityService {
  private static instance: ObservabilityService;
  private logs: AuthEvent[] = [];
  private metrics: PerformanceMetric[] = [];

  static getInstance(): ObservabilityService {
    if (!ObservabilityService.instance) {
      ObservabilityService.instance = new ObservabilityService();
    }
    return ObservabilityService.instance;
  }

  /**
   * Log un événement d'authentification
   */
  logAuthEvent(event: AuthEvent): void {
    const enrichedEvent = {
      ...event,
      context: {
        ...event.context,
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      }
    };

    this.logs.push(enrichedEvent);

    // En production, envoyer vers un service externe (Sentry, DataDog, etc.)
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(enrichedEvent);
    } else {
      console.log('🔐 Auth Event:', enrichedEvent);
    }
  }

  /**
   * Enregistre une métrique de performance
   */
  recordMetric(metric: PerformanceMetric): void {
    const enrichedMetric = {
      ...metric,
      context: {
        ...metric.context,
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
      }
    };

    this.metrics.push(enrichedMetric);

    // En production, envoyer vers un service externe
    if (process.env.NODE_ENV === 'production') {
      this.sendMetricToExternalService(enrichedMetric);
    } else {
      console.log('📊 Performance Metric:', enrichedMetric);
    }
  }

  /**
   * Log une erreur d'authentification
   */
  logAuthError(
    type: AuthEvent['type'],
    error: string,
    context: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    this.logAuthEvent({
      type,
      success: false,
      error,
      context,
      metadata,
    });
  }

  /**
   * Log un succès d'authentification
   */
  logAuthSuccess(
    type: AuthEvent['type'],
    context: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    this.logAuthEvent({
      type,
      success: true,
      context,
      metadata,
    });
  }

  /**
   * Mesure le temps d'exécution d'une opération
   */
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        success: true,
        context,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordMetric({
        operation,
        duration,
        success: false,
        context,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      throw error;
    }
  }

  /**
   * Extrait le contexte depuis une requête Next.js
   */
  extractContextFromRequest(req: NextRequest, additionalContext: Partial<LogContext> = {}): LogContext {
    return {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      requestId: this.generateRequestId(),
      ...additionalContext,
    };
  }

  /**
   * Génère un ID de requête unique
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Envoie les logs vers un service externe (Sentry, etc.)
   */
  private async sendToExternalService(event: AuthEvent): Promise<void> {
    try {
      // En production, envoyer vers un service externe
      // Exemple avec Sentry (à décommenter et configurer):
      /*
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        if (event.success) {
          (window as any).Sentry.addBreadcrumb({
            message: `Auth ${event.type} success`,
            level: 'info',
            data: event,
          });
        } else {
          (window as any).Sentry.captureException(new Error(event.error), {
            tags: {
              authEvent: event.type,
            },
            extra: event,
          });
        }
      }
      */
      
      // Pour l'instant, on peut envoyer vers un endpoint de logging
      if (process.env.LOGGING_ENDPOINT) {
        await fetch(process.env.LOGGING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      }
    } catch (error) {
      // Ne pas faire échouer l'application si le logging externe échoue
      console.error('Erreur lors de l\'envoi vers le service externe:', error);
    }
  }

  /**
   * Envoie les métriques vers un service externe
   */
  private async sendMetricToExternalService(metric: PerformanceMetric): Promise<void> {
    try {
      // En production, envoyer vers un service de métriques
      // Exemple avec DataDog, New Relic, etc.
      if (process.env.METRICS_ENDPOINT) {
        await fetch(process.env.METRICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metric),
        });
      }
    } catch (error) {
      // Ne pas faire échouer l'application si l'envoi de métriques échoue
      console.error('Erreur lors de l\'envoi des métriques:', error);
    }
  }

  /**
   * Récupère les logs récents
   */
  getRecentLogs(limit: number = 100): AuthEvent[] {
    return this.logs.slice(-limit);
  }

  /**
   * Récupère les métriques récentes
   */
  getRecentMetrics(limit: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Calcule les statistiques de performance
   */
  getPerformanceStats(): {
    avgResponseTime: number;
    successRate: number;
    totalOperations: number;
    errorRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgResponseTime: 0,
        successRate: 0,
        totalOperations: 0,
        errorRate: 0,
      };
    }

    const totalOperations = this.metrics.length;
    const successfulOperations = this.metrics.filter(m => m.success).length;
    const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations;
    const successRate = (successfulOperations / totalOperations) * 100;
    const errorRate = 100 - successRate;

    return {
      avgResponseTime,
      successRate,
      totalOperations,
      errorRate,
    };
  }
}

// Instance singleton
export const observability = ObservabilityService.getInstance();

/**
 * Hook pour mesurer les performances côté client
 */
export function usePerformanceMeasurement() {
  const measure = (operation: string, fn: () => Promise<unknown> | unknown) => {
    const startTime = Date.now();
    
    return Promise.resolve(fn()).then(
      (result) => {
        const duration = Date.now() - startTime;
        observability.recordMetric({
          operation,
          duration,
          success: true,
          context: {
            timestamp: new Date().toISOString(),
            requestId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
        });
        return result;
      },
      (error) => {
        const duration = Date.now() - startTime;
        observability.recordMetric({
          operation,
          duration,
          success: false,
          context: {
            timestamp: new Date().toISOString(),
            requestId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        throw error;
      }
    );
  };

  return { measure };
}
