import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { api, supabase } from '../../utils/api';
import type { User as APIUser } from '../../utils/api';
import { monitor, trackApiCall, trackAction } from '../../utils/monitoring';
import { useErrorHandler } from './usePerformanceMonitor';

interface UseAuthCallbacks {
  /** A confirmed session exists for this user (initial load or auth change). */
  onUserSession: (userId: string) => void;
  /** The full user profile finished loading after sign-in. */
  onProfileLoaded: () => void;
  /** A fresh sign-in just completed (not a restored session). */
  onSignedIn: () => void;
  /** There is no session - logged out, or none found on initial load. */
  onSignedOut: () => void;
}

function basicUserFromSession(sessionUser: { id: string; email?: string; user_metadata?: any }): APIUser {
  return {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: sessionUser.user_metadata?.name || sessionUser.email || 'User',
    role: 'user',
  };
}

/**
 * Owns the current user and the Supabase auth session lifecycle. Deliberately
 * knows nothing about map state or favorites/want-to-go lists - those live
 * in App.tsx, which reacts to auth events via the callbacks below instead of
 * this hook reaching into unrelated state.
 */
export function useAuth(callbacks: UseAuthCallbacks) {
  const [user, setUser] = useState<APIUser | null>(null);
  const { catchError } = useErrorHandler('useAuth');

  // Ref so the effect below doesn't need to re-subscribe when callbacks change identity.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    // onAuthStateChange fires an INITIAL_SESSION event on subscribe with
    // whatever session is currently persisted - that's the only session
    // check this hook needs. It used to run alongside a separate explicit
    // getSession() call (checkExistingSession) that set a placeholder user
    // independently; the two were two competing writers to the same state
    // with no ordering guarantee between them, and could disagree about
    // whether a session existed on a given page load - the likely cause of
    // "refresh sometimes logs me out" despite a perfectly valid stored
    // session, since whichever one ran last simply won.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        monitor.setUserId(session.user.id);
        trackAction('user_logged_in', 'App', { userId: session.user.id });

        try {
          const { user: userProfile } = await trackApiCall('getCurrentUser', () => api.getCurrentUser());
          setUser(userProfile);
          callbacksRef.current.onProfileLoaded();
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          catchError(error, { context: 'user_profile_load' });
          setUser(basicUserFromSession(session.user));
        }

        callbacksRef.current.onUserSession(session.user.id);

        if (event === 'SIGNED_IN') {
          toast.success('Welcome to Le Voyageur!');
          callbacksRef.current.onSignedIn();
        }
      } else {
        monitor.setUserId(undefined);
        trackAction('user_logged_out');
        setUser(null);
        callbacksRef.current.onSignedOut();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async () => {
    try {
      await api.signInWithOAuth('google');
      // This redirects the browser, so nothing after this runs.
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
    }
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Logout failed');
      console.error(error);
    } else {
      toast.success('Logged out successfully');
      setUser(null);
    }
  }, []);

  return { user, login, logout };
}
