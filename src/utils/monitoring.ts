/**
 * Frontend Performance Monitoring and Crash Logging Utilities
 * 
 * This module provides comprehensive logging, error tracking, and performance
 * monitoring for the Le Voyageur frontend application.
 */

export interface PerformanceMetric {
  type: 'api' | 'component' | 'interaction' | 'navigation' | 'network';
  name: string;
  duration: number;
  timestamp: number;
  userId?: string;
  metadata?: Record<string, any>;
  error?: string;
  status?: number;
}

export interface ErrorLog {
  timestamp: number;
  type: 'error' | 'warning' | 'crash';
  component?: string;
  message: string;
  stack?: string;
  userId?: string;
  metadata?: Record<string, any>;
  url: string;
  userAgent: string;
}

export interface UserAction {
  timestamp: number;
  action: string;
  component?: string;
  metadata?: Record<string, any>;
  userId?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId?: string;
  startTime: number;
  userAgent: string;
  url: string;
  viewport: { width: number; height: number };
}

// In-memory storage with localStorage persistence
class MonitoringStore {
  private performanceMetrics: PerformanceMetric[] = [];
  private errorLogs: ErrorLog[] = [];
  private userActions: UserAction[] = [];
  private sessionInfo: SessionInfo | null = null;

  private readonly MAX_METRICS = 500;
  private readonly MAX_ERRORS = 100;
  private readonly MAX_ACTIONS = 200;
  private readonly STORAGE_KEY_PREFIX = 'lv_monitor_';

  constructor() {
    // Only initialize if we're in a browser environment
    if (typeof window !== 'undefined') {
      this.initSession();
      this.loadFromStorage();
      this.setupGlobalErrorHandlers();
      this.setupPerformanceObserver();
    }
  }

  private initSession() {
    if (typeof window === 'undefined') return;
    
    const sessionId = this.getOrCreateSessionId();
    this.sessionInfo = {
      sessionId,
      startTime: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    let sessionId = sessionStorage.getItem('lv_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('lv_session_id', sessionId);
    }
    return sessionId;
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const metrics = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}metrics`);
      const errors = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}errors`);
      const actions = localStorage.getItem(`${this.STORAGE_KEY_PREFIX}actions`);

