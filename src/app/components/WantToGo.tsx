import { useState, useEffect, useMemo } from 'react';
import { Bookmark, MapPin, Star, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import type { Location, User } from '../../utils/api';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface WantToGoProps {
  user: User;
  userLocation: { lat: number; lng: number } | null;
  onLocationClick?: (location: Location) => void;
}

export function WantToGo({ user, userLocation, onLocationClick }: WantToGoProps) {
  const [wantToGo, setWantToGo] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWantToGo();
  }, [user]);

  const loadWantToGo = async () => {
    setLoading(true);
    try {
      const { wantToGo: fetchedWantToGo } = await api.getWantToGo();
      console.log('✅ Want to go loaded:', fetchedWantToGo);
      setWantToGo(fetchedWantToGo);
    } catch (error) {
      console.error('❌ Failed to load want to go:', error);
      // Silently fail - don't show error to user
      setWantToGo([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const getDistanceText = (location: Location): string | null => {
    if (!userLocation) return null;
    const distance = calculateDistance(userLocation.lat, userLocation.lng, location.lat, location.lng);
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance.toFixed(1)}km away`;
  };

  const removeWantToGo = async (locationId: string, locationName: string) => {
    try {
      await api.removeWantToGo(locationId);
      setWantToGo(wantToGo.filter(wtg => wtg.id !== locationId));
      toast.success(`Removed ${locationName} from want to go`);
    } catch (error) {
      console.error('Failed to remove want to go:', error);
      toast.error('Failed to remove from want to go list');
    }
  };

  // Sort want-to-go locations by distance from user location - Memoized for performance
  const sortedWantToGo = useMemo(() => {
    if (!userLocation) return wantToGo;
    
    return [...wantToGo].sort((a, b) => {
      const distanceA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distanceB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distanceA - distanceB;
    });
  }, [wantToGo, userLocation]);

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-blue-500" />
          Want to Go
        </CardTitle>
        <CardDescription>
          {wantToGo.length === 0 
            ? 'No places yet' 
            : userLocation 
              ? 'Sorted by distance from you' 
              : `${wantToGo.length} saved location${wantToGo.length !== 1 ? 's' : ''}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-500">
            Loading want to go list...
          </div>
        ) : wantToGo.length === 0 ? (
          <div className="text-center py-8">
            <Bookmark className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 mb-2">
              No places in your want to go list yet
            </p>
            <p className="text-xs text-slate-400">
              Click the bookmark icon on any location to add it
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedWantToGo.map((location) => {
              const distanceText = getDistanceText(location);
              
              return (
                <div
                  key={location.id}
                  className="group p-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all cursor-pointer border border-slate-200"
                  onClick={() => onLocationClick?.(location)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 mb-1 truncate">
                        {location.name}
                      </h4>
                      
                      {location.description && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-1">
                          {location.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {distanceText && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {distanceText}
                          </span>
                        )}
                        {location.lvEditorsScore && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {location.lvEditorsScore.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {location.tags && location.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {location.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-white text-slate-600 rounded-full border border-slate-200"
                            >
                              {tag}
                            </span>
                          ))}
                          {location.tags.length > 2 && (
                            <span className="px-2 py-0.5 text-xs text-slate-400">
                              +{location.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWantToGo(location.id, location.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded"
                    >
                      <Bookmark className="w-4 h-4 fill-blue-500 text-blue-500" />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
                        window.open(url, '_blank');
                      }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Navigation className="h-3 w-3" />
                      Directions
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}