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
  User
} from 'lucide-react';

import { Map } from './components/Map';
import { SearchAutocomplete } from './components/SearchAutocomplete';

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
  const [user, setUser] = useState<APIUser | null>(null);

  useEffect(() => {
    initializeApp();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      
      if (session?.user) {
        // User is logged in
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email || 'User',
          role: 'user', // Default role
        });
        
        if (event === 'SIGNED_IN') {
          toast.success('Welcome to Le Voyageur!');
        }
      } else {
        // User is logged out
        setUser(null);
      }
    });
    
    // Get user's geolocation and center map on it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(userPos);
          setMapZoom(13);
          console.log('✅ Centered map on user location:', userPos);
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
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
    
    // Pan map to the selected place location
    if (place.geometry?.location) {
      const location = place.geometry.location;
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
      
      setMapCenter({ lat, lng });
      setMapZoom(15);
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setShowHeatMap(false);
    setHeatMapLocations([]);
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
            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-light mb-1">
                    {locations.length}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total Locations
                  </p>
                </div>
                
                {locations.length === 0 && (
                  <Button 
                    onClick={handleSeedDatabase}
                    className="w-full gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    Add Sample Locations
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  How to use
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  • Click on markers to view detailed scores
                </p>
                <p>• Search by tag to activate heat map</p>
                <p>
                  • Heat map colors: blue (low) → red (high)
                </p>
              </CardContent>
            </Card>
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
              onFavoriteToggle={() => {}}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              selectedGooglePlace={selectedGooglePlace}
              onGooglePlaceClose={() => setSelectedGooglePlace(null)}
            />
          </APIProvider>
        </div>
      </div>
    </div>
  );
}