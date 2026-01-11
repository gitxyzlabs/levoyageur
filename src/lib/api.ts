import { createClient } from '@supabase/supabase-js';

// Import from the utils folder at the root
declare const projectId: string;
declare const publicAnonKey: string;

// We'll initialize these in the component
let supabaseUrl = '';
let supabase: ReturnType<typeof createClient> | null = null;
let anonKey = '';

export const initializeSupabase = (pid: string, key: string) => {
  // Only initialize once
  if (supabase) {
    return supabase;
  }
  
  supabaseUrl = `https://${pid}.supabase.co`;
  anonKey = key;
  supabase = createClient(supabaseUrl, key);
  return supabase;
};

const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }
  return supabase;
};

const getApiBase = () => {
  if (!supabaseUrl) {
    throw new Error('Supabase not initialized');
  }
  return `${supabaseUrl}/functions/v1/make-server-48182530`;
};

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
  place_id?: string | null;
  cuisine?: string | null;
  area?: string | null;
  image?: string | null;
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
  // Use access token if available, otherwise use the public anon key
  const authToken = accessToken || anonKey;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
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
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  signIn: async (email: string, password: string) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    setAccessToken(data.session?.access_token || null);
    return data;
  },

  signOut: async () => {
    const sb = getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    setAccessToken(null);
  },

  getSession: async () => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    
    if (data.session?.access_token) {
      setAccessToken(data.session.access_token);
    }
    
    return data.session;
  },

  // User
  getCurrentUser: async () => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/user`);
  },

  updateUserRole: async (role: 'user' | 'editor') => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/user/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  // Locations
  getLocations: async (): Promise<{ locations: Location[] }> => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/locations`);
  },

  getLocationsByTag: async (tag: string): Promise<{ locations: Location[] }> => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/locations/tag/${encodeURIComponent(tag)}`);
  },

  addLocation: async (location: Omit<Location, 'id' | 'createdBy' | 'createdAt'>) => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/locations`, {
      method: 'POST',
      body: JSON.stringify(location),
    });
  },

  updateLocation: async (id: string, updates: Partial<Location>) => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteLocation: async (id: string) => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/locations/${id}`, {
      method: 'DELETE',
    });
  },

  // Guides
  getCityGuide: async (cityId: string) => {
    const API_BASE = getApiBase();
    return fetchWithAuth(`${API_BASE}/guides/${cityId}`);
  },
};