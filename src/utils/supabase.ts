import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info.tsx';

/**
 * Supabase Client Singleton
 * 
 * This file creates a SINGLE instance of the Supabase client to avoid
 * the "Multiple GoTrueClient instances detected" warning.
 * 
 * ALL imports of the Supabase client should come from this file:
 * - import { supabase } from './utils/supabase';
 * - OR import { supabase } from './utils/api'; (re-exported for convenience)
 * 
 * DO NOT create new Supabase clients elsewhere in the frontend code!
 */

// Create the Supabase URL from the project ID
const supabaseUrl = `https://${projectId}.supabase.co`;

// Create a SINGLE Supabase client instance at module load time
console.log('🔧 Initializing Supabase client singleton...');
export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'sb-vwikyikicmfefzntshsl-auth-token',
  },
});
console.log('✅ Supabase client initialized');

// Export the configuration values
export { supabaseUrl, projectId, publicAnonKey };