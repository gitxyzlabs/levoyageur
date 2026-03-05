/**
 * React hooks for performance monitoring
 */

import { useEffect, useRef, useCallback } from 'react';
import { trackComponentRender, trackAction, logError } from '../../utils/monitoring';

/**
 * Monitor component render performance
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   usePerformanceMonitor('MyComponent');
 *   // ... rest of component
 * }
 * ```
 */
export function usePerformanceMonitor(
  componentName: string,
  dependencies?: any[],
  options?: { logEveryRender?: boolean; warnThreshold?: number }
) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  const { logEveryRender = false, warnThreshold = 50 } = options || {};

  useEffect(() => {
    const renderTime = performance.now();
    const renderDuration = renderTime - lastRenderTime.current;
    renderCount.current++;

    const shouldLog = logEveryRender || renderCount.current === 1 || renderDuration > warnThreshold;

    if (shouldLog) {
      trackComponentRender(componentName, renderDuration, {
        renderCount: renderCount.current,
        dependencies: dependencies ? JSON.stringify(dependencies) : undefined,
      });
    }

    lastRenderTime.current = renderTime;
  });

  return renderCount.current;
}

/**
 * Track user actions with automatic timing
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const trackClick = useActionTracker('MyComponent');
 *   
 *   return (
 *     <button onClick={() => trackClick('button_clicked', { buttonId: 'submit' })}>
 *       Submit
 *     </button>
 *   );
 * }
 * ```
 */
export function useActionTracker(componentName: string) {
  return useCallback(
    (action: string, metadata?: Record<string, any>) => {
      trackAction(action, componentName, metadata);
    },
    [componentName]
  );
}

/**
 * Error boundary hook for catching component errors
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { catchError } = useErrorHandler('MyComponent');
 *   
 *   const handleClick = async () => {
 *     try {
 *       await someAsyncOperation();
 *     } catch (err) {
 *       catchError(err, { context: 'button_click' });
 *     }
 *   };
 * }
 * ```
 */
export function useErrorHandler(componentName: string) {
  const catchError = useCallback(
    (error: any, metadata?: Record<string, any>) => {
      logError(
        error.message || String(error),
        componentName,
        metadata,
        error.stack
      );
    },
    [componentName]
  );

  return { catchError };
}

/**
 * Monitor async operations with automatic tracking
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const trackAsync = useAsyncTracker('MyComponent');
 *   
 *   const fetchData = async () => {
 *     await trackAsync('fetch_data', async () => {
 *       const data = await api.getData();
 *       return data;
 *     });
 *   };
 * }
 * ```
 */
export function useAsyncTracker(componentName: string) {
  return useCallback(
    async <T,>(operationName: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> => {
      const startTime = performance.now();
      
      try {
        trackAction(`${operationName}_started`, componentName, metadata);
        const result = await fn();
        const duration = performance.now() - startTime;
        
        trackComponentRender(`${componentName}.${operationName}`, duration, {
          ...metadata,
          success: true,
        });
        
        trackAction(`${operationName}_completed`, componentName, { ...metadata, duration });
        
        return result;
      } catch (error: any) {
        const duration = performance.now() - startTime;
        
        logError(
          error.message || String(error),
          componentName,
          { ...metadata, operationName, duration },
          error.stack
        );
        
        trackAction(`${operationName}_failed`, componentName, { ...metadata, duration, error: error.message });
        
        throw error;
      }
    },
    [componentName]
  );
}

/**
 * Track component mount/unmount lifecycle
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   useLifecycleMonitor('MyComponent');
 *   // ... rest of component
 * }
 * ```
 */
export function useLifecycleMonitor(componentName: string) {
  const mountTime = useRef(Date.now());

  useEffect(() => {
    trackAction('component_mounted', componentName);

    return () => {
      const lifetimeDuration = Date.now() - mountTime.current;
      trackAction('component_unmounted', componentName, { lifetimeDuration });
    };
  }, [componentName]);
}
