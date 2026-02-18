import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Location, User } from '@/utils/api';
import { api } from '@/utils/api';
import { GooglePlaceInfoWindow } from './GooglePlaceInfoWindow';
import { MobileInfoSheet } from './MobileInfoSheet';
import { CityInfoWindow } from './CityInfoWindow';
import { LuxuryMarker } from './LuxuryMarker';
import { PlaceIdValidationPopup } from './PlaceIdValidationPopup';
import { Locate, Plus, Minus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';

// Map component for Le Voyageur
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
  onRefresh?: () => void; // Callback to refresh locations after rating is saved
  favoriteIds?: Set<string>;
  wantToGoIds?: Set<string>;
  wantToGoPlaceIds?: Set<string>; // Google Place IDs for info window checks
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
  showLVMarkers?: boolean;
  showMichelinMarkers?: boolean;
  filterMenuOpen?: boolean;
  onFilterMenuToggle?: (open: boolean) => void;
  onLVMarkersToggle?: () => void;
  onMichelinMarkersToggle?: () => void;
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

// ✅ Convert location's Michelin data to numeric score for LuxuryMarker
// Returns: 1-3 for stars, 4 for Bib Gourmand, 5 for Michelin Plate, 0 for none
const getMichelinScore = (location: Location): number => {
  if (location.michelinStars) {
    return location.michelinStars; // 1, 2, or 3
  }
  if (location.michelinDistinction) {
    const distinction = location.michelinDistinction.toLowerCase();
    if (distinction.includes('bib gourmand')) return 4;
    if (distinction.includes('plate') || distinction.includes('selected')) return 5;
  }
  // Backward compatibility with deprecated field
  if (location.michelinScore && location.michelinScore > 0) {
    return location.michelinScore;
  }
  return 0;
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
  onRefresh,
  favoriteIds,
  wantToGoIds,
  wantToGoPlaceIds,
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
  showSearchResults,
  showLVMarkers,
  showMichelinMarkers,
  filterMenuOpen,
  onFilterMenuToggle,
  onLVMarkersToggle,
  onMichelinMarkersToggle
}: MapProps) {
  const map = useMap();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [validationPopup, setValidationPopup] = useState<{
    michelinData: {
      id: number;
      name: string;
      address: string;
      location: string;
      lat: number;
      lng: number;
    };
    suggestedPlace: {
      id: string;
      displayName: string;
      formattedAddress: string;
      distance: number;
      rating?: number;
      userRatingCount?: number;
      priceLevel?: string;
      types?: string[];
    };
    confidenceScore: number;
  } | null>(null);

  // Memoize the displayed locations for performance
  const displayLocations = useMemo(() => {
    return showHeatMap && heatMapData ? heatMapData : locations;
  }, [showHeatMap, heatMapData, locations]);

  // Smart Priority System: Determine best marker type for each unique location
  const unifiedMarkers = useMemo(() => {
    if (showSearchResults) return [];

    // Helper to check if two locations match (same place)
    const locationsMatch = (loc1: any, loc2: any) => {
      // Match by Google Place ID
      if (loc1.place_id && loc2.place_id && loc1.place_id === loc2.place_id) return true;
      if (loc1.placeId && loc2.placeId && loc1.placeId === loc2.placeId) return true;
      if (loc1.place_id && loc2.placeId && loc1.place_id === loc2.placeId) return true;
      if (loc1.placeId && loc2.place_id && loc1.placeId === loc2.place_id) return true;
      
      // Match by coordinates (within ~100m)
      const coordsMatch = 
        Math.abs(loc1.lat - loc2.lat) < 0.001 &&
        Math.abs(loc1.lng - loc2.lng) < 0.001;
      
      return coordsMatch;
    };

    // Helper to determine best marker type for a location
    const getBestMarkerType = (
      hasLVRating: boolean,
      hasMichelinScore: boolean,
      isFavorite: boolean,
      isWantToGo: boolean
    ): 'lv' | 'michelin' | 'favorite' | 'want-to-go' | null => {
      // Priority 1: LV Rating (if filter is ON and location has LV rating)
      if (showLVMarkers && hasLVRating) return 'lv';
      
      // Priority 2: Michelin (if filter is ON and location has Michelin score)
      if (showMichelinMarkers && hasMichelinScore) return 'michelin';
      
      // Priority 3: Favorite (if user has favorited and no higher priority)
      if (isAuthenticated && isFavorite) return 'favorite';
      
      // Priority 4: Want to Go (if user has added to WTG and no higher priority)
      if (isAuthenticated && isWantToGo) return 'want-to-go';
      
      return null;
    };

    const markers: Array<{
      id: string;
      lat: number;
      lng: number;
      type: 'lv' | 'michelin' | 'favorite' | 'want-to-go';
      location?: Location;
      restaurant?: any;
      rating?: number; // Changed to optional since markers without LV ratings won't have this
      isFavorite: boolean;
      isWantToGo: boolean;
      hasLVRating: boolean;
      michelinScore?: number;
      favoritesCount?: number;
      wantToGoCount?: number;
    }> = [];

    // Step 1: Add all LV locations
    displayLocations.forEach(location => {
      // Check for LV ratings (support both new and deprecated field names)
      const hasLVRating = !!(
        location.lvEditorScore || 
        location.lvAvgUserScore || 
        location.lvEditorsScore || 
        location.lvCrowdsourceScore
      );
      // ✅ Check for Michelin data using new field names
      const hasMichelinScore = !!(
        location.michelinStars || 
        location.michelinDistinction || 
        location.michelinScore // Keep backward compatibility
      );
      const isFavorite = favoriteIds?.has(location.id) || favoriteIds?.has(location.place_id || '') || false;
      const isWantToGo = wantToGoIds?.has(location.id) || wantToGoIds?.has(location.place_id || '') || false;

      const markerType = getBestMarkerType(hasLVRating, hasMichelinScore, isFavorite, isWantToGo);
      
      // 🐛 DEBUG: Log Elcielo data
      if (location.name?.toLowerCase().includes('elcielo')) {
        console.log('🐛 DEBUG: Elcielo Location Data:', {
          name: location.name,
          id: location.id,
          lvEditorScore: location.lvEditorScore,
          lvAvgUserScore: location.lvAvgUserScore,
          lvEditorsScore: location.lvEditorsScore,
          lvCrowdsourceScore: location.lvCrowdsourceScore,
          michelinScore: location.michelinScore,
          michelinStars: location.michelinStars,
          michelinDistinction: location.michelinDistinction,
          hasLVRating,
          hasMichelinScore,
          markerType,
          googlePlaceId: location.googlePlaceId || location.placeId || location.place_id,
        });
      }
      
      if (markerType) {
        markers.push({
          id: location.id,
          lat: location.lat,
          lng: location.lng,
          type: markerType,
          location,
          rating: hasLVRating ? (location.lvEditorScore || location.lvAvgUserScore || location.lvEditorsScore || location.lvCrowdsourceScore) : undefined,
          isFavorite,
          isWantToGo,
          hasLVRating,
          michelinScore: getMichelinScore(location), // ✅ Use helper to convert Michelin data
          favoritesCount: location.favoritesCount,
          wantToGoCount: location.wantToGoCount,
        });
      }
    });

    // ❌ REMOVED: Step 2 - Michelin restaurant merging (no longer needed)
    // All Michelin data is now in the locations table!

    // Step 3: Add want-to-go locations (only if not already in markers)
    if (isAuthenticated && wantToGoLocations) {
      wantToGoLocations.forEach(location => {
        const alreadyExists = markers.some(marker => 
          locationsMatch(marker, location)
        );

        if (!alreadyExists) {
          const hasLVRating = !!(location.lvEditorsScore || location.lvCrowdsourceScore || location.lvEditorScore || location.lvAvgUserScore);
          // ✅ Check for Michelin data using new field names
          const hasMichelinScore = !!(
            location.michelinStars || 
            location.michelinDistinction || 
            location.michelinScore // Keep backward compatibility
          );
          
          const markerType = getBestMarkerType(hasLVRating, hasMichelinScore, false, true);
          
          if (markerType) {
            markers.push({
              id: location.id,
              lat: location.lat,
              lng: location.lng,
              type: markerType,
              location,
              rating: hasLVRating ? (location.lvEditorsScore || location.lvCrowdsourceScore || location.lvEditorScore || location.lvAvgUserScore) : undefined,
              isFavorite: false,
              isWantToGo: true,
              hasLVRating: false,
              michelinScore: getMichelinScore(location), // ✅ Use helper to convert Michelin data
              favoritesCount: location.favoritesCount,
              wantToGoCount: location.wantToGoCount,
            });
          }
        }
      });
    }

    console.log('🎯 Unified Markers:', {
      total: markers.length,
      byType: {
        lv: markers.filter(m => m.type === 'lv').length,
        michelin: markers.filter(m => m.type === 'michelin').length,
        favorite: markers.filter(m => m.type === 'favorite').length,
        wantToGo: markers.filter(m => m.type === 'want-to-go').length,
      },
      filters: { showLVMarkers, showMichelinMarkers }
    });

    return markers;
  }, [
    displayLocations,
    wantToGoLocations,
    showSearchResults,
    showLVMarkers,
    showMichelinMarkers,
    isAuthenticated,
    favoriteIds,
    wantToGoIds
  ]);

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
      console.log('🌟 Michelin Score:', location.michelinScore);
      
      // Support both placeId (camelCase from backend) and place_id (snake_case)
      const placeId = location.placeId || location.place_id;
      
      // ❌ REMOVED: Special Michelin validation flow - no longer needed
      // All Michelin data is now in locations table with proper Place IDs
      
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
        {/* Filter Menu Toggle - Mobile Only (above zoom controls) */}
        <div className="md:hidden relative">
          <button
            onClick={() => {
              if (onFilterMenuToggle) {
                onFilterMenuToggle(!filterMenuOpen);
              }
            }}
            className="p-2.5 bg-white/95 backdrop-blur-sm hover:bg-slate-50 rounded-lg shadow-lg border border-slate-200/50 transition-all hover:scale-105 hover:shadow-xl"
            title="Filter Menu"
          >
            <Filter className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
          </button>

          {/* Filter Dropdown Menu - Mobile */}
          <AnimatePresence>
            {filterMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full right-0 mb-2 w-56 bg-white/95 backdrop-blur-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden"
              >
                <div className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                    Show Markers
                  </div>
                  
                  {/* LV Markers Toggle */}
                  <button
                    onClick={() => {
                      if (onLVMarkersToggle) {
                        onLVMarkersToggle();
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <span className="text-sm font-medium text-gray-700">LV Markers</span>
                    <div className={`w-10 h-6 rounded-full transition-all ${
                      showLVMarkers ? 'bg-blue-500' : 'bg-gray-300'
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                        showLVMarkers ? 'translate-x-5 translate-y-1' : 'translate-x-1 translate-y-1'
                      }`} />
                    </div>
                  </button>

                  {/* Michelin Markers Toggle */}
                  <button
                    onClick={() => {
                      if (onMichelinMarkersToggle) {
                        onMichelinMarkersToggle();
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <span className="text-sm font-medium text-gray-700">Michelin Markers</span>
                    <div className={`w-10 h-6 rounded-full transition-all ${
                      showMichelinMarkers ? 'bg-red-500' : 'bg-gray-300'
                    }`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${
                        showMichelinMarkers ? 'translate-x-5 translate-y-1' : 'translate-x-1 translate-y-1'
                      }`} />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider - Mobile Only */}
        <div className="md:hidden h-px bg-slate-200 mx-1" />

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
        {/* Unified Smart Markers - Single marker per location based on priority */}
        {unifiedMarkers.map((marker) => {
          const scale = showHeatMap ? 0.8 : 1;
          
          // ✅ SIMPLIFIED: All markers now have location data from locations table
          const handleClick = marker.location 
            ? () => handleMarkerClick(marker.location!)
            : () => {
                console.warn('⚠️ Marker without location data (should not happen):', marker.id);
              };
          
          return (
            <AdvancedMarker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              onClick={handleClick}
              zIndex={selectedGooglePlace?.place_id === marker.location?.place_id ? 1000 : 100}
            >
              <LuxuryMarker
                rating={marker.rating}
                scale={scale}
                showHeatMap={showHeatMap}
                isFavorite={marker.isFavorite}
                isWantToGo={marker.isWantToGo}
                hasLVRating={marker.hasLVRating}
                type={marker.type === 'lv' || marker.type === 'michelin' ? 'lv-location' : marker.type}
                locationName={marker.location?.name || 'Unknown'}
                currentZoom={currentZoom}
                michelinScore={marker.michelinScore}
                favoritesCount={marker.favoritesCount}
                wantToGoCount={marker.wantToGoCount}
              />
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
              key={`${selectedGooglePlace.place_id}-${favoriteIds?.size}-${wantToGoIds?.size}-${wantToGoPlaceIds?.size}`} // Force re-render when IDs change
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
              onRefresh={onRefresh}
              favoriteIds={favoriteIds}
              wantToGoIds={wantToGoIds}
              wantToGoPlaceIds={wantToGoPlaceIds}
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
            key={`${selectedGooglePlace.place_id}-${favoriteIds?.size}-${wantToGoIds?.size}-${wantToGoPlaceIds?.size}`} // Force re-render when IDs change
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
            onRefresh={onRefresh}
            favoriteIds={favoriteIds}
            wantToGoIds={wantToGoIds}
            wantToGoPlaceIds={wantToGoPlaceIds}
            lvLocation={selectedLVLocation}
          />
        )}
      </div>

      {/* Place ID Validation Popup */}
      {validationPopup && (
        <PlaceIdValidationPopup
          michelinData={validationPopup.michelinData}
          suggestedPlace={validationPopup.suggestedPlace}
          confidenceScore={validationPopup.confidenceScore}
          isAuthenticated={isAuthenticated || false}
          onValidate={async (status) => {
            try {
              console.log('📝 Submitting validation:', status);
              
              if (!isAuthenticated) {
                console.log('⚠️ User not authenticated');
                setValidationPopup(null);
                return;
              }

              const result = await api.validateMichelinPlace(
                validationPopup.michelinData.id,
                validationPopup.suggestedPlace.id,
                status
              );

              console.log('✅ Validation submitted:', result);

              // Close popup immediately to prevent hung state
              setValidationPopup(null);

              // If auto-updated or confirmed, reload the locations
              if (result.autoUpdated || status === 'confirmed') {
                console.log('🔄 Place ID updated, refreshing locations...');
                
                // ✅ UPDATED: Trigger parent refresh to reload locations from database
                if (onRefresh) {
                  onRefresh();
                }
                
                // Show success message
                toast.success('Location verified! You can now add LV ratings.');
                
                // Optionally fetch and show the updated place details
                try {
                  const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
                  const place = new Place({ id: validationPopup.suggestedPlace.id });
                  
                  console.log('🔍 Fetching place details for verified location...');
                  await place.fetchFields({
                    fields: ['displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'types', 'websiteURI', 'nationalPhoneNumber']
                  });
                  
                  console.log('✅ Place details fetched');
                  
                  // Find the full Michelin restaurant data from the loaded restaurants
                  const fullMichelinData = michelinRestaurants.find(r => r.id === validationPopup.michelinData.id);
                  
                  // Parse Michelin Award to get stars, distinction, and green star
                  const award = fullMichelinData?.award || validationPopup.michelinData.award || '';
                  let michelinStars: number | null = null;
                  let michelinDistinction: string | null = null;
                  let michelinGreenStar = false;
                  
                  if (award.includes('3 Stars')) {
                    michelinStars = 3;
                  } else if (award.includes('2 Stars')) {
                    michelinStars = 2;
                  } else if (award.includes('1 Star')) {
                    michelinStars = 1;
                  } else if (award.includes('Bib Gourmand')) {
                    michelinDistinction = 'Bib Gourmand';
                  }
                  
                  if (fullMichelinData?.GreenStar) {
                    michelinGreenStar = true;
                  }
                  
                  const placeResult: google.maps.places.PlaceResult = {
                    place_id: place.id,
                    name: place.displayName || validationPopup.michelinData.name,
                    formatted_address: place.formattedAddress,
                    geometry: {
                      location: place.location || new google.maps.LatLng(validationPopup.michelinData.lat, validationPopup.michelinData.lng)
                    },
                    rating: place.rating,
                    user_ratings_total: place.userRatingCount,
                    website: place.websiteURI,
                    formatted_phone_number: place.nationalPhoneNumber,
                    photos: place.photos,
                    types: place.types,
                  };
                  
                  const lvLocation: Location = {
                    id: `michelin-${validationPopup.michelinData.id}`,
                    name: validationPopup.michelinData.name,
                    lat: validationPopup.michelinData.lat,
                    lng: validationPopup.michelinData.lng,
                    lvEditorsScore: undefined,
                    lvCrowdsourceScore: undefined,
                    googleRating: place.rating || 0,
                    michelinStars: michelinStars,
                    michelinDistinction: michelinDistinction,
                    michelinGreenStar: michelinGreenStar,
                    tags: [],
                    description: validationPopup.michelinData.location,
                    address: validationPopup.michelinData.address,
                    cuisine: fullMichelinData?.Cuisine,
                    place_id: place.id,
                  };
                  
                  console.log('📍 Opening info window for verified location');
                  if (onPOIClick) {
                    onPOIClick(placeResult, lvLocation);
                  }
                } catch (error) {
                  console.error('❌ Error fetching place details after validation:', error);
                  toast.error('Verification saved, but failed to load place details. Please click the marker again.');
                }
              }
            } catch (error) {
              console.error('❌ Error submitting validation:', error);
              toast.error('Failed to submit verification. Please try again.');
              // Still close the popup
              setValidationPopup(null);
            }
          }}
          onClose={() => {
            console.log('❌ Validation popup closed without action');
            setValidationPopup(null);
          }}
        />
      )}
    </div>
  );
}