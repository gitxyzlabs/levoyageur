import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info.tsx';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a singleton Supabase client with a unique storage key to avoid conflicts
export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    storageKey: 'lv-auth-token', // Unique key for this app
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

const API_BASE = `${supabaseUrl}/functions/v1/make-server-48182530`;

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lvEditorsScore: number;
  lvCrowdsourceScore: number;
  googleRating: number;
  michelinScore: number;
  tags: string[];
  description?: string;
  placeId?: string; // Google Place ID (camelCase to match backend)
  place_id?: string; // Also support snake_case for Map component
  address?: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  favoritesCount?: number; // Number of users who have favorited this location
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
  // Always get the latest session token instead of using cached variable
  const { data: { session } } = await supabase.auth.getSession();
  
  console.log('=== fetchWithAuth Debug ===');
  console.log('URL:', url);
  console.log('Full session:', session);
  console.log('Session keys:', session ? Object.keys(session) : 'null');
  console.log('Has access_token:', !!session?.access_token);
  console.log('Using token:', session?.access_token?.substring(0, 30) + '...');
  console.log('Has session:', !!session);
  console.log('Using token type:', session?.access_token ? 'ACCESS_TOKEN' : 'NO_TOKEN');
  console.log('Token (first 20 chars):', session?.access_token?.substring(0, 20) || 'N/A');
  
  // Don't use anon key as Bearer token - it's not a JWT!
  if (!session?.access_token) {
    console.error('❌ No access token available');
    console.error('Session data:', JSON.stringify(session, null, 2));
    throw new Error('Not authenticated - no access token');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ fetchWithAuth error:', error);
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
    // Public endpoint - use anon key for access
    const response = await fetch(`${API_BASE}/favorites/city-stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ locationIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getCityFavorites error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
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
    tags?: string[],
    placeData?: {
      name: string;
      lat: number;
      lng: number;
      formatted_address?: string;
      rating?: number;
    }
  ) => {
    return fetchWithAuth(`${API_BASE}/locations/${locationId}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ lvEditorsScore, tags, placeData }),
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
  syncMichelinData: async (): Promise<{ success: boolean; count: number; message: string }> => {
    return fetchWithAuth(`${API_BASE}/michelin/sync`, {
      method: 'POST',
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
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      console.error('❌ getMichelinRating error:', error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};