// src/components/AuthSection.tsx
'use client';

import { useSupabase } from '@/components/SupabaseProvider';
import LoginButton from '@/components/LoginButton';
import { MapPin } from 'lucide-react';

export default function AuthSection() {
  const { session } = useSupabase();

  return (
    <>
      {!session ? (
        <div className="flex flex-col items-center gap-8">
          <LoginButton />
          <p className="text-sm text-gray-600">
            Sign in to explore premium city guides
          </p>
        </div>
      ) : (
        <div className="text-center animate-fade-in">
          <p className="text-2xl mb-6">
            Welcome back, {session.user.email}!
          </p>
          <div className="flex items-center gap-3 text-amber-800 bg-amber-50 px-6 py-4 rounded-xl shadow-sm">
            <MapPin size={32} />
            <p className="text-xl font-medium">
              Map with LV ratings coming next...
            </p>
          </div>
          <p className="mt-8 text-gray-600 max-w-md">
            We’ll add your test city, custom LV markers, and Google Places crowdsourced ratings in the next step.
          </p>
        </div>
      )}
    </>
  );
}