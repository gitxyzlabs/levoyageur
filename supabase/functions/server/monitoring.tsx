/**
 * Performance Monitoring and Crash Logging Utilities
 * 
 * This module provides comprehensive logging, error tracking, and performance
 * monitoring for the Le Voyageur server.
 */

interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  userId?: string;
  error?: string;
}

interface ErrorLog {
  timestamp: number;
  endpoint: string;
  method: string;
  error: string;
  stack?: string;
  userId?: string;
  requestBody?: any;
  statusCode: number;
}

interface DatabaseMetric {
  operation: string;
  table: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

// In-memory metrics storage (resets on function cold start)
const performanceMetrics: PerformanceMetric[] = [];
const errorLogs: ErrorLog[] = [];
const databaseMetrics: DatabaseMetric[] = [];

// Limits to prevent memory overflow
const MAX_METRICS = 1000;
const MAX_ERRORS = 500;
const MAX_DB_METRICS = 1000;

/**
 * Log a performance metric for an API endpoint
 */
export function logPerformance(metric: PerformanceMetric) {
  performanceMetrics.push(metric);
  
  // Keep only recent metrics
  if (performanceMetrics.length > MAX_METRICS) {
    performanceMetrics.shift();
  }
  
  // Log to console for immediate visibility
  const emoji = metric.status >= 500 ? '🔴' : metric.status >= 400 ? '🟡' : '🟢';
  console.log(`${emoji} [PERF] ${metric.method} ${metric.endpoint} - ${metric.duration.toFixed(2)}ms - ${metric.status}${metric.error ? ` - ${metric.error}` : ''}`);
}

/**
 * Log an error with full context
 */
export function logError(error: ErrorLog) {
  errorLogs.push(error);
  
  // Keep only recent errors
  if (errorLogs.length > MAX_ERRORS) {
    errorLogs.shift();
  }
  
  // Log to console with full details
  console.error('🔴 [ERROR] ========================================');
  console.error(`Endpoint: ${error.method} ${error.endpoint}`);
  console.error(`Status: ${error.statusCode}`);
  console.error(`Time: ${new Date(error.timestamp).toISOString()}`);
  console.error(`User: ${error.userId || 'anonymous'}`);
  console.error(`Error: ${error.error}`);
  if (error.stack) {
    console.error(`Stack: ${error.stack}`);
  }
  if (error.requestBody) {
    console.error(`Request Body: ${JSON.stringify(error.requestBody, null, 2)}`);
  }
  console.error('===============================================');
}

/**
 * Log a database operation metric
 */
export function logDatabaseOperation(metric: DatabaseMetric) {
  databaseMetrics.push(metric);
  
  // Keep only recent metrics
  if (databaseMetrics.length > MAX_DB_METRICS) {
    databaseMetrics.shift();
  }
  
  // Log slow queries (> 100ms)
  if (metric.duration > 100) {
    console.warn(`⚠️ [DB SLOW] ${metric.operation} on ${metric.table} took ${metric.duration.toFixed(2)}ms`);
  }
  
  // Log failed operations
  if (!metric.success) {
    console.error(`❌ [DB ERROR] ${metric.operation} on ${metric.table} failed: ${metric.error}`);
  }
}

/**
 * Middleware to track request performance
 */
export function performanceMiddleware() {
  return async (c: any, next: any) => {
    const startTime = performance.now();
    const method = c.req.method;
    const path = c.req.path;
    const userId = c.get('userId');
    
    console.log(`📍 [REQUEST START] ${method} ${path} - User: ${userId || 'anonymous'}`);
    
    let status = 200;
    let error: string | undefined;
    
    try {
      await next();
      status = c.res.status;
    } catch (err: any) {
      status = err.status || 500;
      error = err.message || 'Unknown error';
      
      // Log the error with full context
      logError({
        timestamp: Date.now(),
        endpoint: path,
        method,
        error: err.message || 'Unknown error',
        stack: err.stack,
        userId,
        statusCode: status,
      });
      
      // Re-throw to let error handler deal with it
      throw err;
    } finally {
      const duration = performance.now() - startTime;
      
      // Log the performance metric
      logPerformance({
        endpoint: path,
        method,
        duration,
        status,
        timestamp: Date.now(),
        userId,
        error,
      });
      
      console.log(`📍 [REQUEST END] ${method} ${path} - ${duration.toFixed(2)}ms - ${status}`);
    }
  };
}

/**
 * Wrapper for database operations with timing
 */
export async function trackDatabaseOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  
  try {
    const result = await fn();
    return result;
  } catch (err: any) {
    success = false;
    error = err.message || 'Unknown error';
    throw err;
  } finally {
    const duration = performance.now() - startTime;
    
    logDatabaseOperation({
      operation,
      table,
      duration,
      timestamp: Date.now(),
      success,
      error,
    });
  }
}

