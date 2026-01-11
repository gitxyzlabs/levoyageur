import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabase = createClient(supabaseUrl, publicAnonKey);

// Use custom domain for API calls in production, Supabase URL in development
const isProduction = window.location.hostname === 'lvofc.com';
const API_BASE = isProduction 
  ? 'https://lvofc.com/api'  // Custom domain API endpoint
  : `${supabaseUrl}/functions/v1/make-server-48182530`; // Development endpoint

console.log('=== API Configuration ===');
console.log('Environment:', isProduction ? 'PRODUCTION (lvofc.com)' : 'DEVELOPMENT');
console.log('API Base URL:', API_BASE);
console.log('Hostname:', window.location.hostname);

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
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
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
  console.log('Has session:', !!session);
  console.log('Using token type:', session?.access_token ? 'ACCESS_TOKEN' : 'NO_TOKEN');
  console.log('Token (first 20 chars):', session?.access_token?.substring(0, 20) || 'N/A');
  
  // Don't use anon key as Bearer token - it's not a JWT!
  if (!session?.access_token) {
    console.error('❌ No access token available');
    throw new Error('Not authenticated');
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
    return fetchWithAuth(`${API_BASE}/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
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
    return fetchWithAuth(`${API_BASE}/user`);
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
    // Public endpoint - no auth required
    const response = await fetch(`${API_BASE}/locations`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to load locations:', response.status, errorText);
      throw new Error(`Failed to load locations: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Locations loaded successfully:', data);
    // Server returns array directly, wrap it for consistency
    return { locations: Array.isArray(data) ? data : [] };
  },

  getLocationsByTag: async (tag: string): Promise<{ locations: Location[] }> => {
    return fetchWithAuth(`${API_BASE}/locations/tag/${encodeURIComponent(tag)}`);
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

  addFavorite: async (locationId: string) => {
    return fetchWithAuth(`${API_BASE}/favorites/${locationId}`, {
      method: 'POST',
    });
  },

  removeFavorite: async (locationId: string) => {
    return fetchWithAuth(`${API_BASE}/favorites/${locationId}`, {
      method: 'DELETE',
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
};