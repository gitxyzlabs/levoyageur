import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { toast, Toaster } from 'sonner';
import { 
  LogIn, 
  LogOut, 
  Search, 
  MapPin, 
  Flame,
  Sparkles
} from 'lucide-react';

import { Map } from './components/Map';
import { Auth } from './components/Auth';
import { EditorPanel } from './components/EditorPanel';
import { AddLocationModal } from './components/AddLocationModal';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { Label } from './components/ui/label';

import { api, supabase } from '../utils/api';
import type { Location as APILocation, User as APIUser } from '../utils/api';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// Use types from API
type Location = APILocation & {
  place_id?: string;
  image?: string;
  cuisine?: string;
  area?: string;
};

type User = APIUser;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [heatMapLocations, setHeatMapLocations] = useState<
    Location[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [googlePlacesResults, setGooglePlacesResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>("");

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // First try to load API key from .env.local (Vite environment variable)
      const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (envApiKey) {
        // Use API key from .env.local
        setGoogleMapsApiKey(envApiKey);
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
          console.log("API Key loaded from server: ✅ Yes");
          console.log("API Key (first 10 chars):", apiKey.substring(0, 10) + "...");
          console.log("API Key length:", apiKey.length);
        } else {
          console.error("❌ Failed to load Google Maps API key from server");
          console.error("Please add VITE_GOOGLE_MAPS_API_KEY to .env.local file");
          toast.error("Google Maps API key not configured. Please add it to .env.local");
        }
      }

      // Then check auth and load data
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
      const session = await api.getSession();
      if (session) {
        const { user: userData } = await api.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error during initialization:", error);
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
      const { user: updatedUser } =
        await api.updateUserRole("editor");
      setUser(updatedUser);
      toast.success("You are now an editor!");
    } catch (error: any) {
      toast.error("Failed to update role");
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
            {user && (
              <Badge
                variant={
                  user?.role === "editor" ? "default" : "outline"
                }
              >
                {user?.role === "editor" ? "Editor" : "Traveler"}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <div className="text-sm text-right hidden md:block">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                {user.role !== "editor" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBecomeEditor}
                  >
                    Become Editor
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
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
        <div className="w-96 bg-slate-50 border-r border-slate-200 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search by Tag
                </CardTitle>
                <CardDescription>
                  Find the best locations by category
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., tacos, sushi, hotel..."
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleSearch()
                    }
                  />
                  <Button onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {showHeatMap && heatMapLocations.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-600" />
                      <div>
                        <Label className="text-sm font-medium">
                          Heat Map Active
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Showing {heatMapLocations.length}{" "}
                          locations
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={showHeatMap}
                      onCheckedChange={(checked) => {
                        setShowHeatMap(checked);
                        if (!checked) {
                          setSearchQuery("");
                          setHeatMapLocations([]);
                        }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

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
              <EditorPanel
                onLocationAdded={loadLocations}
                locations={locations}
                onLocationDeleted={loadLocations}
              />
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
          <APIProvider apiKey={googleMapsApiKey}>
            <Map
              locations={locations}
              heatMapData={heatMapLocations}
              showHeatMap={showHeatMap}
              googleMapsApiKey={googleMapsApiKey}
            />
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
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="absolute bottom-4 left-4 bg-white shadow-md p-4">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        Heat Map Legend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full" />
                        <Label className="text-sm font-medium">
                          Low
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full" />
                        <Label className="text-sm font-medium">
                          High
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}