/**
 * Get aggregated metrics (for admin dashboard)
 */
export function getMetricsSummary() {
  const now = Date.now();
  const last5Minutes = now - 5 * 60 * 1000;
  const last1Hour = now - 60 * 60 * 1000;
  
  // Filter metrics from last 5 minutes and 1 hour
  const recent5min = performanceMetrics.filter(m => m.timestamp > last5Minutes);
  const recent1hour = performanceMetrics.filter(m => m.timestamp > last1Hour);
  
  // Calculate average response times
  const avg5min = recent5min.length > 0
    ? recent5min.reduce((sum, m) => sum + m.duration, 0) / recent5min.length
    : 0;
  const avg1hour = recent1hour.length > 0
    ? recent1hour.reduce((sum, m) => sum + m.duration, 0) / recent1hour.length
    : 0;
  
  // Count errors
  const errors5min = recent5min.filter(m => m.status >= 400).length;
  const errors1hour = recent1hour.filter(m => m.status >= 400).length;
  
  // Slowest endpoints in last hour
  const slowest = [...recent1hour]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map(m => ({
      endpoint: `${m.method} ${m.endpoint}`,
      duration: Math.round(m.duration),
      status: m.status,
    }));
  
  // Most common errors
  const errorsByType = errorLogs
    .filter(e => e.timestamp > last1Hour)
    .reduce((acc, e) => {
      acc[e.error] = (acc[e.error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  const topErrors = Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }));
  
  // Database performance
  const dbRecent = databaseMetrics.filter(m => m.timestamp > last1Hour);
  const avgDbDuration = dbRecent.length > 0
    ? dbRecent.reduce((sum, m) => sum + m.duration, 0) / dbRecent.length
    : 0;
  const dbErrors = dbRecent.filter(m => !m.success).length;
  
  return {
    performance: {
      last5Minutes: {
        requests: recent5min.length,
        avgResponseTime: Math.round(avg5min),
        errors: errors5min,
        errorRate: recent5min.length > 0 ? ((errors5min / recent5min.length) * 100).toFixed(2) + '%' : '0%',
      },
      last1Hour: {
        requests: recent1hour.length,
        avgResponseTime: Math.round(avg1hour),
        errors: errors1hour,
        errorRate: recent1hour.length > 0 ? ((errors1hour / recent1hour.length) * 100).toFixed(2) + '%' : '0%',
      },
      slowestEndpoints: slowest,
    },
    errors: {
      total: errorLogs.length,
      last1Hour: errorLogs.filter(e => e.timestamp > last1Hour).length,
      topErrors,
      recentErrors: errorLogs.slice(-10).reverse().map(e => ({
        timestamp: new Date(e.timestamp).toISOString(),
        endpoint: `${e.method} ${e.endpoint}`,
        error: e.error,
        userId: e.userId || 'anonymous',
        status: e.statusCode,
      })),
    },
    database: {
      last1Hour: {
        operations: dbRecent.length,
        avgDuration: Math.round(avgDbDuration),
        errors: dbErrors,
        errorRate: dbRecent.length > 0 ? ((dbErrors / dbRecent.length) * 100).toFixed(2) + '%' : '0%',
      },
      slowQueries: dbRecent
        .filter(m => m.duration > 100)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(m => ({
          operation: m.operation,
          table: m.table,
          duration: Math.round(m.duration),
        })),
    },
  };
}

/**
 * Enhanced error handler middleware
 */
export function errorHandlerMiddleware() {
  return async (c: any, next: any) => {
    try {
      await next();
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';
      
      // Already logged in performanceMiddleware, just return response
      return c.json(
        {
          error: message,
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        status
      );
    }
  };
}
