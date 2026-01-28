import React from 'react';
import { User as UserIcon, Mail, Shield, Calendar, MapPin, RefreshCw, Star, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { User } from '../../utils/api';
import { toast } from 'sonner';
import { api } from '../../utils/api';

interface ProfileProps {
  user: User;
  locationPermissionEnabled?: boolean;
  onLocationPermissionToggle?: (enabled: boolean) => void;
  favoritesCount?: number;
  wantToGoCount?: number;
  onMichelinSyncComplete?: () => void; // Callback to refresh locations after sync
}

export function Profile({ 
  user, 
  locationPermissionEnabled, 
  onLocationPermissionToggle,
  favoritesCount = 0,
  wantToGoCount = 0,
  onMichelinSyncComplete,
}: ProfileProps) {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{
    current: number;
    total: number;
    imported: number;
    added: number;
  } | null>(null);

  const handleMichelinSyncBatch = async () => {
    setIsSyncing(true);
    setSyncProgress(null);
    
    try {
      const BATCH_SIZE = 1000; // Process 1000 restaurants at a time
      let offset = 0;
      let totalAvailable = 0;
      let totalAdded = 0;
      let totalImported = 0;
      let hasMore = true;

      toast.info('Starting Michelin Guide batch import...', {
        description: 'This will import all 18,000+ restaurants in batches'
      });

      // First batch to get total count
      while (hasMore) {
        console.log(`🔄 Syncing batch at offset ${offset}...`);
        
        const result = await api.syncMichelinData(offset, BATCH_SIZE);
        
        console.log('✅ Batch sync result:', result);
        
        if (!result.success) {
          toast.error('Batch sync failed', {
            description: result.message
          });
          break;
        }

        totalAvailable = result.totalAvailable || 0;
        totalAdded += result.added || 0;
        totalImported += result.imported || 0;

        // Update progress
        setSyncProgress({
          current: offset + (result.imported || 0),
          total: totalAvailable,
          imported: totalImported,
          added: totalAdded
        });

        // Move to next batch
        offset += BATCH_SIZE;

        // Check if we've processed all data
        if (offset >= totalAvailable) {
          hasMore = false;
        }

        // Show progress toast
        toast.info(`Import progress: ${Math.min(offset, totalAvailable)}/${totalAvailable}`, {
          description: `Added ${totalAdded} new restaurants`
        });

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success('Michelin Guide import complete!', {
        description: `Successfully imported ${totalImported} restaurants, added ${totalAdded} new entries`
      });

      // Refresh locations on the map
      if (onMichelinSyncComplete) {
        onMichelinSyncComplete();
      }
    } catch (error: any) {
      console.error('Failed to sync Michelin data:', error);
      toast.error('Failed to sync Michelin data', {
        description: error.message || 'Please check the console for details'
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Avatar */}
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-light">
              {user.name.charAt(0).toUpperCase()}
            </div>
            
            {/* Name */}
            <div>
              <h2 className="text-2xl font-light tracking-wide">{user.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
            </div>
            
            {/* Role Badge */}
            <div className={`px-4 py-1.5 rounded-full text-xs font-medium ${
              user.role === 'editor' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-slate-100 text-slate-700'
            }`}>
              {user.role === 'editor' ? '✨ LV Editor' : 'Voyageur'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Email</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Account Type</p>
              <p className="text-sm text-muted-foreground">
                {user.role === 'editor' ? 'LV Editor (can add locations)' : 'Standard User'}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">User ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {user.id.slice(0, 16)}...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-light mb-1">{favoritesCount}</div>
              <p className="text-xs text-muted-foreground">Favorites</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-light mb-1">{wantToGoCount}</div>
              <p className="text-xs text-muted-foreground">Want to Go</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3 flex-1">
              <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Auto-detect Location</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically show your location on the map when you open the app
                </p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => {
                if (onLocationPermissionToggle) {
                  onLocationPermissionToggle(!locationPermissionEnabled);
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                locationPermissionEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={locationPermissionEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  locationPermissionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Michelin Guide Data Management - Editor Only */}
      {user.role === 'editor' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-red-600" />
              Michelin Guide Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 mb-1">Sync Michelin Guide Database</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Updates the Le Voyageur database with the latest Michelin Guide restaurants worldwide. 
                    This data is publicly available to all users after syncing.
                  </p>
                  <button
                    onClick={handleMichelinSyncBatch}
                    disabled={isSyncing}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isSyncing
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg'
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing Michelin Guide...' : 'Sync Michelin Guide'}
                  </button>
                </div>
              </div>
              
              {/* Progress Bar */}
              {syncProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-blue-900">Import Progress</span>
                    <span className="text-blue-700">
                      {syncProgress.current.toLocaleString()} / {syncProgress.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${(syncProgress.current / syncProgress.total * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-blue-700">
                    <span>Processed: {syncProgress.imported.toLocaleString()}</span>
                    <span>New entries: {syncProgress.added.toLocaleString()}</span>
                  </div>
                </div>
              )}
              
              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> The full import of 18,000+ restaurants will take several minutes. 
                  All synced Michelin ratings will be visible on the map with special red star markers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}