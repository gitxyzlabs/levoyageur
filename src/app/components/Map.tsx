import { useState, useEffect } from 'react';
import { Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Location, User } from '../../utils/api';
import { LocationInfoWindow } from './LocationInfoWindow';
import { GooglePlaceInfoWindow } from './GooglePlaceInfoWindow';

interface MapProps {
  locations: Location[];
  heatMapData?: Location[];
  showHeatMap: boolean;
  googleMapsApiKey: string;
  onLocationClick?: (location: Location) => void;
  onAddLocationRequest?: (place: any) => void;
  user?: { id: string; email: string; name: string; role: 'user' | 'editor' } | null;
  isAuthenticated?: boolean;
  onFavoriteToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string }) => void;
  onWantToGoToggle?: (locationId: string) => void;
  favoriteIds?: Set<string>;
  wantToGoIds?: Set<string>;
  mapCenter?: { lat: number; lng: number } | null;
  mapZoom?: number;
  selectedGooglePlace?: google.maps.places.PlaceResult | null;
  onGooglePlaceClose?: () => void;
  onPOIClick?: (place: google.maps.places.PlaceResult) => void;
  onMapBoundsChange?: (bounds: google.maps.LatLngBounds) => void;
  searchResults?: google.maps.places.PlaceResult[];
  showSearchResults?: boolean;
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
  onWantToGoToggle,
  favoriteIds,
  wantToGoIds,
  mapCenter,
  mapZoom,
  selectedGooglePlace,
  onGooglePlaceClose,
  onPOIClick,
  onMapBoundsChange,
  searchResults,
  showSearchResults
}: MapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [clickedPOI, setClickedPOI] = useState<google.maps.places.PlaceResult | null>(null);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ rating: null, count: null });
  const map = useMap();

  const displayLocations = showHeatMap && heatMapData ? heatMapData : locations;

  // Set map padding to avoid InfoWindows being covered by search bar
  useEffect(() => {
    if (!map) return;
    
    // Add padding to the top of the map viewport
    // This ensures InfoWindows and other UI elements respect the search bar area
    map.setOptions({
      padding: {
        top: 120, // Space for search bar + some buffer
        bottom: 20,
        left: 20,
        right: 20,
      },
    });
  }, [map]);

  // Pan to new center when mapCenter changes
  useEffect(() => {
    if (!map || !mapCenter) return;
    
    console.log('Panning map to new center:', mapCenter);
    map.panTo(mapCenter);
    
    if (mapZoom) {
      map.setZoom(mapZoom);
    }
  }, [map, mapCenter, mapZoom]);

  // Track map bounds changes
  useEffect(() => {
    if (!map || !onMapBoundsChange) return;

    const listener = map.addListener('bounds_changed', () => {
      const bounds = map.getBounds();
      if (bounds) {
        onMapBoundsChange(bounds);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onMapBoundsChange]);

  // Add POI click listener
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('click', async (event: google.maps.MapMouseEvent) => {
      // Check if the click was on a POI (Point of Interest)
      if (event.placeId) {
        // Prevent the default info window from showing
        event.stop();
        
        console.log('POI clicked:', event.placeId);
        
        try {
          // Fetch place details using the new Places API
          const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
          
          const place = new Place({
            id: event.placeId,
          });
          
          // Fetch the place details
          await place.fetchFields({
            fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'types', 'websiteURI', 'nationalPhoneNumber']
          });
          
          // Convert to PlaceResult format
          const placeResult: google.maps.places.PlaceResult = {
            place_id: event.placeId,
            name: place.displayName,
            formatted_address: place.formattedAddress,
            geometry: place.location ? {
              location: place.location
            } : undefined,
            rating: place.rating,
            user_ratings_total: place.userRatingCount,
            types: place.types,
            website: place.websiteURI,
            formatted_phone_number: place.nationalPhoneNumber,
          };
          
          // Close any open LV location info window
          setSelectedLocation(null);
          
          // Show the LV custom info window for this Google Place
          setClickedPOI(placeResult);
          
          if (onPOIClick) {
            onPOIClick(placeResult);
          }
        } catch (error) {
          console.error('Error fetching place details:', error);
        }
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onPOIClick]);

  const handleMarkerClick = async (location: Location) => {
    setSelectedLocation(location);
    setClickedPOI(null); // Close any POI info window
    
    // Fetch Google rating if place_id exists
    if (!location.place_id || 
        location.place_id === '' || 
        location.place_id === 'undefined' || 
        location.place_id === 'null') {
      console.log('Invalid place_id format for location:', location.name);
      setGoogleRating({ rating: null, count: null });
    } else {
      try {
        // Use the new Place API instead of deprecated PlacesService
        const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
        
        const place = new Place({
          id: location.place_id,
        });

        await place.fetchFields({
          fields: ['rating', 'userRatingCount']
        });

        setGoogleRating({ 
          rating: place.rating ?? null, 
          count: place.userRatingCount ?? null 
        });
      } catch (error) {
        console.error('Error fetching Google rating:', error);
        setGoogleRating({ rating: null, count: null });
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
                {/* Marker Pin */}
                <svg 
                  viewBox="0 0 32 40" 
                  className="drop-shadow-lg"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                >
                  <path
                    d="M16 0C9.373 0 4 5.373 4 12c0 8.5 12 28 12 28s12-19.5 12-28c0-6.627-5.373-12-12-12z"
                    fill={color}
                  />
                  <circle cx="16" cy="12" r="4" fill="white" fillOpacity="0.9" />
                </svg>
                
                {/* Rating Badge */}
                {!showHeatMap && (
                  <div 
                    className="absolute -top-2 -right-2 bg-white text-slate-900 text-xs font-semibold px-1.5 py-0.5 rounded-full shadow-md border border-slate-200"
                    style={{ fontSize: '10px' }}
                  >
                    {rating.toFixed(1)}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          );
        })}

        {/* Search Results Markers */}
        {showSearchResults && searchResults && searchResults.map((place) => {
          const lat = place.geometry?.location?.lat ? 
            (typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat) : null;
          const lng = place.geometry?.location?.lng ? 
            (typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng) : null;
          if (!lat || !lng) return null;
          
          return (
            <AdvancedMarker
              key={place.place_id}
              position={{ lat, lng }}
              onClick={() => setClickedPOI(place)}
              zIndex={clickedPOI?.place_id === place.place_id ? 1000 : 50}
            >
              <div
                className="relative cursor-pointer transition-all duration-200 hover:scale-110"
                style={{
                  width: '28px',
                  height: '36px',
                }}
              >
                {/* Search Result Pin (Blue) */}
                <svg 
                  viewBox="0 0 32 40" 
                  className="drop-shadow-lg"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                >
                  <path
                    d="M16 0C9.373 0 4 5.373 4 12c0 8.5 12 28 12 28s12-19.5 12-28c0-6.627-5.373-12-12-12z"
                    fill="#3b82f6"
                  />
                  <circle cx="16" cy="12" r="4" fill="white" fillOpacity="0.9" />
                </svg>
                
                {/* Google Rating Badge */}
                {place.rating && (
                  <div 
                    className="absolute -top-2 -right-2 bg-white text-slate-900 text-xs font-semibold px-1.5 py-0.5 rounded-full shadow-md border border-blue-200"
                    style={{ fontSize: '10px' }}
                  >
                    {place.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          );
        })}
        
        {selectedLocation && !clickedPOI && (
          <LocationInfoWindow
            location={selectedLocation}
            googleRating={googleRating.rating}
            googleRatingCount={googleRating.count}
            onClose={() => {
              setSelectedLocation(null);
              setGoogleRating({ rating: null, count: null });
            }}
            user={user}
            isAuthenticated={isAuthenticated}
            onFavoriteToggle={onFavoriteToggle}
            onWantToGoToggle={onWantToGoToggle}
            favoriteIds={favoriteIds}
            wantToGoIds={wantToGoIds}
          />
        )}

        {(selectedGooglePlace || clickedPOI) && !selectedLocation && (
          <GooglePlaceInfoWindow
            place={clickedPOI || selectedGooglePlace!}
            onClose={() => {
              setClickedPOI(null);
              if (onGooglePlaceClose) {
                onGooglePlaceClose();
              }
            }}
            user={user}
            isAuthenticated={isAuthenticated}
            onFavoriteToggle={onFavoriteToggle}
            onWantToGoToggle={onWantToGoToggle}
            favoriteIds={favoriteIds}
            wantToGoIds={wantToGoIds}
          />
        )}
      </GoogleMap>
    </div>
  );
}