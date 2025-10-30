/**
 * Optimized Logging System for Metrics Collection
 * 
 * Provides structured logging with performance monitoring,
 * error tracking, and rate limiting insights
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  performance?: {
    duration: number;
    memory: number;
  };
}

export interface MetricsLogContext {
  submission_id: string;
  platform: string;
  operation: 'fetch' | 'store' | 'update' | 'webhook';
  api_calls?: number;
  rate_limit_remaining?: number;
  error_code?: string;
  performance?: {
    duration: number;
    memory: number;
  };
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isProduction: boolean;

  private constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLog(entry: LogEntry): string {
    const baseLog = {
      timestamp: entry.timestamp,
      level: LogLevel[entry.level],
      message: entry.message,
    };

    if (entry.context) {
      return JSON.stringify({ ...baseLog, context: entry.context });
    }

    if (entry.error) {
      return JSON.stringify({
        ...baseLog,
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        },
      });
    }

    if (entry.performance) {
      return JSON.stringify({ ...baseLog, performance: entry.performance });
    }

    return JSON.stringify(baseLog);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    const formattedLog = this.formatLog(entry);

    // In production, use structured logging
    if (this.isProduction) {
      console.log(formattedLog);
    } else {
      // In development, use colored console output
      const colors = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m',  // Green
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.FATAL]: '\x1b[35m', // Magenta
      };
      const reset = '\x1b[0m';
      console.log(`${colors[level]}${formattedLog}${reset}`);
    }
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  public fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // Metrics-specific logging methods
  public logMetricsOperation(
    operation: string,
    platform: string,
    submissionId: string,
    success: boolean,
    duration?: number,
    error?: Error
  ): void {
    const context: MetricsLogContext = {
      submission_id: submissionId,
      platform,
      operation: operation as any,
    };

    if (duration) {
      context.performance = { duration, memory: process.memoryUsage().heapUsed };
    }

    if (success) {
      this.info(`Metrics ${operation} completed for ${platform}`, context as unknown as Record<string, unknown>);
    } else {
      this.error(`Metrics ${operation} failed for ${platform}`, error, context as unknown as Record<string, unknown>);
    }
  }

  public logRateLimit(platform: string, remaining: number, resetTime?: string): void {
    this.warn(`Rate limit warning for ${platform}`, {
      platform,
      remaining,
      resetTime,
    });
  }

  public logApiCall(platform: string, endpoint: string, status: number, duration: number): void {
    this.debug(`API call to ${platform}`, {
      platform,
      endpoint,
      status,
      duration,
    });
  }

  public logWebhook(platform: string, event: string, success: boolean, error?: Error): void {
    const context = {
      platform,
      event,
      success,
    };

    if (success) {
      this.info(`Webhook processed for ${platform}`, context);
    } else {
      this.error(`Webhook failed for ${platform}`, error, context);
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Performance monitoring utilities
export class PerformanceMonitor {
  private static timers = new Map<string, number>();

  public static startTimer(label: string): void {
    this.timers.set(label, performance.now());
  }

  public static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      logger.warn(`Timer ${label} not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(label);
    return duration;
  }

  public static measureAsync<T>(
    label: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    this.startTimer(label);
    return operation().then(result => {
      const duration = this.endTimer(label);
      return { result, duration };
    });
  }
}

// Error tracking utilities
export class ErrorTracker {
  public static trackError(
    error: Error,
    context: Record<string, unknown>,
    platform?: string
  ): void {
    logger.error('Error tracked', error, {
      ...context,
      platform,
      stack: error.stack,
    });
  }

  public static trackApiError(
    platform: string,
    endpoint: string,
    status: number,
    error: Error
  ): void {
    this.trackError(error, {
      platform,
      endpoint,
      status,
      type: 'api_error',
    });
  }

  public static trackDatabaseError(
    operation: string,
    table: string,
    error: Error
  ): void {
    this.trackError(error, {
      operation,
      table,
      type: 'database_error',
    });
  }
}
