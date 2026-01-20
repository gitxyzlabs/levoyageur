import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Location, User } from '../../utils/api';
import { GooglePlaceInfoWindow } from './GooglePlaceInfoWindow';
import { MobileInfoSheet } from './MobileInfoSheet';
import { CityInfoWindow } from './CityInfoWindow';
import { LuxuryMarker } from './LuxuryMarker';
import { MichelinMarker } from './MichelinMarker';
import { Locate, Plus, Minus } from 'lucide-react';

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
  onWantToGoToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => void;
  onRatingAdded?: () => void;
  favoriteIds?: Set<string>;
  wantToGoIds?: Set<string>;
  wantToGoLocations?: Location[]; // Full want-to-go locations for rendering markers
  mapCenter?: { lat: number; lng: number } | null;
  mapZoom?: number;
  selectedGooglePlace?: google.maps.places.PlaceResult | null;
  selectedLVLocation?: Location | null; // LV location data for the selected place
  selectedCity?: google.maps.places.PlaceResult | null; // City/region selection
  cityStats?: { totalLVRatings: number; totalFavorites: number }; // Stats for selected city
  onGooglePlaceClose?: () => void;
  onPOIClick?: (place: google.maps.places.PlaceResult, lvLocation?: Location) => void;
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

// Luxury map styling - muted, sophisticated aesthetic
const luxuryMapStyles = [
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }] // Soft slate for all text
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [{ visibility: 'off' }] // Remove text stroke for cleaner look
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e0f2fe' }] // Soft blue water
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f8fafc' }] // Light background
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }] // White roads
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#e2e8f0' }] // Subtle road borders
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#fef3c7' }] // Soft gold for highways
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#fbbf24' }] // Gold stroke for highways
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }] // Subtle POI background
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#d1fae5' }] // Soft green for parks
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }] // Hide default business markers
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'simplified' }] // Simplified transit
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }] // Subtle borders
  }
];

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
  onRatingAdded,
  favoriteIds,
  wantToGoIds,
  wantToGoLocations,
  mapCenter,
  mapZoom,
  selectedGooglePlace,
  selectedLVLocation,
  selectedCity,
  cityStats,
  onGooglePlaceClose,
  onPOIClick,
  onMapBoundsChange,
  searchResults,
  showSearchResults
}: MapProps) {
  const map = useMap();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(14);

  // Memoize the displayed locations for performance
  const displayLocations = useMemo(() => {
    return showHeatMap && heatMapData ? heatMapData : locations;
  }, [showHeatMap, heatMapData, locations]);

  // Memoize LV markers that should be displayed
  const lvMarkersToDisplay = useMemo(() => {
    if (showSearchResults) return [];
    
    return displayLocations.filter((location) => {
      // Only show markers for locations that have an LV rating
      return !!(location.lvEditorsScore || location.lvCrowdsourceScore);
    });
  }, [displayLocations, showSearchResults]);

  // Memoize want-to-go markers that should be displayed
  const wantToGoMarkersToDisplay = useMemo(() => {
    if (!isAuthenticated || !wantToGoLocations) return [];
    
    return wantToGoLocations.filter((location) => {
      // Only show want-to-go markers for locations that DON'T have LV ratings
      return !(location.lvEditorsScore || location.lvCrowdsourceScore);
    });
  }, [isAuthenticated, wantToGoLocations]);

  // Debug logging for marker filtering
  useEffect(() => {
    console.log('🗺️ Map Display Logic:', {
      showHeatMap,
      totalLocations: locations.length,
      heatMapDataCount: heatMapData?.length || 0,
      displayingCount: displayLocations.length,
      isFiltered: showHeatMap && heatMapData ? true : false
    });
  }, [showHeatMap, locations, heatMapData, displayLocations]);

  // Get user's current location
  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('📍 User location:', location);
          setUserLocation(location);
          setLocationPermissionDenied(false);
          
          // Pan map to user's location
          if (map) {
            map.panTo(location);
          }
        },
        (error) => {
          console.log('ℹ️ User location not available');
          setLocationPermissionDenied(true);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  };

  // Don't auto-request location on mount (causes permission errors)
  // Users can click the "My Location" button instead
  useEffect(() => {
    // Optionally auto-request if you want, but it's better to let users control this
    // getUserLocation();
  }, []);

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

  // Track zoom level changes
  useEffect(() => {
    if (!map) return;

    const zoomListener = map.addListener('zoom_changed', () => {
      const zoom = map.getZoom();
      if (zoom !== undefined) {
        setCurrentZoom(zoom);
      }
    });

    // Set initial zoom
    const initialZoom = map.getZoom();
    if (initialZoom !== undefined) {
      setCurrentZoom(initialZoom);
    }

    return () => {
      google.maps.event.removeListener(zoomListener);
    };
  }, [map]);

  // Add POI click listener (for Google POIs on the map)
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('click', async (event: google.maps.MapMouseEvent) => {
      // Check if the click was on a POI (Point of Interest)
      if (event.placeId) {
        // Prevent the default info window from showing
        event.stop();
        
        console.log('🗺️ Google POI clicked:', event.placeId);
        
        try {
          // Fetch place details using the new Places API
          const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
          
          const place = new Place({
            id: event.placeId,
          });
          
          // Fetch the place details WITH PHOTOS AND TYPES
          await place.fetchFields({
            fields: [
              'displayName', 
              'formattedAddress', 
              'location', 
              'rating', 
              'userRatingCount', 
              'types', 
              'websiteURI', 
              'nationalPhoneNumber',
              'photos'
            ]
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
            photos: place.photos,
          };
          
          // Notify parent to show InfoWindow
          if (onPOIClick) {
            onPOIClick(placeResult);
          }
        } catch (error) {
          console.error('Error fetching place details:', error);
        }
      } else {
        // Click was on the map (not a POI) - close all info windows
        if (onGooglePlaceClose) {
          onGooglePlaceClose();
        }
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, onPOIClick, onGooglePlaceClose]);

  // Helper function to check if a string is a valid Google Place ID (not a UUID)
  const isValidGooglePlaceId = (id: string | undefined): boolean => {
    if (!id) return false;
    // Google Place IDs don't look like UUIDs (no dashes in that pattern)
    // UUIDs look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return !uuidPattern.test(id) && id !== 'undefined' && id !== 'null' && id !== '';
  };

  const handleMarkerClick = async (location: Location) => {
    try {
      console.log('\n🎯 === LV MARKER CLICKED ===');
      console.log('📍 Location:', location.name);
      console.log('🆔 Place ID (place_id):', location.place_id);
      console.log('🆔 Place ID (placeId):', location.placeId);
      console.log('⭐ LV Editors Score:', location.lvEditorsScore);
      console.log('👥 LV Crowd Score:', location.lvCrowdsourceScore);
      
      // Support both placeId (camelCase from backend) and place_id (snake_case)
      const placeId = location.placeId || location.place_id;
      
      // If no place_id, create a minimal PlaceResult from LV data
      if (!placeId) {
        console.log('⚠️ No place_id - showing LV-only InfoWindow');
        
        const minimalPlaceResult: google.maps.places.PlaceResult = {
          place_id: location.id, // Use LV location ID as fallback
          name: location.name,
          formatted_address: location.address || undefined,
          geometry: {
            location: new google.maps.LatLng(location.lat, location.lng)
          },
          // No Google photos, ratings, or other data
        };
        
        console.log('📤 Sending minimal PlaceResult (LV only)');
        
        if (onPOIClick) {
          onPOIClick(minimalPlaceResult, location);
        }
        return;
      }

      // Fetch Google Place details for this LV location
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const place = new Place({
        id: placeId,
      });

      // Fetch full place details including photos
      await place.fetchFields({
        fields: [
          'displayName',
          'formattedAddress', 
          'location',
          'photos',
          'rating',
          'userRatingCount',
          'types',
          'websiteURI',
          'nationalPhoneNumber',
          'editorialSummary'
        ],
      });

      console.log('📸 Photos fetched:', place.photos?.length || 0);
      console.log('⭐ Google rating:', place.rating);
      console.log('👤 Rating count:', place.userRatingCount);

      // Convert to PlaceResult format
      const placeResult: google.maps.places.PlaceResult = {
        place_id: placeId,
        name: place.displayName || location.name,
        formatted_address: place.formattedAddress || location.address || undefined,
        geometry: place.location ? {
          location: place.location
        } : undefined,
        rating: place.rating,
        user_ratings_total: place.userRatingCount,
        website: place.websiteURI,
        formatted_phone_number: place.nationalPhoneNumber,
        photos: place.photos,
        types: place.types,
      };

      console.log('📤 Sending PlaceResult to parent:', {
        name: placeResult.name,
        photoCount: placeResult.photos?.length || 0,
        rating: placeResult.rating,
        hasLVData: true
      });
      
      // Notify parent to show InfoWindow with both Google and LV data
      if (onPOIClick) {
        onPOIClick(placeResult, location);
      }
    } catch (error) {
      console.error('❌ Error fetching Google Place details for LV marker:', error);
      
      // On error, still show InfoWindow with LV-only data
      const fallbackPlaceResult: google.maps.places.PlaceResult = {
        place_id: location.placeId || location.place_id || location.id,
        name: location.name,
        formatted_address: location.address || undefined,
        geometry: {
          location: new google.maps.LatLng(location.lat, location.lng)
        },
      };
      
      if (onPOIClick) {
        onPOIClick(fallbackPlaceResult, location);
      }
    }
    
    if (onLocationClick) {
      onLocationClick(location);
    }
  };

  return (
    <div className="size-full relative">
      {/* Custom Map Controls - Luxury Design */}
      <div className="absolute bottom-24 md:bottom-6 right-4 z-50 flex flex-col gap-2">
        {/* Zoom In */}
        <button
          onClick={() => {
            if (map) {
              const currentZoom = map.getZoom() || 14;
              map.setZoom(currentZoom + 1);
            }
          }}
          className="p-2.5 bg-white/95 backdrop-blur-sm hover:bg-slate-50 rounded-lg shadow-lg border border-slate-200/50 transition-all hover:scale-105 hover:shadow-xl"
          title="Zoom in"
        >
          <Plus className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => {
            if (map) {
              const currentZoom = map.getZoom() || 14;
              map.setZoom(currentZoom - 1);
            }
          }}
          className="p-2.5 bg-white/95 backdrop-blur-sm hover:bg-slate-50 rounded-lg shadow-lg border border-slate-200/50 transition-all hover:scale-105 hover:shadow-xl"
          title="Zoom out"
        >
          <Minus className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
        </button>

        {/* Divider */}
        <div className="h-px bg-slate-200 mx-1" />

        {/* My Location */}
        <button
          onClick={getUserLocation}
          className="p-2.5 bg-white/95 backdrop-blur-sm hover:bg-slate-50 rounded-lg shadow-lg border border-slate-200/50 transition-all hover:scale-105 hover:shadow-xl"
          title="My Location"
        >
          <Locate className={`w-5 h-5 ${userLocation ? 'text-blue-500' : 'text-slate-700'}`} strokeWidth={2.5} />
        </button>
      </div>
      
      <GoogleMap
        defaultZoom={mapZoom ?? 14}
        defaultCenter={mapCenter ?? { lat: 32.7157, lng: -117.1611 }}
        className="size-full"
        mapId="le-voyageur-luxury-map"
        options={{
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          zoomControl: false,
          scaleControl: false,
          rotateControl: false,
          panControl: false,
          keyboardShortcuts: false,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
        }}
      >
        {/* LV Location Markers - Show when heat map is active OR when no search results */}
        {(showHeatMap || !showSearchResults) && lvMarkersToDisplay
          .map((location) => {
          const rating = location.lvEditorsScore || 5;
          const scale = showHeatMap ? 0.8 : 1;
          const isFavorite = favoriteIds?.has(location.id) || favoriteIds?.has(location.place_id || '');
          const isWantToGo = wantToGoIds?.has(location.id) || wantToGoIds?.has(location.place_id || '');
          const hasLVRating = !!(location.lvEditorsScore || location.lvCrowdsourceScore);
          const hasMichelin = !!(location.michelinScore && location.michelinScore > 0);
          
          return (
            <AdvancedMarker
              key={location.id}
              position={{ lat: location.lat, lng: location.lng }}
              onClick={() => handleMarkerClick(location)}
              zIndex={selectedGooglePlace?.place_id === location.place_id ? 1000 : 100}
            >
              <div className="relative">
                <LuxuryMarker
                  rating={rating}
                  scale={scale}
                  showHeatMap={showHeatMap}
                  isFavorite={isFavorite}
                  isWantToGo={isWantToGo}
                  hasLVRating={hasLVRating}
                  type="lv-location"
                  locationName={location.name}
                  currentZoom={currentZoom}
                  michelinScore={location.michelinScore}
                />
                {/* Michelin badge on left side if location has Michelin rating */}
                {hasMichelin && hasLVRating && (
                  <MichelinMarker
                    michelinScore={location.michelinScore!}
                    scale={scale}
                    hasLVRating={true}
                    lvRating={rating}
                  />
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
              onClick={() => {
                if (onPOIClick) {
                  onPOIClick(place);
                }
              }}
              zIndex={selectedGooglePlace?.place_id === place.place_id ? 1000 : 50}
            >
              <LuxuryMarker
                rating={place.rating || 5}
                scale={0.9}
                type="search-result"
                locationName={place.name}
                currentZoom={currentZoom}
              />
            </AdvancedMarker>
          );
        })}
        
        {/* Want-to-Go Markers (for logged in users) - Green bookmarks for locations without LV ratings */}
        {isAuthenticated && wantToGoMarkersToDisplay && wantToGoMarkersToDisplay
          .map((location) => {
          return (
            <AdvancedMarker
              key={`want-to-go-${location.id}`}
              position={{ lat: location.lat, lng: location.lng }}
              onClick={() => handleMarkerClick(location)}
              zIndex={90}
            >
              <LuxuryMarker
                rating={0}
                scale={1}
                showHeatMap={false}
                isFavorite={false}
                isWantToGo={true}
                hasLVRating={false}
                type="want-to-go"
                locationName={location.name}
                currentZoom={currentZoom}
              />
            </AdvancedMarker>
          );
        })}
        
        {/* User's Current Location Marker */}
        {userLocation && (
          <AdvancedMarker
            position={userLocation}
            zIndex={200}
          >
            <div className="relative">
              {/* Pulsing blue dot */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-blue-500/30 rounded-full animate-ping" />
              </div>
              {/* Static blue dot with white border */}
              <div className="relative w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-lg" />
            </div>
          </AdvancedMarker>
        )}
        
        {/* Single InfoWindow - controlled by parent's selectedGooglePlace - DESKTOP ONLY */}
        <div className="hidden md:block">
          {selectedGooglePlace && (
            <GooglePlaceInfoWindow
              place={selectedGooglePlace}
              onClose={() => {
                if (onGooglePlaceClose) {
                  onGooglePlaceClose();
                }
              }}
              user={user}
              isAuthenticated={isAuthenticated}
              onFavoriteToggle={onFavoriteToggle}
              onWantToGoToggle={onWantToGoToggle}
              onRatingAdded={onRatingAdded}
              favoriteIds={favoriteIds}
              wantToGoIds={wantToGoIds}
              lvLocation={selectedLVLocation} // We'll need to pass this from App.tsx
            />
          )}
        </div>
        
        {/* City/Region InfoWindow - controlled by parent's selectedCity - DESKTOP ONLY */}
        <div className="hidden md:block">
          {selectedCity && cityStats && (
            <CityInfoWindow
              place={selectedCity}
              onClose={() => {
                if (onGooglePlaceClose) {
                  onGooglePlaceClose();
                }
              }}
              totalLVRatings={cityStats.totalLVRatings}
              totalFavorites={cityStats.totalFavorites}
            />
          )}
        </div>
      </GoogleMap>
      
      {/* Mobile Info Sheet - MOBILE ONLY */}
      <div className="md:hidden">
        {selectedGooglePlace && (
          <MobileInfoSheet
            place={selectedGooglePlace}
            onClose={() => {
              if (onGooglePlaceClose) {
                onGooglePlaceClose();
              }
            }}
            user={user}
            isAuthenticated={isAuthenticated}
            onFavoriteToggle={onFavoriteToggle}
            onWantToGoToggle={onWantToGoToggle}
            onRatingAdded={onRatingAdded}
            favoriteIds={favoriteIds}
            wantToGoIds={wantToGoIds}
            lvLocation={selectedLVLocation}
          />
        )}
      </div>
    </div>
  );
}