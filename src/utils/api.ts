import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabase = createClient(supabaseUrl, publicAnonKey);

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
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });

    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAccessToken(null);
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (data.session?.access_token) {
      setAccessToken(data.session.access_token);
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

  // Locations
  getLocations: async (): Promise<{ locations: Location[] }> => {
    return fetchWithAuth(`${API_BASE}/locations`);
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
};