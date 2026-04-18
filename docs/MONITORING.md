# Le Voyageur Frontend Monitoring

## Overview

The Le Voyageur frontend includes a comprehensive performance monitoring and logging system that tracks:
- **Performance metrics** - API calls, component renders, user interactions
- **Error logging** - Crashes, warnings, and exceptions with full stack traces
- **User actions** - Clicks, searches, favorites, and navigation
- **Session information** - User agent, viewport, and session tracking

## Quick Start

### Opening the Monitoring Dashboard

Press **Ctrl+Shift+M** (or **Cmd+Shift+M** on Mac) to toggle the monitoring dashboard.

Alternatively, you can access it via the browser console:
```javascript
window.lvMonitor.getMetricsSummary()
```

### Dashboard Features

The monitoring dashboard has 4 tabs:

1. **Overview** - Key metrics at a glance
   - Performance summary (5 min & 1 hour windows)
   - Error counts and top errors
   - User action statistics
   - Session information

2. **Performance** - Detailed performance analysis
   - Slowest operations
   - Performance breakdown by type (API, component, interaction, navigation)
   - Response time charts

3. **Errors** - Error tracking
   - Recent errors with timestamps and stack traces
   - Error frequency
   - Component context

4. **User Actions** - User behavior tracking
   - Recent user actions
   - Action timeline
   - Component interactions

### Dashboard Actions

- **Refresh** - Reload metrics
- **Export** - Download all monitoring data as JSON
- **Clear** - Clear all stored metrics (with confirmation)

## Usage in Code

### Automatic Tracking

The following are automatically tracked:
- Page load and navigation
- API calls to the backend
- Global errors and unhandled promise rejections
- Network requests to Supabase functions

### Manual Tracking

#### Track API Calls

```typescript
import { trackApiCall } from '@/utils/monitoring';

const data = await trackApiCall('getLocations', () => api.getLocations());
```

#### Track User Actions

```typescript
import { trackAction } from '@/utils/monitoring';

trackAction('button_clicked', 'MyComponent', { buttonId: 'submit' });
```

#### Track Interactions (with timing)

```typescript
import { trackInteraction } from '@/utils/monitoring';

const endTracking = trackInteraction('form_submission');
// ... do some work ...
endTracking(); // Records duration
```

#### Log Errors

```typescript
import { logError, logWarning } from '@/utils/monitoring';

try {
  // some code
} catch (error) {
  logError(error.message, 'MyComponent', { context: 'data_fetch' }, error.stack);
}

// For warnings
logWarning('Slow operation detected', 'MyComponent', { duration: 1500 });
```

### React Hooks

#### usePerformanceMonitor

Automatically track component render performance:

```typescript
import { usePerformanceMonitor } from '@/app/hooks/usePerformanceMonitor';

function MyComponent() {
  usePerformanceMonitor('MyComponent');
  // Component will log render times
  return <div>...</div>;
}
```

Options:
```typescript
usePerformanceMonitor('MyComponent', [dep1, dep2], {
  logEveryRender: true,  // Log every render (default: false)
  warnThreshold: 100     // Warn if render > 100ms (default: 50ms)
});
```

#### useActionTracker

Track user actions in components:

```typescript
import { useActionTracker } from '@/app/hooks/usePerformanceMonitor';

function MyComponent() {
  const trackClick = useActionTracker('MyComponent');
  
  return (
    <button onClick={() => trackClick('button_clicked', { buttonId: 'submit' })}>
      Submit
    </button>
  );
}
```

#### useErrorHandler

Catch and log errors in components:

```typescript
import { useErrorHandler } from '@/app/hooks/usePerformanceMonitor';

function MyComponent() {
  const { catchError } = useErrorHandler('MyComponent');
  
  const handleClick = async () => {
    try {
      await someAsyncOperation();
    } catch (err) {
      catchError(err, { context: 'button_click' });
    }
  };
  
  return <button onClick={handleClick}>Click me</button>;
}
```

#### useAsyncTracker

Track async operations with automatic timing:

```typescript
import { useAsyncTracker } from '@/app/hooks/usePerformanceMonitor';

function MyComponent() {
  const trackAsync = useAsyncTracker('MyComponent');
  
  const fetchData = async () => {
    const data = await trackAsync('fetch_data', async () => {
      return await api.getData();
    });
  };
  
  return <button onClick={fetchData}>Fetch Data</button>;
}
```

#### useLifecycleMonitor

Track component mount/unmount:

```typescript
import { useLifecycleMonitor } from '@/app/hooks/usePerformanceMonitor';

function MyComponent() {
  useLifecycleMonitor('MyComponent');
  // Logs when component mounts and unmounts
  return <div>...</div>;
}
```

## Data Persistence

- Metrics are stored in **memory** and **localStorage**
- Data persists across page reloads
- Maximum storage limits:
  - 500 performance metrics
  - 100 error logs
  - 200 user actions

## Console Access

Access monitoring data via the browser console:

```javascript
// Get summary
window.lvMonitor.getMetricsSummary()

// Get raw data
window.lvMonitor.getMetrics()
window.lvMonitor.getErrors()
window.lvMonitor.getActions()
window.lvMonitor.getSession()

// Export data
window.lvMonitor.exportData()

// Clear data
window.lvMonitor.clearMetrics()

// Set user ID
window.lvMonitor.setUserId('user-123')
```

## Performance Thresholds

The system uses these thresholds for warnings:

- **API calls**: > 1000ms
- **Component renders**: > 50ms
- **Interactions**: > 1000ms
- **Database queries** (backend): > 100ms

Operations exceeding these thresholds are highlighted in yellow/red in the dashboard.

## Privacy & Security

- All data is stored locally in the browser
- No monitoring data is sent to external servers by default
- User ID is only set when explicitly logged in
- Sensitive data (passwords, tokens) should never be logged

## Debugging Tips

1. **Finding slow operations**: Check the "Slowest Operations" section in the Performance tab
2. **Investigating crashes**: Look at the Errors tab for stack traces and context
3. **Understanding user behavior**: Review the User Actions tab to see interaction patterns
4. **Exporting for analysis**: Use the Export button to download data as JSON for deeper analysis

## Integration with Backend Monitoring

The backend has a similar monitoring system at `/supabase/functions/server/monitoring.tsx`. Together they provide full-stack observability:

- Frontend: User interactions, client-side performance, rendering
- Backend: API performance, database queries, server errors

Access backend metrics at: `GET /make-server-48182530/metrics`

## Best Practices

1. **Use descriptive names** for tracked operations
2. **Add context metadata** to help with debugging
3. **Wrap async operations** in trackApiCall or useAsyncTracker
4. **Add error handlers** to catch and log errors with context
5. **Monitor component performance** for frequently rendered components
6. **Export data regularly** during development to identify patterns

## Troubleshooting

**Dashboard won't open**
- Make sure you're pressing Ctrl+Shift+M (or Cmd+Shift+M on Mac)
- Check browser console for errors
- Verify monitoring.ts is loaded: `console.log(window.lvMonitor)`

**No metrics appearing**
- Metrics are cleared on each session by default
- Check localStorage hasn't been cleared
- Verify actions are being tracked: `window.lvMonitor.getActions()`

**Performance impact**
- Monitoring has minimal overhead (<1% in most cases)
- Large numbers of metrics are automatically pruned
- Consider disabling in production if needed

## Future Enhancements

Potential improvements:
- Remote logging to a monitoring service
- Real-time metric streaming
- Performance budgets with alerts
- User session replay
- A/B test result tracking
- Custom dashboard widgets
