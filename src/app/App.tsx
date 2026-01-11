import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { toast, Toaster } from 'sonner';
import { Search, MapPin, Star, TrendingUp, Menu, X, Heart, Plus, Users, Settings, LogOut } from 'lucide-react';
import { api, setAccessToken, type Location, type User } from '../utils/api';
import { supabase } from '../utils/supabase';
import { Auth } from './components/Auth';
import { AddLocationModal } from './components/AddLocationModal';
import { AdminPanel } from './components/AdminPanel';
import { AutocompleteInput } from './components/AutocompleteInput';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [heatMapLocations, setHeatMapLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [googlePlacesResults, setGooglePlacesResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [favoritesKey, setFavoritesKey] = useState(0);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<google.maps.places.PlaceResult | null>(null);

  useEffect(() => {
    initializeApp();
    
    // Get user's geolocation and center map on it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(userPos);
          // Center map on user's location
          setMapCenter(userPos);
          setMapZoom(13); // Good zoom level to see nearby locations
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
    
    // Listen for auth state changes (CRITICAL for OAuth!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event);
      console.log('Session user:', session?.user?.email);
      console.log('Session expires at:', session?.expires_at);
      
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ User signed in via OAuth, loading user data...');
        setAccessToken(session.access_token);
        toast.success('Welcome back!');
        await handleOAuthSignIn(session);
      } else if (event === 'SIGNED_OUT') {
        console.log('🔓 User signed out');
        setIsAuthenticated(false);
        setUser(null);
        setAccessToken(null);
        toast.info('You have been signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
        if (session?.access_token) {
          setAccessToken(session.access_token);
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // First try to load API key from .env.local (Vite environment variable)
      const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (envApiKey) {
        // Use API key from .env.local
        setGoogleMapsApiKey(envApiKey);
        (window as any).GOOGLE_MAPS_API_KEY = envApiKey;
        console.log("=== Google Maps Debug ===");
        console.log("API Key loaded from .env.local: ✅ Yes");
        console.log("API Key (first 10 chars):", envApiKey.substring(0, 10) + "...");
        console.log("API Key length:", envApiKey.length);
      } else {
        // Fallback: Fetch from server (for Figma Make environment)
        console.log("=== Google Maps Debug ===");
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
          console.log("API Key loaded from server: ✅ Yes");
          console.log("API Key (first 10 chars):", apiKey.substring(0, 10) + "...");
          console.log("API Key length:", apiKey.length);
        } else {
          console.error("❌ Failed to load Google Maps API key from server");
          console.error("Please add VITE_GOOGLE_MAPS_API_KEY to .env.local file");
        }
      }
      
      // Load locations and check auth (important for OAuth callback!)
      await checkAuthAndLoadData();
    } catch (error) {
      console.error("Error during initialization:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthAndLoadData = async () => {
    try {
      // Always load locations first (no auth required)
      await loadLocations();
      
      // Check if user is logged in (optional)
      console.log('Checking for active session...');
      const session = await api.getSession();
      
      if (session) {
        console.log('Session found! User ID:', session.user.id);
        console.log('User email:', session.user.email);
        console.log('Access token available:', !!session.access_token);
        
        // IMPORTANT: Set the access token first before making any API calls
        setAccessToken(session.access_token);
        
        // Wait a tiny bit to ensure token is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // Try to get user data from backend
          const { user: userData } = await api.getCurrentUser();
          console.log('User data loaded from backend:', userData);
          console.log('User role from backend:', userData.role);
          console.log('User ID:', userData.id);
          console.log('User email:', userData.email);
          console.log('🔍 ROLE CHECK - Is user an editor?', userData.role === 'editor');
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error: any) {
          console.error('❌ Error loading user from backend:', error);
          console.error('Error message:', error.message);
          
          // If user doesn't exist in backend, the backend will auto-create
          // So if we still get an error, something else is wrong
          toast.error('Failed to load user data. Please try signing out and back in.');
        }
      } else {
        console.log('No active session found');
      }
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  };

  const handleOAuthSignIn = async (session: any) => {
    try {
      // Try to get user data from backend
      const { user: userData } = await api.getCurrentUser();
      console.log('User data loaded from backend:', userData);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      // If user doesn't exist in backend (OAuth first-time login), create them
      if (error.message.includes('User not found') || error.message.includes('Unauthorized')) {
        console.log('User not found in backend, creating new user record...');
        
        // Create user record for OAuth users
        const newUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          role: 'user' as const,
        };
        
        await api.createOAuthUser(newUser);
        console.log('Created new user:', newUser);
        setUser(newUser);
        setIsAuthenticated(true);
        toast.success(`Welcome, ${newUser.name}!`);
      } else {
        throw error;
      }
    }
  };

  const loadLocations = async () => {
    try {
      const { locations: data } = await api.getLocations();
      console.log('Loaded locations:', data);
      console.log('Number of locations:', data.length);
      if (data.length > 0) {
        console.log('First location details:', JSON.stringify(data[0], null, 2));
      }
      setLocations(data);
    } catch (error: any) {
      console.error("Failed to load locations:", error);
      // Don't show error toast on initial load
    }
  };

  const handleGooglePlacesSearch = (places: google.maps.places.PlaceResult[]) => {
    console.log('Google Places results:', places);
    setGooglePlacesResults(places);
    
    // Show toast
    toast.success(`Found ${places.length} place(s) on Google Maps`);
  };

  const handleClearGooglePlacesSearch = () => {
    setGooglePlacesResults([]);
  };

  const handleAddLocationClick = async (locationData: any) => {
    if (!isAuthenticated || user?.role !== 'editor') {
      toast.error('You must be signed in as an editor to add locations');
      return;
    }

    console.log('=== handleAddLocationClick Debug ===');
    console.log('locationData received:', locationData);
    console.log('place_id:', locationData.place_id);

    try {
      const newLocation = {
        name: locationData.name,
        lat: locationData.lat,
        lng: locationData.lng,
        lvEditorsScore: locationData.lvEditorsScore,
        lvCrowdsourceScore: locationData.lvCrowdsourceScore || 0,
        googleRating: locationData.googleRating || 0,
        michelinScore: locationData.michelinScore || 0,
        tags: locationData.tags || [],
        description: locationData.description,
        place_id: locationData.place_id,
        image: locationData.image,
        cuisine: locationData.cuisine,
        area: locationData.area,
      };

      console.log('Sending to API:', newLocation);

      await api.addLocation(newLocation);
      toast.success(`Added ${locationData.name} to the collection!`);
      await loadLocations();
      setShowAddModal(false);
      setSelectedPlace(null);
      setGooglePlacesResults([]);
    } catch (error: any) {
      toast.error('Failed to add location');
      console.error(error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowHeatMap(false);
      setHeatMapLocations([]);
      return;
    }

    try {
      const { locations: data } =
        await api.getLocationsByTag(searchQuery);
      setHeatMapLocations(data);
      setShowHeatMap(data.length > 0);

      if (data.length === 0) {
        toast.info(
          `No locations found with tag "${searchQuery}"`,
        );
      } else {
        toast.success(
          `Found ${data.length} location(s) with tag "${searchQuery}"`,
        );
      }
    } catch (error: any) {
      toast.error("Search failed");
      console.error(error);
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
    console.log('=== Selected Place Debug ===');
    console.log('Selected place:', place);
    console.log('Place ID:', place.place_id);
    console.log('Place name:', place.name);
    console.log('Place geometry:', place.geometry);
    console.log('Is authenticated:', isAuthenticated);
    console.log('User:', user);
    console.log('User role:', user?.role);
    
    // Store the selected Google place to show in Map
    setSelectedGooglePlace(place);
    
    // Clear the search results after selection
    setGooglePlacesResults([]);
    
    // Pan map to the selected place location
    if (place.geometry?.location) {
      const location = place.geometry.location;
      const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
      const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
      
      console.log('Panning to:', { lat, lng });
      
      // Store the location to pan the map (no offset - center directly on location)
      setMapCenter({ lat, lng });
      setMapZoom(15); // Zoom in close
    }
    
    // Open the add location modal for editors
    if (isAuthenticated && user?.role === 'editor') {
      setSelectedPlace(place);
      setShowAddModal(true);
    }
    // For everyone else (including non-authenticated), just show the info window via Map component
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setShowHeatMap(false);
    setHeatMapLocations([]);
  };

  const handleSignOut = async () => {
    try {
      await api.signOut();
      setIsAuthenticated(false);
      setUser(null);
      toast.success("Signed out successfully");
    } catch (error: any) {
      toast.error("Sign out failed");
    }
  };

  const handleBecomeEditor = async () => {
    try {
      // Call the admin endpoint to promote the current user
      const { user: updatedUser } = await api.updateUserRoleByAdmin(user!.id, "editor");
      setUser(updatedUser);
      toast.success("You are now an editor! Refresh the page to see editor features.");
      // Reload the page to update the UI
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to become editor:', error);
      toast.error("Failed to update role: " + error.message);
    }
  };

  const handleAuthSuccess = async () => {
    setShowAuth(false);
    await checkAuthAndLoadData();
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

  // Don't render until Google Maps API key is loaded
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

  // Show auth modal if requested
  if (showAuth) {
    return (
      <>
        <Auth onAuthSuccess={handleAuthSuccess} />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <div className="size-full flex flex-col bg-white">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-light tracking-wider">
              LE VOYAGEUR
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <UserProfile 
                user={user} 
                onSignOut={handleSignOut}
              />
            ) : (
              <Button
                variant="default"
                onClick={() => setShowAuth(true)}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Sign In
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

            {/* Editor Panel - Only show if user is logged in and is an editor */}
            {isAuthenticated && user?.role === "editor" && (
              <>
                <AdminPanel currentUser={user} />
                <EditorPanel
                  onLocationAdded={loadLocations}
                  locations={locations}
                  onLocationDeleted={loadLocations}
                />
              </>
            )}

            {/* Favorites - Only show for logged-in users */}
            {isAuthenticated && user && (
              <Favorites
                key={favoritesKey}
                user={user}
                userLocation={userLocation}
              />
            )}

            {/* Become Editor Button - Only show for non-editor authenticated users */}
            {isAuthenticated && user && user.role !== 'editor' && (
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                    Become an Editor
                  </CardTitle>
                  <CardDescription>
                    Upgrade your account to add and manage locations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleBecomeEditor}
                    className="w-full gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    Become Editor
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Login prompt for non-authenticated users */}
            {!isAuthenticated && (
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300">
                <CardHeader>
                  <CardTitle className="text-lg">
                    Join Le Voyageur
                  </CardTitle>
                  <CardDescription>
                    Sign in to become an editor and add locations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setShowAuth(true)}
                    className="w-full gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In / Sign Up
                  </Button>
                </CardContent>
              </Card>
            )}

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
                {user?.role === "editor" && (
                  <p className="text-amber-600 font-medium">
                    • As an editor, you can add and manage
                    locations
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {console.log('Rendering map with API key:', googleMapsApiKey ? 'Present' : 'Missing')}
          {console.log('Number of locations:', locations.length)}
          <APIProvider apiKey={googleMapsApiKey}>
            {/* Floating Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full px-4 sm:px-6"
              style={{ 
                maxWidth: 'min(640px, calc(100vw - 160px))', // Ensure space for chevron + padding
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
              isAuthenticated={isAuthenticated}
              onFavoriteToggle={() => setFavoritesKey(prev => prev + 1)}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              selectedGooglePlace={selectedGooglePlace}
              onGooglePlaceClose={() => setSelectedGooglePlace(null)}
            />
          </APIProvider>
        </div>
      </div>

      {/* Add Location Modal */}
      <AnimatePresence>
        {showAddModal && selectedPlace && (
          <AddLocationModal
            isOpen={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setSelectedPlace(null);
            }}
            onSave={handleAddLocationClick}
            initialPlace={selectedPlace}
            onLocationAdded={loadLocations}
            selectedPlace={selectedPlace}
          />
        )}
      </AnimatePresence>
    </div>
  );
}