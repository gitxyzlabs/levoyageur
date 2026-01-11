import { useState, useEffect } from 'react';
import { Map as GoogleMap, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import type { Location } from '../../utils/api';
import { Star, Award, Users } from 'lucide-react';

interface MapProps {
  locations: Location[];
  heatMapData?: Location[];
  showHeatMap: boolean;
  googleMapsApiKey: string;
  onLocationClick?: (location: Location) => void;
  onAddLocationRequest?: (place: any) => void;
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

export function Map({ locations, heatMapData, showHeatMap, googleMapsApiKey, onLocationClick }: MapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ rating: null, count: null });
  const map = useMap();

  const displayLocations = showHeatMap && heatMapData ? heatMapData : locations;

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
    
    // Fetch Google rating if place_id exists
    if (location.place_id && window.google && map) {
      try {
        const service = new google.maps.places.PlacesService(map);
        
        service.getDetails(
          { placeId: location.place_id, fields: ['rating', 'user_ratings_total'] },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              setGoogleRating({
                rating: place.rating ?? null,
                count: place.user_ratings_total ?? null,
              });
            }
          }
        );
      } catch (error) {
        console.error('Error fetching Google place details:', error);
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
        defaultZoom={13}
        defaultCenter={{ lat: 32.7157, lng: -117.1611 }}
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
          <InfoWindow
            position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
            onCloseClick={() => {
              setSelectedLocation(null);
              setGoogleRating({ rating: null, count: null });
            }}
            headerDisabled
          >
            <div className="p-4 max-w-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{selectedLocation.name}</h3>
                  {selectedLocation.description && (
                    <p className="text-xs text-gray-600">{selectedLocation.description}</p>
                  )}
                </div>
                {(selectedLocation.lvEditorsScore ?? 0) >= 9.5 && (
                  <Award className="text-amber-500 ml-2 flex-shrink-0" size={24} />
                )}
              </div>

              {/* Rating Display */}
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gradient-to-r from-amber-50 to-rose-50 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-extrabold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">
                    {selectedLocation.lvEditorsScore?.toFixed(1) ?? '—'}
                  </div>
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    {selectedLocation.lvEditorsScore ? getRatingLabel(selectedLocation.lvEditorsScore) : 'LV Rating'}
                  </p>
                </div>
                <div className="text-center border-l border-gray-200 pl-3">
                  <div className="text-3xl font-extrabold text-gray-800">
                    {googleRating.rating?.toFixed(1) ?? '—'}
                  </div>
                  <div className="mt-1">
                    {renderStars(googleRating.rating)}
                  </div>
                  <p className="text-xs text-gray-600 font-medium mt-1">
                    {googleRating.count ? `${googleRating.count} reviews` : 'Google'}
                  </p>
                </div>
              </div>

              {/* All Scores */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span className="text-gray-600">LV Editors</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{selectedLocation.lvEditorsScore?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-600">LV Community</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-blue-400 text-blue-400" />
                    <span className="font-semibold">{selectedLocation.lvCrowdsourceScore?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Google Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{selectedLocation.googleRating?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Michelin Score</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-red-400 text-red-400" />
                    <span className="font-semibold">{selectedLocation.michelinScore?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedLocation.tags && selectedLocation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-3 border-t border-gray-200">
                  {selectedLocation.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs bg-gradient-to-r from-amber-100 to-rose-100 text-gray-700 font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}