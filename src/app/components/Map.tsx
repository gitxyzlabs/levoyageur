import { useState, useEffect } from 'react';
import { Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Location, User } from '../../utils/api';
import { LocationInfoWindow } from './LocationInfoWindow';

interface MapProps {
  locations: Location[];
  heatMapData?: Location[];
  showHeatMap: boolean;
  googleMapsApiKey: string;
  onLocationClick?: (location: Location) => void;
  onAddLocationRequest?: (place: any) => void;
  user: User | null;
  isAuthenticated: boolean;
  onFavoriteToggle?: () => void;
  mapCenter?: { lat: number; lng: number } | null;
  mapZoom?: number;
}

// Helper functions for marker styling
const getMarkerColor = (rating: number = 5) => {
  // Modern, natural luxury color palette
  if (rating >= 10.5) return '#0f172a'; // Deep charcoal - Legendary
  if (rating >= 9.5) return '#064e3b';  // Forest green - Exceptional
  if (rating >= 8.5) return '#0f766e';  // Deep teal - Outstanding
  if (rating >= 7.5) return '#b87333';  // Bronze - Excellent
  if (rating >= 6.5) return '#78716c';  // Warm stone - Very Good
  return '#94a3b8';                      // Soft slate - Good
};

const getRatingLabel = (rating: number) => {
  if (rating >= 10.5) return 'Legendary';
  if (rating >= 9.5) return 'Exceptional';
  if (rating >= 8.5) return 'Outstanding';
  if (rating >= 7.5) return 'Excellent';
  if (rating >= 6.5) return 'Very Good';
  return 'Good';
};

export function Map({ 
  locations, 
  heatMapData, 
  showHeatMap, 
  googleMapsApiKey, 
  onLocationClick,
  user,
  isAuthenticated,
  onFavoriteToggle,
  mapCenter,
  mapZoom
}: MapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ rating: null, count: null });
  const map = useMap();

  const displayLocations = showHeatMap && heatMapData ? heatMapData : locations;

  // Pan to new center when mapCenter changes
  useEffect(() => {
    if (!map || !mapCenter) return;
    
    console.log('Panning map to new center:', mapCenter);
    map.panTo(mapCenter);
    
    if (mapZoom) {
      map.setZoom(mapZoom);
    }
  }, [map, mapCenter, mapZoom]);

  // Auto-fit bounds when locations change
  useEffect(() => {
    if (!map || displayLocations.length === 0) return;

    try {
      const bounds = new google.maps.LatLngBounds();
      displayLocations.forEach(location => {
        bounds.extend({ lat: location.lat, lng: location.lng });
      });
      
      map.fitBounds(bounds);
      
      // Set a max zoom level to prevent zooming in too much
      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
      });
      
      return () => {
        google.maps.event.removeListener(listener);
      };
    } catch (error) {
      console.error('Error fitting bounds:', error);
    }
  }, [map, displayLocations]);

  const handleMarkerClick = async (location: Location) => {
    setSelectedLocation(location);
    setGoogleRating({ rating: null, count: null });
    
    // Fetch Google rating if place_id exists and is valid
    if (location.place_id && window.google && map) {
      // Validate place_id format
      if (typeof location.place_id !== 'string' || location.place_id.trim() === '' ||
          location.place_id === 'undefined' || location.place_id === 'null') {
        console.log('Invalid place_id format for location:', location.name);
      } else {
        try {
          // Use the new Place API instead of deprecated PlacesService
          const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
          
          const place = new Place({
            id: location.place_id,
          });

          // Fetch the place details with the new API
          await place.fetchFields({
            fields: ['rating', 'userRatingCount'],
          });

          setGoogleRating({
            rating: place.rating ?? null,
            count: place.userRatingCount ?? null,
          });
        } catch (error) {
          console.error('Error fetching Google place details:', error);
        }
      }
    }
    
    if (onLocationClick) {
      onLocationClick(location);
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating == null) return <span className="text-xs text-gray-400">No rating</span>;
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      <span className="text-amber-400 text-sm">
        {'★'.repeat(full)}
        {half === 1 && '½'}
        {'☆'.repeat(empty)}
      </span>
    );
  };

  return (
    <div className="size-full">
      <GoogleMap
        defaultZoom={mapZoom ?? 13}
        defaultCenter={mapCenter ?? { lat: 32.7157, lng: -117.1611 }}
        className="size-full"
        mapId="le-voyageur-luxury-map"
        options={{
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          disableDefaultUI: false,
          zoomControl: true,
        }}
      >
        {displayLocations.map((location) => {
          const rating = location.lvEditorsScore || 5;
          const color = getMarkerColor(rating);
          const scale = showHeatMap ? 1 : 1.2;
          
          return (
            <AdvancedMarker
              key={location.id}
              position={{ lat: location.lat, lng: location.lng }}
              onClick={() => handleMarkerClick(location)}
              zIndex={selectedLocation?.id === location.id ? 1000 : 100}
            >
              <div
                className="relative cursor-pointer transition-all duration-200 hover:scale-110"
                style={{
                  width: `${32 * scale}px`,
                  height: `${40 * scale}px`,
                }}
              >
                {/* Modern pin shape with rating */}
                <div
                  className="absolute inset-x-0 top-0 flex items-center justify-center font-semibold"
                  style={{
                    backgroundColor: color,
                    width: `${32 * scale}px`,
                    height: `${32 * scale}px`,
                    borderRadius: '50% 50% 50% 0',
                    transform: 'rotate(-45deg)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
                    border: '2px solid rgba(255,255,255,0.95)',
                  }}
                >
                  <span
                    className="text-white"
                    style={{
                      transform: 'rotate(45deg)',
                      fontSize: `${10 * scale}px`,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </AdvancedMarker>
          );
        })}

        {selectedLocation && (
          <LocationInfoWindow
            location={selectedLocation}
            onClose={() => {
              setSelectedLocation(null);
              setGoogleRating({ rating: null, count: null });
            }}
            user={user}
            isAuthenticated={isAuthenticated}
            onFavoriteToggle={onFavoriteToggle}
          />
        )}
      </GoogleMap>
    </div>
  );
}