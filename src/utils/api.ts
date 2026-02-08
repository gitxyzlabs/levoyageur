import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info.tsx';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a singleton Supabase client with a unique storage key to avoid conflicts
// Use a global variable to ensure only one instance exists even with hot reloading
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, publicAnonKey, {
      auth: {
        storageKey: 'lv-auth-token', // Unique key for this app
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();

const API_BASE = `${supabaseUrl}/functions/v1/make-server-48182530`;

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // Le Voyageur ratings (new unified naming)
  lvEditorScore?: number | null; // 0.0-11.0 scale
  lvEditorNotes?: string | null;
  lvAvgUserScore?: number | null; // 0.0-10.0 scale (cached from user_ratings)
  lvUserRatingsCount?: number;
  // External ratings
  googleRating?: number | null; // 0-5 scale
  googleRatingsCount?: number;
  michelinStars?: number | null; // 1, 2, or 3
  michelinDistinction?: string | null; // 'Bib Gourmand', etc.
  michelinGreenStar?: boolean;
  // Core data
  tags: string[];
  category?: string | null; // 'restaurant', 'hotel', 'bar'
  description?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  cuisine?: string | null;
  area?: string | null;
  image?: string | null;
  // External identifiers
  googlePlaceId?: string | null; // Google Place ID
  michelinId?: string | number | null; // Michelin restaurant ID (can be string or number)
  // Backward compatibility
  placeId?: string; // Alias for googlePlaceId (camelCase to match backend)
  place_id?: string; // Also support snake_case for Map component
  // Metadata
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  favoritesCount?: number; // Number of users who have favorited this location
  
  // Deprecated fields (for backward compatibility during migration)
  /** @deprecated Use lvEditorScore instead */
  lvEditorsScore?: number;
  /** @deprecated Use lvAvgUserScore instead */
  lvCrowdsourceScore?: number;
  /** @deprecated Use michelinStars/michelinDistinction instead */
  michelinScore?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'editor';
}

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let finalSession = null;
  
  try {
    // Try to refresh the session
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
    
    if (session) {
      finalSession = session;
      console.log('✅ Session refreshed successfully');
    } else if (sessionError) {
      console.warn('⚠️ Session refresh failed, falling back to getSession:', sessionError.message);
      // Fallback to getSession if refresh fails
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      finalSession = existingSession;
    }
  } catch (error) {
    console.warn('⚠️ Session refresh error, falling back to getSession:', error);
    // Fallback to getSession if refresh throws an error
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    finalSession = existingSession;
  }
  
  console.log('=== fetchWithAuth Debug ===');
  console.log('URL:', url);
  console.log('Has session:', !!finalSession);
  console.log('Has access_token:', !!finalSession?.access_token);
  console.log('Token expires at:', finalSession?.expires_at);
  console.log('Token (first 20 chars):', finalSession?.access_token?.substring(0, 20) || 'N/A');
  
  if (!finalSession?.access_token) {
    console.error('❌ No access token available');
    throw new Error('Not authenticated - please sign in again');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${finalSession.access_token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ fetchWithAuth error:', error);
    
    // If we get a 401, the session might be invalid - force sign out
    if (response.status === 401) {
      console.error('❌ 401 Unauthorized - session invalid, signing out');
      await supabase.auth.signOut();
      throw new Error('Session expired - please sign in again');
    }
    
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const api = {
  // Auth
  signUp: async (email: string, password: string, name: string) => {
    // Public endpoint - doesn't require auth
    const response = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  createOAuthUser: async (user: User) => {
    return fetchWithAuth(`${API_BASE}/create-oauth-user`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    setAccessToken(data.session?.access_token || null);
    return data;
  },

  signInWithOAuth: async (provider: 'google' | 'apple' | 'twitter') => {
    // Always redirect back to the current origin (lvofc.com in production, localhost in dev)
    const redirectTo = window.location.origin;
    
    console.log('=== OAuth Debug ===');
    console.log('Current URL:', window.location.href);
    console.log('Redirect after auth:', redirectTo);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      throw error;
    }
    
    console.log('OAuth initiated, redirecting to provider...');
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAccessToken(null);
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      throw error;
    }
    
    console.log('=== getSession Debug ===');
    console.log('Has session:', !!data.session);
    console.log('User ID:', data.session?.user?.id);
    console.log('Email:', data.session?.user?.email);
    console.log('Has access_token:', !!data.session?.access_token);
    console.log('Access token length:', data.session?.access_token?.length || 0);
    console.log('Access token (first 20 chars):', data.session?.access_token?.substring(0, 20));
    
    if (data.session?.access_token) {
      setAccessToken(data.session.access_token);
      console.log('✅ Access token saved to memory');
      console.log('🔍 Current accessToken in memory:', accessToken?.substring(0, 20));
    }
    
    return data.session;
  },

  // User
  getCurrentUser: async () => {
    const userData = await fetchWithAuth(`${API_BASE}/user`);
    // The server returns { user: userData }, so just return it as is
    return userData;
  },

  updateUserRole: async (role: 'user' | 'editor') => {
    return fetchWithAuth(`${API_BASE}/user/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  // Admin endpoints
  getAllUsers: async (): Promise<{ users: User[] }> => {
    return fetchWithAuth(`${API_BASE}/admin/users`);
  },

  updateUserRoleByAdmin: async (userId: string, role: 'user' | 'editor') => {
    return fetchWithAuth(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  // Locations
  getLocations: async (): Promise<{ locations: Location[] }> => {
    // Public endpoint - doesn't require auth
    // Try without auth first, then fallback to anon key if JWT verification is enabled
    let response = await fetch(`${API_BASE}/locations`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If we get 401, it means JWT verification is ON in Supabase dashboard
    // Fallback to using anon key (will work until JWT is disabled)
    if (response.status === 401) {
      // Silent fallback - no need to warn user since this is handled gracefully
      response = await fetch(`${API_BASE}/locations`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getLocations error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getLocationsByTag: async (tag: string): Promise<{ locations: Location[] }> => {
    // Public endpoint - doesn't require auth
    // Try without auth first, then fallback to anon key if JWT verification is enabled
    let response = await fetch(`${API_BASE}/locations/tag/${encodeURIComponent(tag)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If we get 401, it means JWT verification is ON in Supabase dashboard
    // Fallback to using anon key (will work until JWT is disabled)
    if (response.status === 401) {
      // Silent fallback - no need to warn user since this is handled gracefully
      response = await fetch(`${API_BASE}/locations/tag/${encodeURIComponent(tag)}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getLocationsByTag error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  addLocation: async (location: Omit<Location, 'id' | 'createdBy' | 'createdAt'>) => {
    return fetchWithAuth(`${API_BASE}/locations`, {
      method: 'POST',
      body: JSON.stringify(location),
    });
  },

  updateLocation: async (id: string, updates: Partial<Location>) => {
    return fetchWithAuth(`${API_BASE}/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteLocation: async (id: string) => {
    return fetchWithAuth(`${API_BASE}/locations/${id}`, {
      method: 'DELETE',
    });
  },

  // Guides
  getCityGuide: async (cityId: string) => {
    return fetchWithAuth(`${API_BASE}/guides/${cityId}`);
  },

  // Favorites
  getFavorites: async (): Promise<{ favorites: Location[] }> => {
    return fetchWithAuth(`${API_BASE}/favorites`);
  },

  addFavorite: async (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => {
    return fetchWithAuth(`${API_BASE}/favorites/${locationId}`, {
      method: 'POST',
      body: JSON.stringify(placeData || {}),
    });
  },

  removeFavorite: async (locationId: string) => {
    return fetchWithAuth(`${API_BASE}/favorites/${locationId}`, {
      method: 'DELETE',
    });
  },

  // Get total favorites count for locations in a city
  getCityFavorites: async (locationIds: string[]): Promise<{ totalFavorites: number }> => {
    // Public endpoint - no auth required
    try {
      const response = await fetch(`${API_BASE}/favorites/city-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locationIds }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        console.error('❌ getCityFavorites error:', error);
        // Return 0 favorites if endpoint fails instead of throwing
        return { totalFavorites: 0 };
      }

      return response.json();
    } catch (error) {
      console.error('❌ getCityFavorites network error:', error);
      // Return 0 favorites on network error
      return { totalFavorites: 0 };
    }
  },

  // Want to Go
  getWantToGo: async (): Promise<{ wantToGo: Location[] }> => {
    return fetchWithAuth(`${API_BASE}/want-to-go`);
  },

  addWantToGo: async (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => {
    return fetchWithAuth(`${API_BASE}/want-to-go/${locationId}`, {
      method: 'POST',
      body: JSON.stringify(placeData || {}),
    });
  },

  removeWantToGo: async (locationId: string) => {
    return fetchWithAuth(`${API_BASE}/want-to-go/${locationId}`, {
      method: 'DELETE',
    });
  },

  // Tags
  getTags: async (): Promise<{ tags: string[] }> => {
    // Public endpoint - doesn't require auth
    const response = await fetch(`${API_BASE}/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getTags error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Editor: Update location rating and tags
  updateLocationRating: async (
    locationId: string, 
    lvEditorsScore?: number, 
    michelinScore?: number,
    tags?: string[],
    placeData?: {
      name: string;
      lat: number;
      lng: number;
      formatted_address?: string;
      rating?: number;
    },
    michelinId?: number
  ) => {
    return fetchWithAuth(`${API_BASE}/locations/${locationId}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ lvEditorsScore, michelinScore, tags, placeData, michelinId }),
    });
  },

  // User Ratings
  getUserRating: async (locationId: string): Promise<{ rating: number | null }> => {
    return fetchWithAuth(`${API_BASE}/ratings/${locationId}`);
  },

  setUserRating: async (locationId: string, rating: number) => {
    return fetchWithAuth(`${API_BASE}/ratings/${locationId}`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  },

  getCommunityRatingCount: async (locationId: string): Promise<{ count: number }> => {
    return fetchWithAuth(`${API_BASE}/ratings/${locationId}/count`);
  },

  // Google Places
  getGooglePlaceDetails: async (placeId: string) => {
    return fetchWithAuth(`${API_BASE}/google/place/${encodeURIComponent(placeId)}`);
  },

  // Michelin Data
  syncMichelinData: async (offset: number = 0, limit: number = 500): Promise<{ success: boolean; added: number; message: string; totalAvailable?: number; imported?: number }> => {
    return fetchWithAuth(`${API_BASE}/michelin/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset, limit }),
    });
  },

  discoverMichelinPlaceIds: async (offset: number = 0, limit: number = 50): Promise<{ success: boolean; processed: number; discovered: number; message: string }> => {
    return fetchWithAuth(`${API_BASE}/michelin/discover-place-ids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset, limit }),
    });
  },

  getMichelinRating: async (lat: number, lng: number, name?: string): Promise<{ michelinScore: number | null; hasMichelinRating: boolean }> => {
    // Public endpoint - doesn't require auth
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    
    if (name) {
      params.append('name', name);
    }
    
    const response = await fetch(`${API_BASE}/michelin/rating?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`, // Add public key for Supabase
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getMichelinRating error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getMichelinRestaurants: async (north: number, south: number, east: number, west: number) => {
    // Public endpoint - doesn't require auth
    const params = new URLSearchParams({
      north: north.toString(),
      south: south.toString(),
      east: east.toString(),
      west: west.toString(),
    });
    
    const response = await fetch(`${API_BASE}/michelin/restaurants?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`, // Add public key for Supabase
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getMichelinRestaurants error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Suggest Google Place ID for a Michelin restaurant
  suggestPlaceForMichelin: async (michelinId: number) => {
    // Public endpoint - doesn't require auth
    const response = await fetch(`${API_BASE}/michelin/${michelinId}/suggest-place`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ suggestPlaceForMichelin error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Validate a suggested Place ID for a Michelin restaurant
  validateMichelinPlace: async (michelinId: number, placeId: string, status: 'confirmed' | 'rejected' | 'unsure') => {
    const response = await fetchWithAuth(`${API_BASE}/michelin/${michelinId}/validate-place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ placeId, status }),
    });

    // fetchWithAuth already returns parsed JSON, not a Response object
    return response;
  },
};