      if (metrics) this.performanceMetrics = JSON.parse(metrics).slice(-this.MAX_METRICS);
      if (errors) this.errorLogs = JSON.parse(errors).slice(-this.MAX_ERRORS);
      if (actions) this.userActions = JSON.parse(actions).slice(-this.MAX_ACTIONS);
    } catch (err) {
      console.warn('Failed to load monitoring data from storage:', err);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}metrics`, JSON.stringify(this.performanceMetrics));
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}errors`, JSON.stringify(this.errorLogs));
      localStorage.setItem(`${this.STORAGE_KEY_PREFIX}actions`, JSON.stringify(this.userActions));
    } catch (err) {
      console.warn('Failed to save monitoring data to storage:', err);
    }
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;
    
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        timestamp: Date.now(),
        type: 'error',
        message: event.message,
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        timestamp: Date.now(),
        type: 'error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metadata: {
          promise: event.promise,
        },
      });
    });

    // Catch console errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      this.logError({
        timestamp: Date.now(),
        type: 'error',
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      originalConsoleError.apply(console, args);
    };
  }

  private setupPerformanceObserver() {
    if (typeof window === 'undefined') return;
    
    // Observe navigation timing
    if ('PerformanceObserver' in window) {
      try {
        // Observe navigation
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.logPerformance({
                type: 'navigation',
                name: 'page_load',
                duration: navEntry.loadEventEnd - navEntry.fetchStart,
                timestamp: Date.now(),
                metadata: {
                  domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
                  domInteractive: navEntry.domInteractive - navEntry.fetchStart,
                  transferSize: navEntry.transferSize,
                },
              });
            }
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });

        // Observe resource timing (API calls, images, scripts)
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resourceEntry = entry as PerformanceResourceTiming;
            // Only log API calls to our backend
            if (resourceEntry.name.includes('supabase.co/functions/v1')) {
              this.logPerformance({
                type: 'network',
                name: resourceEntry.name.split('/').pop() || 'unknown',
                duration: resourceEntry.duration,
                timestamp: Date.now(),
                metadata: {
                  transferSize: resourceEntry.transferSize,
                  initiatorType: resourceEntry.initiatorType,
                },
              });
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (err) {
        console.warn('PerformanceObserver not fully supported:', err);
      }
    }
  }

  public logPerformance(metric: PerformanceMetric) {
    if (typeof window === 'undefined') return;
    
    this.performanceMetrics.push(metric);

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.MAX_METRICS) {
      this.performanceMetrics.shift();
    }

    // Log to console with emojis for visibility
    const emoji = metric.error ? '🔴' : metric.duration > 1000 ? '🟡' : '🟢';
    const typeEmoji = {
      api: '🌐',
      component: '⚛️',
      interaction: '👆',
      navigation: '🧭',
      network: '📡',
    }[metric.type];
    
    console.log(
      `${emoji} ${typeEmoji} [PERF] ${metric.type.toUpperCase()} ${metric.name} - ${metric.duration.toFixed(2)}ms`,
      metric.metadata || ''
    );

    // Warn on slow operations
    if (metric.duration > 1000 && !metric.error) {
      console.warn(`⚠️ Slow ${metric.type}: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }

    this.saveToStorage();
  }

  public logError(error: ErrorLog) {
    if (typeof window === 'undefined') return;
    
    this.errorLogs.push(error);

    // Keep only recent errors
    if (this.errorLogs.length > this.MAX_ERRORS) {
      this.errorLogs.shift();
    }

    // Log to console with full details
    console.error('🔴 [ERROR] ========================================');
    console.error(`Type: ${error.type}`);
    console.error(`Component: ${error.component || 'unknown'}`);
    console.error(`Time: ${new Date(error.timestamp).toISOString()}`);
    console.error(`User: ${error.userId || 'anonymous'}`);
    console.error(`Message: ${error.message}`);
    if (error.stack) {
      console.error(`Stack:\n${error.stack}`);
    }
    if (error.metadata) {
      console.error(`Metadata:`, error.metadata);
    }
    console.error('===============================================');

    this.saveToStorage();
  }

  public logUserAction(action: UserAction) {
    if (typeof window === 'undefined') return;
    
    this.userActions.push(action);

    // Keep only recent actions
    if (this.userActions.length > this.MAX_ACTIONS) {
      this.userActions.shift();
    }

    // Log to console
    console.log(`👆 [ACTION] ${action.action}${action.component ? ` in ${action.component}` : ''}`, action.metadata || '');

    this.saveToStorage();
  }

  public setUserId(userId: string | undefined) {
    if (this.sessionInfo) {
      this.sessionInfo.userId = userId;
    }
  }

  public getMetrics() {
    return [...this.performanceMetrics];
  }

  public getErrors() {
    return [...this.errorLogs];
  }

  public getActions() {
    return [...this.userActions];
  }

  public getSession() {
    return this.sessionInfo;
  }

  public getMetricsSummary() {
    const now = Date.now();
    const last5Minutes = now - 5 * 60 * 1000;
    const last1Hour = now - 60 * 60 * 1000;

    const recent5min = this.performanceMetrics.filter(m => m.timestamp > last5Minutes);
    const recent1hour = this.performanceMetrics.filter(m => m.timestamp > last1Hour);

    // Calculate averages by type
    const avgByType = (metrics: PerformanceMetric[]) => {
      const byType: Record<string, { total: number; count: number; avg: number }> = {};
      
      metrics.forEach(m => {
        if (!byType[m.type]) {
          byType[m.type] = { total: 0, count: 0, avg: 0 };
        }
        byType[m.type].total += m.duration;
        byType[m.type].count++;
      });

      Object.keys(byType).forEach(type => {
        byType[type].avg = byType[type].total / byType[type].count;
      });

      return byType;
    };

    const errors5min = this.errorLogs.filter(e => e.timestamp > last5Minutes);
    const errors1hour = this.errorLogs.filter(e => e.timestamp > last1Hour);

    // Find slowest operations
    const slowest = [...recent1hour]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Most common errors
    const errorsByMessage = errors1hour.reduce((acc, e) => {
      const key = e.message.substring(0, 100); // Truncate long messages
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topErrors = Object.entries(errorsByMessage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return {
      session: this.sessionInfo,
      performance: {
        last5Minutes: {
          operations: recent5min.length,
          byType: avgByType(recent5min),
        },
        last1Hour: {
          operations: recent1hour.length,
          byType: avgByType(recent1hour),
        },
        slowest: slowest.map(m => ({
          type: m.type,
          name: m.name,
          duration: Math.round(m.duration),
          timestamp: new Date(m.timestamp).toISOString(),
        })),
      },
      errors: {
        total: this.errorLogs.length,
        last5Minutes: errors5min.length,
        last1Hour: errors1hour.length,
        topErrors,
        recent: this.errorLogs.slice(-10).reverse().map(e => ({
          timestamp: new Date(e.timestamp).toISOString(),
          type: e.type,
          component: e.component || 'unknown',
          message: e.message,
        })),
      },
      userActions: {
        total: this.userActions.length,
        last5Minutes: this.userActions.filter(a => a.timestamp > last5Minutes).length,
        last1Hour: this.userActions.filter(a => a.timestamp > last1Hour).length,
        recent: this.userActions.slice(-20).reverse().map(a => ({
          timestamp: new Date(a.timestamp).toISOString(),
          action: a.action,
          component: a.component,
        })),
      },
    };
  }

  public clearMetrics() {
    this.performanceMetrics = [];
    this.errorLogs = [];
    this.userActions = [];
    this.saveToStorage();
  }

  public exportData() {
    return {
      session: this.sessionInfo,
      metrics: this.performanceMetrics,
      errors: this.errorLogs,
      actions: this.userActions,
      exportedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const monitor = new MonitoringStore();

// Helper functions for easy integration

/**
 * Track an API call's performance
 */
export async function trackApiCall<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    // In non-browser environment, just execute the function
    return await fn();
  }
  
  const startTime = performance.now();
  let error: string | undefined;
  let status: number | undefined;

  try {
    const result = await fn();
    status = 200;
    return result;
  } catch (err: any) {
    error = err.message || 'Unknown error';
    status = err.status || 500;
    throw err;
  } finally {
    const duration = performance.now() - startTime;
    monitor.logPerformance({
      type: 'api',
      name,
      duration,
      timestamp: Date.now(),
      metadata,
      error,
      status,
    });
  }
}

/**
 * Track a user interaction
 */
export function trackInteraction(name: string, metadata?: Record<string, any>) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return () => {}; // Return no-op function
  }
  
  const startTime = performance.now();
  
  // Return a function to call when interaction completes
  return () => {
    if (typeof performance === 'undefined') return;
    
    const duration = performance.now() - startTime;
    monitor.logPerformance({
      type: 'interaction',
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });
  };
}

/**
 * Track a user action
 */
export function trackAction(action: string, component?: string, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  monitor.logUserAction({
    timestamp: Date.now(),
    action,
    component,
    metadata,
  });
}

/**
 * Track component performance
 */
export function trackComponentRender(componentName: string, duration: number, metadata?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  
  monitor.logPerformance({
    type: 'component',
    name: componentName,
    duration,
    timestamp: Date.now(),
    metadata,
  });
}

/**
 * Log an error manually
 */
export function logError(
  message: string,
  component?: string,
  metadata?: Record<string, any>,
  stack?: string
) {
  if (typeof window === 'undefined') return;
  
  monitor.logError({
    timestamp: Date.now(),
    type: 'error',
    component,
    message,
    stack: stack || new Error().stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    metadata,
  });
}

/**
 * Log a warning
 */
export function logWarning(
  message: string,
  component?: string,
  metadata?: Record<string, any>
) {
  if (typeof window === 'undefined') return;
  
  monitor.logError({
    timestamp: Date.now(),
    type: 'warning',
    component,
    message,
    url: window.location.href,
    userAgent: navigator.userAgent,
    metadata,
  });
  console.warn(`⚠️ [WARNING] ${component ? `${component}: ` : ''}${message}`, metadata || '');
}

// Export for global debugging
if (typeof window !== 'undefined') {
  (window as any).lvMonitor = monitor;
  console.log('💡 Frontend monitoring enabled. Access via window.lvMonitor or use Ctrl+Shift+M to open dashboard');
}
