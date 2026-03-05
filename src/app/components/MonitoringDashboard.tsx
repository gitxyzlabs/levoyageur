/**
 * Monitoring Dashboard - Debug overlay for viewing performance and error logs
 * 
 * Toggle with Ctrl+Shift+M or programmatically
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, RefreshCw, Activity, AlertCircle, MousePointer, TrendingUp } from 'lucide-react';
import { monitor } from '../../utils/monitoring';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface MonitoringDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MonitoringDashboard({ isOpen, onClose }: MonitoringDashboardProps) {
  const [summary, setSummary] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen, refreshKey]);

  const loadSummary = () => {
    setSummary(monitor.getMetricsSummary());
  };

  const handleExport = () => {
    const data = monitor.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lv-monitoring-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all monitoring data?')) {
      monitor.clearMetrics();
      setRefreshKey(k => k + 1);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col bg-white shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-purple-600" />
            <div>
              <CardTitle className="text-xl">Le Voyageur Monitoring Dashboard</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Session: {summary.session?.sessionId?.substring(0, 20)}... | 
                Started: {new Date(summary.session?.startTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">
                <TrendingUp className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="performance">
                <Activity className="w-4 h-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="errors">
                <AlertCircle className="w-4 h-4 mr-2" />
                Errors ({summary.errors.total})
              </TabsTrigger>
              <TabsTrigger value="actions">
                <MousePointer className="w-4 h-4 mr-2" />
                User Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Performance Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Performance (1h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">
                      {summary.performance.last1Hour.operations}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Total operations</p>
                    <div className="mt-4 space-y-2">
                      {Object.entries(summary.performance.last1Hour.byType as Record<string, any>).map(([type, stats]: [string, any]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-gray-600 capitalize">{type}:</span>
                          <span className="font-medium">{Math.round(stats.avg)}ms avg</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Errors Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">Errors (1h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {summary.errors.last1Hour}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Errors logged</p>
                    <div className="mt-4">
                      <div className="text-sm text-gray-600">
                        Last 5 min: <span className="font-medium">{summary.errors.last5Minutes}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Total: <span className="font-medium">{summary.errors.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Actions Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600">User Actions (1h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {summary.userActions.last1Hour}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Actions tracked</p>
                    <div className="mt-4">
                      <div className="text-sm text-gray-600">
                        Last 5 min: <span className="font-medium">{summary.userActions.last5Minutes}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Total: <span className="font-medium">{summary.userActions.total}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Session Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Session Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">User Agent:</span>
                    <p className="font-mono text-xs mt-1 break-all">{summary.session?.userAgent}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Viewport:</span>
                    <p className="font-mono text-xs mt-1">
                      {summary.session?.viewport?.width} × {summary.session?.viewport?.height}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">URL:</span>
                    <p className="font-mono text-xs mt-1 break-all">{summary.session?.url}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">User ID:</span>
                    <p className="font-mono text-xs mt-1">{summary.session?.userId || 'Not logged in'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Top Errors */}
              {summary.errors.topErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Errors (Last Hour)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {summary.errors.topErrors.map((error: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                          <span className="text-sm text-gray-800 flex-1 mr-4 truncate">{error.message}</span>
                          <span className="text-sm font-bold text-red-600 flex-shrink-0">{error.count}×</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              {/* Slowest Operations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Slowest Operations (Last Hour)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.performance.slowest.map((op: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{op.name}</div>
                          <div className="text-xs text-gray-500">
                            {op.type} • {op.timestamp}
                          </div>
                        </div>
                        <div className={`text-sm font-bold px-3 py-1 rounded ${
                          op.duration > 1000 ? 'bg-red-100 text-red-700' :
                          op.duration > 500 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {op.duration}ms
                        </div>
                      </div>
                    ))}
                    {summary.performance.slowest.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No operations recorded</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Performance by Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Last 5 Minutes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(summary.performance.last5Minutes.byType as Record<string, any>).map(([type, stats]: [string, any]) => (
                        <div key={type}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium capitalize">{type}</span>
                            <span className="text-sm text-gray-600">{stats.count} ops</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  stats.avg > 1000 ? 'bg-red-500' :
                                  stats.avg > 500 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((stats.avg / 2000) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-16 text-right">
                              {Math.round(stats.avg)}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Last Hour</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(summary.performance.last1Hour.byType as Record<string, any>).map(([type, stats]: [string, any]) => (
                        <div key={type}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium capitalize">{type}</span>
                            <span className="text-sm text-gray-600">{stats.count} ops</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  stats.avg > 1000 ? 'bg-red-500' :
                                  stats.avg > 500 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((stats.avg / 2000) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-16 text-right">
                              {Math.round(stats.avg)}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.errors.recent.map((error: any, idx: number) => (
                      <div key={idx} className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm text-red-800 capitalize">{error.type}</div>
                          <div className="text-xs text-gray-600">{error.timestamp}</div>
                        </div>
                        <div className="text-sm text-gray-800 mb-1">
                          {error.component && <span className="font-mono bg-white px-2 py-0.5 rounded mr-2">{error.component}</span>}
                          {error.message}
                        </div>
                      </div>
                    ))}
                    {summary.errors.recent.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-green-600 text-4xl mb-2">✓</div>
                        <p className="text-gray-600">No errors recorded</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent User Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.userActions.recent.map((action: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{action.action}</div>
                          {action.component && (
                            <div className="text-xs text-gray-600 mt-0.5">in {action.component}</div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{action.timestamp}</div>
                      </div>
                    ))}
                    {summary.userActions.recent.length === 0 && (
                      <p className="text-center text-gray-500 py-8">No actions recorded</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
