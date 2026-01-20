import { useState, useEffect } from 'react';
import { Heart, MapPin, Star, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import type { Location, User } from '../../utils/api';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface FavoritesProps {
  user: User;
  userLocation: { lat: number; lng: number } | null;
  onLocationClick?: (location: Location) => void;
}

export function Favorites({ user, userLocation, onLocationClick }: FavoritesProps) {
  const [favorites, setFavorites] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, [user]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const { favorites: fetchedFavorites } = await api.getFavorites();
      console.log('✅ Favorites loaded:', fetchedFavorites);
      setFavorites(fetchedFavorites);
    } catch (error) {
      console.error('❌ Failed to load favorites:', error);
      // Silently fail - don't show error to user
      setFavorites([]);
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

  const removeFavorite = async (locationId: string, locationName: string) => {
    try {
      await api.removeFavorite(locationId);
      setFavorites(favorites.filter(fav => fav.id !== locationId));
      toast.success(`Removed ${locationName} from favorites`);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      toast.error('Failed to remove favorite');
    }
  };

  // Sort favorites by distance from user location
  const sortedFavorites = userLocation 
    ? [...favorites].sort((a, b) => {
        const distanceA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distanceB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distanceA - distanceB;
      })
    : favorites;

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          Favorites
        </CardTitle>
        <CardDescription>
          {favorites.length === 0 
            ? 'No favorites yet' 
            : userLocation 
              ? 'Sorted by distance from you' 
              : `${favorites.length} saved location${favorites.length !== 1 ? 's' : ''}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-slate-500">
            Loading favorites...
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Heart your favorite spots to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sortedFavorites.map((location, index) => (
              <div
                key={location.id}
                className="group p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all cursor-pointer relative"
                onClick={() => onLocationClick?.(location)}
              >
                {/* Distance Badge */}
                {userLocation && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    <Navigation className="w-3 h-3" />
                    {getDistanceText(location)}
                  </div>
                )}

                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 pr-20">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">
                      {index + 1}. {location.name}
                    </h4>
                    {location.description && (
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {location.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="font-semibold">{location.lvEditorsScore?.toFixed(1)}</span>
                    </div>
                    {location.michelinScore > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-red-400 text-red-400" />
                        <span className="font-semibold">{location.michelinScore}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(location.id, location.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                </div>

                {/* Tags */}
                {location.tags && location.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {location.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-xs bg-white text-gray-600 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}