'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type SupabaseContextType = {
  supabase: any;
  session: any;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  // DEBUG: Log environment variables
  console.log('🔍 SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('🔍 SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ LOADED' : '❌ MISSING');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Missing Supabase env vars!');
    return (
      <div className="p-8 text-center text-red-600">
        <h2>🚨 Setup Error</h2>
        <p>NEXT_PUBLIC_SUPABASE_URL: {url || 'MISSING'}</p>
        <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {key ? 'LOADED' : 'MISSING'}</p>
        <p><a href="https://supabase.com/dashboard/project/_/settings/api" className="underline">Get keys here</a></p>
      </div>
    );
  }

  const [supabase] = useState(() => 
    createBrowserClient(url, key)
  );
  
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, session }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
};