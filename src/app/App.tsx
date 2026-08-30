import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { toast, Toaster } from 'sonner';
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  LogIn,
  LogOut,
  User,
  Heart,
  Bookmark,
  Filter,
  Layers
} from 'lucide-react';

import { Map } from './components/Map';
import { SearchAutocomplete } from './components/SearchAutocomplete';
import { Profile } from './components/Profile';
import { Favorites } from './components/Favorites';
import { WantToGo } from './components/WantToGo';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { MobileNav } from './components/MobileNav';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';

import { api } from '../utils/api';
import { projectId, publicAnonKey } from '/utils/supabase/info.tsx';
import { trackApiCall, trackAction, logError, trackInteraction } from '../utils/monitoring';
import { usePerformanceMonitor, useErrorHandler } from './hooks/usePerformanceMonitor';
import { useAuth } from './hooks/useAuth';
import { useLocations, type Location } from './hooks/useLocations';
import { filterWithinRadiusKm, haversineDistanceMeters } from '../utils/geo';

const FALLBACK_LOCATION = { lat: 32.7157, lng: -117.1611 }; // San Diego

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [selectedLVLocation, setSelectedLVLocation] = useState<Location | null>(null);
  const [sidebarView, setSidebarView] = useState<'favorites' | 'wantToGo' | 'profile'>('favorites');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [wantToGoIds, setWantToGoIds] = useState<Set<string>>(new Set());
  const [wantToGoPlaceIds, setWantToGoPlaceIds] = useState<Set<string>>(new Set()); // Google Place IDs for info windows
  const [wantToGoLocations, setWantToGoLocations] = useState<Location[]>([]); // Full location objects for map display
  const [locationPermissionEnabled, setLocationPermissionEnabled] = useState(false);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [searchResults, setSearchResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCity, setSelectedCity] = useState<google.maps.places.PlaceResult | null>(null);
  const [cityStats, setCityStats] = useState<{ totalLVRatings: number; totalFavorites: number }>({ totalLVRatings: 0, totalFavorites: 0 });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showLVMarkers, setShowLVMarkers] = useState(true);
  const [showMichelinMarkers, setShowMichelinMarkers] = useState(true);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [monitoringDashboardOpen, setMonitoringDashboardOpen] = useState(false);

  // 📊 Performance monitoring
  usePerformanceMonitor('App');
  const { catchError } = useErrorHandler('App');

  const { locations, setLocations, heatMapLocations, setHeatMapLocations, loadLocations, filteredLocations } = useLocations();

  // Restore map center/zoom saved to localStorage before an OAuth redirect
  const restoreMapStateAfterLogin = useCallback(() => {
    const savedMapCenter = localStorage.getItem('lv_map_center');
    const savedMapZoom = localStorage.getItem('lv_map_zoom');

    if (savedMapCenter && savedMapZoom) {
      try {
        setMapCenter(JSON.parse(savedMapCenter));
        setMapZoom(parseInt(savedMapZoom, 10));
      } catch (error) {
        console.error('Failed to parse saved map state:', error);
      }
    }
  }, []);

  const requestGeolocation = useCallback((userId?: string) => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMapCenter(userPos);
        setMapZoom(13);
        setUserLocation(userPos);

        localStorage.removeItem('lv_location_denied');

        if (userId) {
          try {
            localStorage.setItem(`lv_location_${userId}`, JSON.stringify(userPos));
          } catch (error) {
            console.error('Failed to save location:', error);
          }
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          localStorage.setItem('lv_location_denied', 'true');
        }
        setMapCenter(FALLBACK_LOCATION);
      }
    );
  }, []);

  const loadSavedLocation = useCallback((userId: string) => {
    try {
      const permissionPref = localStorage.getItem(`lv_location_perm_${userId}`);
      const locationEnabled = permissionPref === 'true';
      setLocationPermissionEnabled(locationEnabled);

      const savedLocation = localStorage.getItem(`lv_location_${userId}`);
      if (savedLocation) {
        const userPos = JSON.parse(savedLocation);
        setMapCenter(userPos);
        setMapZoom(13);
        setUserLocation(userPos);
      }

      // Only request a fresh location if the user has opted in
      if (locationEnabled) {
        requestGeolocation(userId);
      }
    } catch (error) {
      console.error('Failed to load saved location:', error);
      const permissionPref = localStorage.getItem(`lv_location_perm_${userId}`);
      if (permissionPref === 'true') {
        requestGeolocation(userId);
      }
    }
  }, [requestGeolocation]);

  const loadUserLists = useCallback(async () => {
    try {
      const { favorites } = await api.getFavorites();
      setFavoriteIds(new Set(favorites.map(loc => loc.id)));

      const { wantToGo } = await api.getWantToGo();
      setWantToGoIds(new Set(wantToGo.map(loc => loc.id)));
      setWantToGoLocations(wantToGo);

      const placeIds = wantToGo
        .filter(loc => loc.placeId || loc.googlePlaceId)
        .map(loc => loc.placeId || loc.googlePlaceId!);
      setWantToGoPlaceIds(new Set(placeIds));
    } catch (error) {
      console.error('Failed to load user lists:', error);
    }
  }, []);

  // Fallback when there's no logged-in session: fall back to geolocation
  // (or the last-denied fallback location), and clear any stale user state.
  const handleSignedOut = useCallback(() => {
    setFavoriteIds(new Set());
    setWantToGoIds(new Set());
    setWantToGoPlaceIds(new Set());

    const hasExplicitlyDeniedLocation = localStorage.getItem('lv_location_denied') === 'true';
    if (!hasExplicitlyDeniedLocation) {
      requestGeolocation();
    } else {
      setMapCenter(FALLBACK_LOCATION);
    }
  }, [requestGeolocation]);

  const { user, login, logout } = useAuth({
    onUserSession: loadSavedLocation,
    onProfileLoaded: loadUserLists,
    onSignedIn: restoreMapStateAfterLogin,
    onSignedOut: handleSignedOut,
  });

  const handleLogin = useCallback(async () => {
    // Save map position so it survives the OAuth redirect
    if (mapCenter) {
      try {
        localStorage.setItem('lv_map_center', JSON.stringify(mapCenter));
        localStorage.setItem('lv_map_zoom', mapZoom.toString());
      } catch (error) {
        console.error('Failed to save map state:', error);
      }
    }
    await login();
  }, [login, mapCenter, mapZoom]);

  // Calculate city stats when a city is selected - memoized for performance
  const calculateCityStats = useCallback(async (cityCenter: google.maps.LatLng | google.maps.LatLngLiteral) => {
    const lat = typeof cityCenter.lat === 'function' ? cityCenter.lat() : cityCenter.lat;
    const lng = typeof cityCenter.lng === 'function' ? cityCenter.lng() : cityCenter.lng;

    const CITY_RADIUS_KM = 50;
    const locationsInCity = filterWithinRadiusKm(locations, { lat, lng }, CITY_RADIUS_KM);

    const lvRatedCount = locationsInCity.filter(loc =>
      loc.lvEditorsScore !== null && loc.lvEditorsScore !== undefined && loc.lvEditorsScore > 0
    ).length;

    try {
      const locationIds = locationsInCity.map(loc => loc.id);
      const { totalFavorites } = await api.getCityFavorites(locationIds);

      setCityStats({
        totalLVRatings: lvRatedCount,
        totalFavorites: totalFavorites
      });
    } catch (error) {
      console.error('Error fetching city favorites:', error);
      setCityStats({
        totalLVRatings: lvRatedCount,
        totalFavorites: 0
      });
    }
  }, [locations]);

  useEffect(() => {
    if (selectedCity && selectedCity.geometry?.location) {
      calculateCityStats(selectedCity.geometry.location);
    }
  }, [selectedCity, calculateCityStats]);

  const initializeApp = useCallback(async () => {
    const endTracking = trackInteraction('app_initialization');

    try {
      // First try to load API key from .env.local (Vite environment variable)
      const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (envApiKey) {
        setGoogleMapsApiKey(envApiKey);
        (window as any).GOOGLE_MAPS_API_KEY = envApiKey;
      } else {
        // Fallback: fetch from server
        const response = await trackApiCall('getGoogleMapsApiKey', () =>
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-48182530/config/google-maps-key`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          )
        );

        if (response.ok) {
          const { apiKey } = await response.json();
          setGoogleMapsApiKey(apiKey);
          (window as any).GOOGLE_MAPS_API_KEY = apiKey;
        } else {
          console.error("Failed to load Google Maps API key");
          logError('Failed to load Google Maps API key', 'App', { status: response.status });
        }
      }

      await loadLocations();
    } catch (error) {
      console.error("Error during initialization:", error);
      catchError(error, { context: 'app_initialization' });
    } finally {
      setLoading(false);
      endTracking();
    }
  }, [loadLocations, catchError]);

  useEffect(() => {
    trackAction('app_initialized');

    initializeApp();
    restoreMapStateAfterLogin();

    // 🎹 Keyboard shortcut for monitoring dashboard (Ctrl+Shift+M)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setMonitoringDashboardOpen(prev => !prev);
        trackAction('monitoring_dashboard_toggled');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle shared place from URL parameter
  useEffect(() => {
    const handleSharedPlace = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const placeId = urlParams.get('place');

      if (!placeId || !googleMapsApiKey || locations.length === 0) return;

      trackAction('shared_place_opened', 'App', { placeId });

      try {
        // Check if placeId is actually coordinates (lat,lng format)
        const coordMatch = placeId.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          setMapCenter({ lat, lng });
          setMapZoom(15);
          toast.info('Centered on shared location');
          return;
        }

        // Try to find the location in our database (for LV data)
        const lvLocation = locations.find(
          loc => loc.place_id === placeId || loc.googlePlaceId === placeId || loc.id === placeId
        );

        // ALWAYS fetch from Google Places API to get photos and complete data
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-48182530/google-places/${placeId}/details`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to fetch place details');

        const placeData = await response.json();

        // Convert photos to the format the InfoWindow expects
        const photos = placeData.photos?.map((photo: any) => ({
          getUrl: (opts?: { maxWidth?: number; maxHeight?: number }) => photo.photoReference,
          height: photo.height || 600,
          width: photo.width || 800,
        })) || [];

        const lat = placeData.location?.lat || lvLocation?.lat || 0;
        const lng = placeData.location?.lng || lvLocation?.lng || 0;

        const place: google.maps.places.PlaceResult = {
          place_id: placeData.place_id,
          name: placeData.name,
          formatted_address: placeData.formatted_address,
          geometry: {
            location: { lat, lng } as google.maps.LatLng
          },
          rating: placeData.rating,
          user_ratings_total: placeData.user_ratings_total,
          website: placeData.website,
          formatted_phone_number: placeData.formatted_phone_number,
          opening_hours: placeData.opening_hours,
          reviews: placeData.reviews,
          photos: photos,
        };

        // Set map position BEFORE opening info window
        setMapCenter({ lat, lng });
        setMapZoom(15);

        // Small delay to ensure map centers before info window opens
        setTimeout(() => {
          setSelectedGooglePlace(place);
          setSelectedLVLocation(lvLocation || null);
          setSelectedCity(null);
          toast.success(`Opened ${placeData.name || 'location'}`);
        }, 100);
      } catch (error) {
        console.error('Error loading shared place:', error);
        toast.error('Failed to load shared location');
      }
    };

    handleSharedPlace();
  }, [googleMapsApiKey, locations]);

  const handleTagSelect = async (tag: string) => {
    setSearchQuery(tag);
    try {
      const { locations: data } = await api.getLocationsByTag(tag);
      setHeatMapLocations(data);
      // Default heat map to OFF when searching a tag - only show when user toggles it
      setShowHeatMap(false);

      if (data.length === 0) {
        toast.info(`No locations found with tag "${tag}"`);
      } else {
        toast.success(`Found ${data.length} location(s) with tag "${tag}"`);
      }
    } catch (error: any) {
      console.error('Failed to search by tag:', error);
      toast.error('Failed to search locations');
    }
  };

  // Auto-zoom to encompass all heat map locations when heat map is enabled
  useEffect(() => {
    if (showHeatMap && heatMapLocations.length > 0) {
      const validLocations = heatMapLocations.filter(loc => loc.lat && loc.lng);
      if (validLocations.length === 0) return;

      let minLat = validLocations[0].lat!;
      let maxLat = validLocations[0].lat!;
      let minLng = validLocations[0].lng!;
      let maxLng = validLocations[0].lng!;

      validLocations.forEach(loc => {
        if (loc.lat! < minLat) minLat = loc.lat!;
        if (loc.lat! > maxLat) maxLat = loc.lat!;
        if (loc.lng! < minLng) minLng = loc.lng!;
        if (loc.lng! > maxLng) maxLng = loc.lng!;
      });

      // Add padding (10% on each side)
      const latPadding = (maxLat - minLat) * 0.1;
      const lngPadding = (maxLng - minLng) * 0.1;

      minLat -= latPadding;
      maxLat += latPadding;
      minLng -= lngPadding;
      maxLng += lngPadding;

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      // Calculate appropriate zoom level (roughly 111km per degree of latitude)
      const latSpan = maxLat - minLat;
      const lngSpan = maxLng - minLng;
      const maxSpan = Math.max(latSpan, lngSpan);

      let zoom = 14; // default
      if (maxSpan > 10) zoom = 5;
      else if (maxSpan > 5) zoom = 6;
      else if (maxSpan > 2) zoom = 7;
      else if (maxSpan > 1) zoom = 8;
      else if (maxSpan > 0.5) zoom = 9;
      else if (maxSpan > 0.2) zoom = 10;
      else if (maxSpan > 0.1) zoom = 11;
      else if (maxSpan > 0.05) zoom = 12;
      else if (maxSpan > 0.02) zoom = 13;

      setMapCenter({ lat: centerLat, lng: centerLng });
      setMapZoom(zoom);
    }
    // Only run when showHeatMap changes, not heatMapLocations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeatMap]);

  // Filter want-to-go locations based on active search query
  const filteredWantToGoLocations = React.useMemo(() => {
    if (!searchQuery) {
      return wantToGoLocations;
    }
    return wantToGoLocations.filter(location =>
      location.tags?.some(tag =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [wantToGoLocations, searchQuery]);

  const handlePlaceSelect = (place: google.maps.places.PlaceResult, location?: Location) => {
    // Check if this is a city/region (not a specific establishment)
    const cityTypes = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'political', 'sublocality'];
    const isCity = place.types?.some(type => cityTypes.includes(type)) &&
                   !place.types?.some(type => ['restaurant', 'cafe', 'bar', 'establishment', 'point_of_interest'].includes(type));

    if (isCity) {
      setSelectedCity(place);
      setSelectedGooglePlace(null);
      setSelectedLVLocation(null);

      // Pan and zoom out to show the city area
      if (place.geometry?.location) {
        const loc = place.geometry.location;
        const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;

        setMapCenter({ lat, lng });
        setMapZoom(13); // Zoom out more for cities
      }
    } else {
      // Store the selected Google place to show in Map
      setSelectedGooglePlace(place);
      // If location data was passed (e.g., from Michelin search), use it
      setSelectedLVLocation(location || null);
      setSelectedCity(null);

      // Pan map to the selected place location
      if (place.geometry?.location) {
        const loc = place.geometry.location;
        const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;

        setMapCenter({ lat, lng });
        setMapZoom(15);
      }
    }
  };

  const handlePOIClick = (place: google.maps.places.PlaceResult, lvLocation?: Location) => {
    // Called when ANY POI/marker is clicked (Google POI, LV marker, or search result)
    setSelectedGooglePlace(place);

    // If lvLocation was passed (from LV marker click), use it
    if (lvLocation) {
      setSelectedLVLocation(lvLocation);
    } else if (place.place_id) {
      // Otherwise, search our locations array for matching place_id
      const matchingLocation = locations.find(loc => loc.place_id === place.place_id);
      setSelectedLVLocation(matchingLocation || null);
    } else {
      setSelectedLVLocation(null);
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setShowHeatMap(false);
    setHeatMapLocations([]);
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const handleGenericSearch = async (query: string) => {
    if (!mapBounds) {
      toast.error('Please wait for map to load');
      return;
    }

    setSearchQuery(query);
    setShowSearchResults(false);
    setSearchResults([]);

    try {
      toast.info(`Searching for "${query}"...`);

      // Also search for LV locations with matching tags
      try {
        const { locations: taggedLocations } = await api.getLocationsByTag(query);
        setHeatMapLocations(taggedLocations.length > 0 ? taggedLocations : []);
        // Default heat map to OFF when searching - only show when user toggles it
        setShowHeatMap(false);
      } catch (tagError) {
        setHeatMapLocations([]);
        setShowHeatMap(false);
      }

      // Get center and radius from map bounds
      const center = mapBounds.getCenter();
      const ne = mapBounds.getNorthEast();
      const radius = Math.min(
        Math.round(haversineDistanceMeters(center.lat(), center.lng(), ne.lat(), ne.lng())),
        50000 // Max 50km
      );

      // Use the Places library correctly
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;

      const request = {
        textQuery: query,
        locationBias: {
          center: { lat: center.lat(), lng: center.lng() },
          radius: radius
        },
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'types', 'photos'],
        maxResultCount: 20,
        language: 'en-US',
      };

      const { places } = await Place.searchByText(request);

      if (places && places.length > 0) {
        // Convert to PlaceResult format - places already have the fields we requested
        const results: google.maps.places.PlaceResult[] = places.map((place) => ({
          place_id: place.id,
          name: place.displayName,
          formatted_address: place.formattedAddress,
          geometry: place.location ? {
            location: place.location
          } as google.maps.places.PlaceGeometry : undefined,
          rating: place.rating,
          user_ratings_total: place.userRatingCount,
          types: place.types,
          photos: place.photos
        }));

        setSearchResults(results);
        setShowSearchResults(true);
        toast.success(`Found ${results.length} places for "${query}"`);
      } else {
        toast.info(`No results found for "${query}"`);
      }
    } catch (error) {
      console.error('Generic search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  const handleToggleFavorite = useCallback(async (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      trackAction('favorite_toggle_failed_no_auth', 'App', { locationId });
      return;
    }

    const isFavorite = favoriteIds.has(locationId);

    trackAction(isFavorite ? 'favorite_removed' : 'favorite_added', 'App', {
      locationId,
      placeName: placeData?.name
    });

    // ✅ OPTIMISTIC UPDATE - Update UI immediately
    setFavoriteIds(prev => {
      const newSet = new Set(prev);
      if (isFavorite) {
        newSet.delete(locationId);
      } else {
        newSet.add(locationId);
      }
      return newSet;
    });

    setLocations(prev => prev.map(loc =>
      loc.id === locationId
        ? { ...loc, favoritesCount: (loc.favoritesCount || 0) + (isFavorite ? -1 : 1) }
        : loc
    ));

    try {
      if (isFavorite) {
        await trackApiCall('removeFavorite', () => api.removeFavorite(locationId));
        toast.success('Removed from favorites');
      } else {
        await trackApiCall('addFavorite', () => api.addFavorite(locationId, placeData));
        toast.success('Added to favorites!');
      }
      // No loadLocations() needed - state was already updated optimistically above
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      catchError(error, { context: 'favorite_toggle', locationId });

      // ❌ ROLLBACK optimistic update on error
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        if (isFavorite) {
          newSet.add(locationId);
        } else {
          newSet.delete(locationId);
        }
        return newSet;
      });

      setLocations(prev => prev.map(loc =>
        loc.id === locationId
          ? { ...loc, favoritesCount: (loc.favoritesCount || 0) + (isFavorite ? 1 : -1) }
          : loc
      ));

      toast.error('Failed to update favorites');
    }
  }, [user, favoriteIds, setLocations, catchError]);

  const handleToggleWantToGo = useCallback(async (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => {
    if (!user) {
      toast.error('Please sign in to save to Want to Go');
      trackAction('want_to_go_toggle_failed_no_auth', 'App', { locationId });
      return;
    }

    // Check if this is a place_id (Google place) or a location id (LV location)
    const isPlaceId = placeData?.place_id === locationId;
    const isWantToGo = isPlaceId ? wantToGoPlaceIds.has(locationId) : wantToGoIds.has(locationId);

    trackAction(isWantToGo ? 'want_to_go_removed' : 'want_to_go_added', 'App', {
      locationId,
      placeName: placeData?.name,
      isPlaceId
    });

    // ✅ OPTIMISTIC UPDATE - Update UI immediately
    if (isPlaceId && placeData?.place_id) {
      setWantToGoPlaceIds(prev => {
        const newSet = new Set(prev);
        if (isWantToGo) {
          newSet.delete(placeData.place_id!);
        } else {
          newSet.add(placeData.place_id!);
        }
        return newSet;
      });
    } else {
      setWantToGoIds(prev => {
        const newSet = new Set(prev);
        if (isWantToGo) {
          newSet.delete(locationId);
        } else {
          newSet.add(locationId);
        }
        return newSet;
      });
    }

    if (isWantToGo) {
      setWantToGoLocations(prev => prev.filter(loc =>
        isPlaceId
          ? (loc.placeId !== locationId && loc.googlePlaceId !== locationId)
          : loc.id !== locationId
      ));
    } else {
      const location = locations.find(loc =>
        isPlaceId
          ? (loc.placeId === locationId || loc.googlePlaceId === locationId)
          : loc.id === locationId
      );
      if (location) {
        setWantToGoLocations(prev => [...prev, location]);
      } else if (placeData) {
        // Create a temporary location object for Google places not yet in the LV database
        const tempLocation: Location = {
          id: locationId, // Use place_id as temporary id
          name: placeData.name || 'Unknown',
          lat: placeData.lat || 0,
          lng: placeData.lng || 0,
          description: placeData.formatted_address,
          placeId: placeData.place_id,
          googlePlaceId: placeData.place_id,
          tags: [],
        };
        setWantToGoLocations(prev => [...prev, tempLocation]);
      }
    }

    try {
      if (isWantToGo) {
        await api.removeWantToGo(locationId);
        toast.success('Removed from Want to Go');
      } else {
        await api.addWantToGo(locationId, placeData);
        toast.success('Added to Want to Go!');
      }
      // Reload user lists to get the actual location data from the server
      await loadUserLists();
    } catch (error) {
      console.error('Error toggling Want to Go:', error);

      // ❌ ROLLBACK optimistic update on error
      if (isPlaceId && placeData?.place_id) {
        setWantToGoPlaceIds(prev => {
          const newSet = new Set(prev);
          if (isWantToGo) {
            newSet.add(placeData.place_id!);
          } else {
            newSet.delete(placeData.place_id!);
          }
          return newSet;
        });
      } else {
        setWantToGoIds(prev => {
          const newSet = new Set(prev);
          if (isWantToGo) {
            newSet.add(locationId);
          } else {
            newSet.delete(locationId);
          }
          return newSet;
        });
      }

      if (isWantToGo) {
        const location = locations.find(loc =>
          isPlaceId ? loc.place_id === locationId : loc.id === locationId
        );
        if (location) {
          setWantToGoLocations(prev => [...prev, location]);
        }
      } else {
        setWantToGoLocations(prev => prev.filter(loc =>
          isPlaceId ? loc.place_id !== locationId : loc.id !== locationId
        ));
      }

      toast.error('Failed to update Want to Go');
    }
  }, [user, wantToGoIds, wantToGoPlaceIds, locations, loadUserLists]);

  const handleLocationPermissionToggle = async (enabled: boolean) => {
    if (!user) return;

    setLocationPermissionEnabled(enabled);

    try {
      localStorage.setItem(`lv_location_perm_${user.id}`, enabled.toString());

      if (enabled) {
        // Clear any denial flag when the user explicitly enables it
        localStorage.removeItem('lv_location_denied');
        toast.info('Requesting your location...');
        requestGeolocation(user.id);
      } else {
        toast.success('Location auto-detection disabled');
      }
    } catch (error) {
      console.error('Failed to save location permission preference:', error);
      toast.error('Failed to save preference');
    }
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="text-3xl font-light tracking-wider">
            LE VOYAGEUR
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="size-full flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="text-3xl font-light tracking-wider">
            LE VOYAGEUR
          </div>
          <p className="text-muted-foreground">Initializing map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-white">
      <Toaster position="top-center" richColors />

      {/* Monitoring Dashboard (Ctrl+Shift+M to toggle) */}
      <MonitoringDashboard
        isOpen={monitoringDashboardOpen}
        onClose={() => setMonitoringDashboardOpen(false)}
      />

      {/* Header - Hidden on mobile, visible on desktop */}
      <header className="hidden md:block bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-light tracking-wider">
            LE VOYAGEUR
          </h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setSidebarView('profile')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                </button>
                <Button
                  onClick={logout}
                  variant="outline"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                onClick={handleLogin}
                className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                <LogIn className="h-4 w-4" />
                Sign in with Google
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className={`hidden md:block ${sidebarCollapsed ? 'w-0' : 'w-96'} bg-slate-50 border-r border-slate-200 overflow-y-auto transition-all duration-300`}>
          <div className={`p-6 space-y-6 ${sidebarCollapsed ? 'hidden' : ''}`}>
            {/* Sign In Prompt (when not logged in) */}
            {!user && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Welcome to Le Voyageur</h3>
                      <p className="text-sm text-muted-foreground">
                        Sign in to save your favorite places and build your travel list
                      </p>
                    </div>
                    <Button
                      onClick={handleLogin}
                      className="w-full gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in with Google
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* When logged in: Show navigation tabs */}
            {user && (
              <div className="flex gap-2 p-1 bg-white rounded-lg shadow-sm">
                <button
                  onClick={() => setSidebarView('favorites')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                    sidebarView === 'favorites'
                      ? 'bg-slate-900 text-white'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Heart className="h-4 w-4" />
                  Favorites
                </button>
                <button
                  onClick={() => setSidebarView('wantToGo')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                    sidebarView === 'wantToGo'
                      ? 'bg-slate-900 text-white'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                  Want to Go
                </button>
                <button
                  onClick={() => setSidebarView('profile')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                    sidebarView === 'profile'
                      ? 'bg-slate-900 text-white'
                      : 'text-gray-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
              </div>
            )}

            {/* Content based on selected view and auth status */}
            {!user ? (
              <>
                {/* Not logged in: Show sign-in prompts for favorites and want to go */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      Favorites
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center py-8">
                    <Heart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Sign in to view your favorite locations
                    </p>
                    <Button
                      onClick={handleLogin}
                      variant="outline"
                      className="gap-2"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bookmark className="h-5 w-5 text-blue-500" />
                      Want to Go
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center py-8">
                    <Bookmark className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Sign in to build your travel wishlist
                    </p>
                    <Button
                      onClick={handleLogin}
                      variant="outline"
                      className="gap-2"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Logged in: Show selected view content */}
                {sidebarView === 'favorites' && (
                  <Favorites
                    key={favoriteIds.size} // Force reload when favorites change
                    user={user}
                    userLocation={userLocation}
                    onLocationClick={(location) => {
                      setMapCenter({ lat: location.lat, lng: location.lng });
                      setMapZoom(15);
                    }}
                  />
                )}

                {sidebarView === 'wantToGo' && (
                  <WantToGo
                    key={wantToGoIds.size} // Force reload when want to go list changes
                    user={user}
                    userLocation={userLocation}
                    onLocationClick={(location) => {
                      setMapCenter({ lat: location.lat, lng: location.lng });
                      setMapZoom(15);
                    }}
                  />
                )}

                {sidebarView === 'profile' && (
                  <Profile
                    user={user}
                    locationPermissionEnabled={locationPermissionEnabled}
                    onLocationPermissionToggle={handleLocationPermissionToggle}
                    favoritesCount={favoriteIds.size}
                    wantToGoCount={wantToGoIds.size}
                    onMichelinSyncComplete={loadLocations}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <APIProvider apiKey={googleMapsApiKey}>
            {/* Mobile Filter Menu Overlay - Positioned above map controls */}
            <AnimatePresence>
              {filterMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setFilterMenuOpen(false)}
                    className="md:hidden fixed inset-0 bg-black/20 z-40"
                  />

                  {/* Filter Menu */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="md:hidden absolute bottom-40 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200/50 overflow-hidden"
                  >
                    <div className="p-4 space-y-3 min-w-[260px]">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Show Markers
                      </div>

                      {/* LV Markers Toggle */}
                      <button
                        onClick={() => setShowLVMarkers(!showLVMarkers)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all"
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
                        onClick={() => setShowMichelinMarkers(!showMichelinMarkers)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all"
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
                </>
              )}
            </AnimatePresence>

            {/* Floating Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute top-6 md:top-6 top-20 left-1/2 -translate-x-1/2 z-10 w-full px-4 sm:px-6"
              style={{
                maxWidth: 'min(640px, calc(100vw - 32px))',
              }}
            >
              <SearchAutocomplete
                onPlaceSelect={handlePlaceSelect}
                onTagSelect={handleTagSelect}
                onClear={handleSearchClear}
                mapBounds={mapBounds}
                onGenericSearch={handleGenericSearch}
                searchResults={searchResults}
                showSearchResults={showSearchResults}
              />
              {heatMapLocations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 mx-auto w-fit"
                >
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-slate-200">
                    {/* Heat Map Toggle Button */}
                    <button
                      onClick={() => {
                        setShowHeatMap(!showHeatMap);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                        showHeatMap
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={showHeatMap ? 'Hide heat map' : 'Show heat map'}
                    >
                      <Layers className={`h-4 w-4 ${showHeatMap ? 'animate-pulse' : ''}`} />
                      <span className="text-sm font-medium">
                        Heat Map
                      </span>
                    </button>

                    {/* Location Count */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {heatMapLocations.length} locations
                      </span>
                    </div>

                    {/* Clear Search Button */}
                    <button
                      onClick={() => {
                        setShowHeatMap(false);
                        setSearchQuery("");
                        setHeatMapLocations([]);
                      }}
                      className="text-gray-400 hover:text-gray-700 transition"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Sidebar Toggle Button */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:block absolute top-6 left-4 sm:left-6 z-20 p-3 bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-slate-200 hover:bg-white hover:shadow-xl transition-all duration-300"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5 text-slate-600" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              )}
            </motion.button>

            {/* Filter Button - Top Right */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="hidden md:block absolute top-6 right-4 sm:right-6 z-20"
            >
              <div className="relative">
                <button
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className="p-3 bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-slate-200 hover:bg-white hover:shadow-xl transition-all duration-300"
                >
                  <Filter className="h-5 w-5 text-slate-600" />
                </button>

                {/* Filter Dropdown Menu */}
                <AnimatePresence>
                  {filterMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full right-0 mt-2 w-56 bg-white/95 backdrop-blur-2xl rounded-xl shadow-xl border border-slate-200 overflow-hidden"
                    >
                      <div className="p-3 space-y-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                          Show Markers
                        </div>

                        {/* LV Markers Toggle */}
                        <button
                          onClick={() => setShowLVMarkers(!showLVMarkers)}
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
                          onClick={() => setShowMichelinMarkers(!showMichelinMarkers)}
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
            </motion.div>

            {/* Map Component */}
            <Map
              locations={filteredLocations}
              heatMapData={heatMapLocations}
              showHeatMap={showHeatMap}
              googleMapsApiKey={googleMapsApiKey}
              user={user}
              isAuthenticated={!!user}
              onFavoriteToggle={handleToggleFavorite}
              onWantToGoToggle={handleToggleWantToGo}
              onRatingAdded={loadLocations}
              onRefresh={loadLocations}
              favoriteIds={favoriteIds}
              wantToGoIds={wantToGoIds}
              wantToGoPlaceIds={wantToGoPlaceIds}
              wantToGoLocations={filteredWantToGoLocations}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              selectedGooglePlace={selectedGooglePlace}
              selectedLVLocation={selectedLVLocation}
              selectedCity={selectedCity}
              cityStats={cityStats}
              onGooglePlaceClose={() => {
                setSelectedGooglePlace(null);
                setSelectedLVLocation(null);
                setSelectedCity(null);
                // Clear place parameter from URL
                const url = new URL(window.location.href);
                if (url.searchParams.has('place')) {
                  url.searchParams.delete('place');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              onMapBoundsChange={setMapBounds}
              searchResults={searchResults}
              showSearchResults={showSearchResults}
              onPOIClick={handlePOIClick}
              showLVMarkers={showLVMarkers}
              showMichelinMarkers={showMichelinMarkers}
              filterMenuOpen={filterMenuOpen}
              onFilterMenuToggle={setFilterMenuOpen}
              onLVMarkersToggle={() => setShowLVMarkers(!showLVMarkers)}
              onMichelinMarkersToggle={() => setShowMichelinMarkers(!showMichelinMarkers)}
            />
          </APIProvider>
        </div>

        <MobileNav
          user={user}
          sidebarView={sidebarView}
          onSidebarViewChange={setSidebarView}
          drawerOpen={mobileDrawerOpen}
          onDrawerOpenChange={setMobileDrawerOpen}
          userLocation={userLocation}
          locationPermissionEnabled={locationPermissionEnabled}
          onLocationPermissionToggle={handleLocationPermissionToggle}
          favoritesCount={favoriteIds.size}
          wantToGoCount={wantToGoIds.size}
          onMichelinSyncComplete={loadLocations}
          onLogin={handleLogin}
          onLogout={logout}
          onLocationSelect={(location) => {
            setMapCenter({ lat: location.lat, lng: location.lng });
            setMapZoom(15);
          }}
          onCenterOnUser={() => {
            if (userLocation) {
              setMapCenter(userLocation);
              setMapZoom(13);
            }
          }}
        />
      </div>
    </div>
  );
}
