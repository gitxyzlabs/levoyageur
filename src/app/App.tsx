import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { toast, Toaster } from 'sonner';
import { 
  MapPin, 
  Flame,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  LogIn,
  LogOut,
  User,
  Home,
  Heart,
  Bookmark,
  Settings
} from 'lucide-react';

import { Map } from './components/Map';
import { SearchAutocomplete } from './components/SearchAutocomplete';
import { Profile } from './components/Profile';
import { Favorites } from './components/Favorites';
import { WantToGo } from './components/WantToGo';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';

import { api, supabase } from '../utils/api';
import type { Location as APILocation, User as APIUser } from '../utils/api';
import { projectId, publicAnonKey } from '../../utils/supabase/info.tsx';

// Use types from API
type Location = APILocation & {
  place_id?: string;
  image?: string;
  cuisine?: string;
  area?: string;
};

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [heatMapLocations, setHeatMapLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<google.maps.places.PlaceResult | null>(null);
  const [selectedLVLocation, setSelectedLVLocation] = useState<Location | null>(null);
  const [user, setUser] = useState<APIUser | null>(null);
  const [sidebarView, setSidebarView] = useState<'favorites' | 'wantToGo' | 'profile'>('favorites');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [wantToGoIds, setWantToGoIds] = useState<Set<string>>(new Set());
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [searchResults, setSearchResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    initializeApp();
    checkExistingSession(); // Check for existing session on mount
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      console.log('🔍 Session details:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAccessToken: !!session?.access_token,
        tokenLength: session?.access_token?.length,
        tokenExpiry: session?.expires_at,
        now: Math.floor(Date.now() / 1000),
        isExpired: session?.expires_at ? (session.expires_at < Math.floor(Date.now() / 1000)) : 'N/A',
      });
      
      if (session?.user) {
        // User is logged in - fetch full user profile from backend
        try {
          const { user: userProfile } = await api.getCurrentUser();
          setUser(userProfile);
          console.log('✅ User profile loaded:', userProfile);
          
          // Load user's favorites and want-to-go lists
          await loadUserLists();
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          // Fallback to basic user data
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email || 'User',
            role: 'user', // Default role
          });
        }
        
        // Load saved location for logged-in user
        loadSavedLocation(session.user.id);
        
        if (event === 'SIGNED_IN') {
          toast.success('Welcome to Le Voyageur!');
        }
      } else {
        // User is logged out
        setUser(null);
        setFavoriteIds(new Set());
        setWantToGoIds(new Set());
        setLocationPermissionGranted(false);
        
        // Request location when not logged in (won't be saved)
        requestGeolocation();
      }
    });
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check for existing session on app load
  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Checking for existing session on load:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
      });
      
      if (session?.user) {
        // User has an active session - load their profile
        try {
          const { user: userProfile } = await api.getCurrentUser();
          setUser(userProfile);
          console.log('✅ Restored user profile from session:', userProfile);
          
          // Load user's favorites and want-to-go lists
          await loadUserLists();
          
          // Load saved location for logged-in user
          loadSavedLocation(session.user.id);
        } catch (error) {
          console.error('Failed to fetch user profile on session restore:', error);
          // Fallback to basic user data
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email || 'User',
            role: 'user',
          });
        }
      } else {
        // No session - request location without saving
        requestGeolocation();
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    }
  };

  const initializeApp = async () => {
    try {
      // First try to load API key from .env.local (Vite environment variable)
      const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (envApiKey) {
        setGoogleMapsApiKey(envApiKey);
        (window as any).GOOGLE_MAPS_API_KEY = envApiKey;
        console.log("API Key loaded from .env.local");
      } else {
        // Fallback: Fetch from server
        console.log("No API key in .env.local, fetching from server...");
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-48182530/config/google-maps-key`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );
        
        if (response.ok) {
          const { apiKey } = await response.json();
          setGoogleMapsApiKey(apiKey);
          (window as any).GOOGLE_MAPS_API_KEY = apiKey;
          console.log("API Key loaded from server");
        } else {
          console.error("Failed to load Google Maps API key");
        }
      }
      
      // Load locations
      await loadLocations();
    } catch (error) {
      console.error("Error during initialization:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const { locations: data } = await api.getLocations();
      console.log('Loaded locations:', data.length);
      setLocations(data);
    } catch (error: any) {
      console.error("Failed to load locations:", error);
    }
  };

  const handleTagSelect = async (tag: string) => {
    setSearchQuery(tag);
    try {
      const { locations: data } = await api.getLocationsByTag(tag);
      setHeatMapLocations(data);
      setShowHeatMap(data.length > 0);

      if (data.length === 0) {
        toast.info(`No locations found with tag "${tag}"`);
      } else {
        toast.success(`Found ${data.length} location(s) with tag "${tag}"`);
      }
    } catch (error: any) {
      toast.error("Search failed");
      console.error(error);
    }
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    // Store the selected Google place to show in Map
    setSelectedGooglePlace(place);
    setSelectedLVLocation(null); // Clear LV location when Google place is selected
    
    // Pan map to the selected place location
    if (place.geometry?.location) {
      const location = place.geometry.location;
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
      
      setMapCenter({ lat, lng });
      setMapZoom(15);
    }
  };

  const handlePOIClick = (place: google.maps.places.PlaceResult, lvLocation?: Location) => {
    // Called when ANY POI/marker is clicked (Google POI, LV marker, or search result)
    console.log('\n🎯 === APP.TSX: POI CLICK HANDLER ===');
    console.log('📍 Place:', place.name);
    console.log('🆔 Place ID:', place.place_id);
    console.log('📸 Photos in place object:', place.photos?.length || 0);
    console.log('⭐ Google rating:', place.rating);
    console.log('🏷️ Has LV data passed?', !!lvLocation);
    
    setSelectedGooglePlace(place);
    
    // If lvLocation was passed (from LV marker click), use it
    if (lvLocation) {
      console.log('✅ Using passed LV location:', {
        name: lvLocation.name,
        lvEditorsScore: lvLocation.lvEditorsScore,
        lvCrowdScore: lvLocation.lvCrowdsourceScore
      });
      setSelectedLVLocation(lvLocation);
    } else if (place.place_id) {
      // Otherwise, search our locations array for matching place_id
      const matchingLocation = locations.find(loc => loc.place_id === place.place_id);
      if (matchingLocation) {
        console.log('✅ Found matching LV location for Google POI:', {
          name: matchingLocation.name,
          lvEditorsScore: matchingLocation.lvEditorsScore,
          lvCrowdScore: matchingLocation.lvCrowdsourceScore
        });
        setSelectedLVLocation(matchingLocation);
      } else {
        console.log('⚠️ No LV location found for this Google POI');
        setSelectedLVLocation(null);
      }
    } else {
      setSelectedLVLocation(null);
    }
    
    console.log('📊 Final state being set:', {
      googlePlace: place.name,
      hasPhotos: !!(place.photos?.length),
      hasLVLocation: !!(lvLocation || locations.find(loc => loc.place_id === place.place_id))
    });
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
      
      // Get center and radius from map bounds
      const center = mapBounds.getCenter();
      const ne = mapBounds.getNorthEast();
      
      // Calculate radius using Haversine formula
      const R = 6371000; // Earth radius in meters
      const dLat = (ne.lat() - center.lat()) * Math.PI / 180;
      const dLng = (ne.lng() - center.lng()) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(center.lat() * Math.PI / 180) * Math.cos(ne.lat() * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const radius = Math.min(Math.round(R * c), 50000); // Max 50km
      
      console.log('🔍 Searching with params:', {
        query,
        center: { lat: center.lat(), lng: center.lng() },
        radius
      });
      
      // Use the Places library correctly
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      const request = {
        textQuery: query,
        fields: ['displayName', 'location', 'formattedAddress', 'id', 'rating', 'userRatingCount', 'types'],
        locationBias: {
          center: { lat: center.lat(), lng: center.lng() },
          radius: radius
        },
        maxResultCount: 20,
        language: 'en-US',
      };
      
      const { places } = await Place.searchByText(request);
      
      if (places && places.length > 0) {
        console.log('✅ Found places:', places.length);
        
        // Convert to PlaceResult format - places already have the fields we requested
        const results: google.maps.places.PlaceResult[] = places.map((place) => {
          return {
            place_id: place.id,
            name: place.displayName,
            formatted_address: place.formattedAddress,
            geometry: place.location ? {
              location: place.location
            } as google.maps.places.PlaceGeometry : undefined,
            rating: place.rating,
            user_ratings_total: place.userRatingCount,
            types: place.types
          };
        });
        
        setSearchResults(results);
        setShowSearchResults(true);
        toast.success(`Found ${results.length} places for "${query}"`);
      } else {
        toast.info(`No results found for "${query}"`);
      }
    } catch (error) {
      console.error('❌ Generic search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  const handleSeedDatabase = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-48182530/seed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully added ${data.locations.length} sample locations!`);
        await loadLocations();
      } else {
        toast.error('Failed to seed database');
      }
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Failed to seed database');
    }
  };

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) {
      toast.error('Login failed');
      console.error(error);
    } else {
      toast.success('Logged in successfully');
      setUser(data.user);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Logout failed');
      console.error(error);
    } else {
      toast.success('Logged out successfully');
      setUser(null);
    }
  };

  const loadUserLists = async () => {
    try {
      // Load favorites
      const { favorites } = await api.getFavorites();
      setFavoriteIds(new Set(favorites.map(loc => loc.id)));
      
      // Load want to go
      const { wantToGo } = await api.getWantToGo();
      setWantToGoIds(new Set(wantToGo.map(loc => loc.id)));
      
      console.log('✅ User lists loaded:', favorites.length, 'favorites,', wantToGo.length, 'want to go');
    } catch (error) {
      console.error('Failed to load user lists:', error);
    }
  };

  const handleToggleFavorite = async (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }
    
    const isFavorite = favoriteIds.has(locationId);
    
    try {
      if (isFavorite) {
        // Remove from favorites
        await api.removeFavorite(locationId);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(locationId);
          return newSet;
        });
        toast.success('Removed from favorites');
      } else {
        // Add to favorites
        console.log('💾 Saving favorite with place_id:', placeData?.place_id);
        await api.addFavorite(locationId, placeData);
        setFavoriteIds(prev => new Set([...prev, locationId]));
        toast.success('Added to favorites!');
      }
    } catch (error: any) {
      console.error('❌ Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleToggleWantToGo = async (locationId: string) => {
    if (!user) {
      toast.error('Please sign in to save to Want to Go');
      return;
    }
    
    const isWantToGo = wantToGoIds.has(locationId);
    
    try {
      if (isWantToGo) {
        // Remove from Want to Go
        await api.removeWantToGo(locationId);
        setWantToGoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(locationId);
          return newSet;
        });
        toast.success('Removed from Want to Go');
      } else {
        // Add to Want to Go
        await api.addWantToGo(locationId);
        setWantToGoIds(prev => new Set([...prev, locationId]));
        toast.success('Added to Want to Go!');
      }
    } catch (error) {
      console.error('❌ Error toggling Want to Go:', error);
      toast.error('Failed to update Want to Go');
    }
  };

  const loadSavedLocation = async (userId: string) => {
    try {
      const savedLocation = localStorage.getItem(`lv_location_${userId}`);
      
      if (savedLocation) {
        const userPos = JSON.parse(savedLocation);
        setMapCenter(userPos);
        setMapZoom(13);
        setUserLocation(userPos);
        setLocationPermissionGranted(true);
        console.log('✅ Using saved location for user:', userPos);
      } else {
        // No saved location, request fresh geolocation
        console.log('No saved location, requesting permission...');
        requestGeolocation(userId);
      }
    } catch (error) {
      console.error('Failed to load saved location:', error);
      requestGeolocation(userId);
    }
  };

  const requestGeolocation = (userId?: string) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(userPos);
          setMapZoom(13);
          setUserLocation(userPos);
          setLocationPermissionGranted(true);
          console.log('✅ Centered map on user location:', userPos);
          
          // Save location for logged-in users
          if (userId) {
            try {
              localStorage.setItem(`lv_location_${userId}`, JSON.stringify(userPos));
              console.log('✅ Saved location for future sessions');
            } catch (error) {
              console.error('Failed to save location:', error);
            }
          }
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Fallback to San Diego if geolocation is denied
          const fallbackLocation = { lat: 32.7157, lng: -117.1611 };
          setMapCenter(fallbackLocation);
          console.log('⚠️ Using fallback location (San Diego)');
        }
      );
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

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-light tracking-wider">
            LE VOYAGEUR
          </h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                </div>
                <Button
                  onClick={handleLogout}
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

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? 'w-0' : 'w-96'} bg-slate-50 border-r border-slate-200 overflow-y-auto transition-all duration-300`}>
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
                  <Profile user={user} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <APIProvider apiKey={googleMapsApiKey}>
            {/* Floating Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full px-4 sm:px-6"
              style={{ 
                maxWidth: 'min(640px, calc(100vw - 160px))',
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
              {showHeatMap && heatMapLocations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 mx-auto w-fit"
                >
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-amber-200">
                    <Flame className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-900">
                      Heat Map Active: {heatMapLocations.length} locations
                    </span>
                    <button
                      onClick={() => {
                        setShowHeatMap(false);
                        setSearchQuery("");
                        setHeatMapLocations([]);
                      }}
                      className="ml-2 text-gray-400 hover:text-gray-700 transition"
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
              className="absolute top-6 left-4 sm:left-6 z-20 p-3 bg-white/95 backdrop-blur-2xl rounded-xl shadow-lg border border-slate-200 hover:bg-white hover:shadow-xl transition-all duration-300"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5 text-slate-600" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              )}
            </motion.button>

            {/* Map Component */}
            <Map
              locations={locations}
              heatMapData={heatMapLocations}
              showHeatMap={showHeatMap}
              googleMapsApiKey={googleMapsApiKey}
              user={user}
              isAuthenticated={!!user}
              onFavoriteToggle={handleToggleFavorite}
              onWantToGoToggle={handleToggleWantToGo}
              favoriteIds={favoriteIds}
              wantToGoIds={wantToGoIds}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              selectedGooglePlace={selectedGooglePlace}
              selectedLVLocation={selectedLVLocation}
              onGooglePlaceClose={() => {
                setSelectedGooglePlace(null);
                setSelectedLVLocation(null);
              }}
              onMapBoundsChange={setMapBounds}
              searchResults={searchResults}
              showSearchResults={showSearchResults}
              onPOIClick={handlePOIClick}
            />
          </APIProvider>
        </div>
      </div>
    </div>
  );
}