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
    // check this hook needs elsewhere in the app.
    //
    // It can also fire more than once in quick succession on a single page
    // load: confirmed via diagnostic logging that a plain reload sometimes
    // gets INITIAL_SESSION followed shortly after by a spurious SIGNED_IN
    // for the *same* session - the client broadcasts auth events across
    // every tab sharing this storage key (supabase-js uses a
    // BroadcastChannel for this), so a stale tab left open from earlier
    // testing can trigger a second firing here with no new login involved.
    //
    // Each firing independently awaits its own getCurrentUser() call before
    // calling setUser(). With no ordering guarantee between two overlapping
    // firings, whichever one's fetch happened to resolve last would win -
    // including a slower *older* firing overwriting a newer one's correct
    // result, or racing into a state where the session ends up looking
    // logged out despite a perfectly valid stored session. generation
    // guards against exactly that: only the most recently started firing's
    // result is ever applied.
    let generation = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const thisGeneration = ++generation;
      const isStale = () => thisGeneration !== generation;

      // GoTrue holds an internal lock (navigator.locks, named after the
      // storage key) for the duration of this callback. getCurrentUser()
      // calls fetchWithAuth(), which calls supabase.auth.getSession() -
      // another method that needs that same lock. Calling it synchronously
      // from in here deadlocks: the nested getSession() waits forever for a
      // lock this callback is still holding, and since the lock is held
      // per-storageKey (not per-call), every other pending or future call on
      // this client - in any tab - hangs right along with it. Confirmed via
      // navigator.locks.query(): a fresh tab, with no other tabs open, got
      // stuck the same way on every load. Deferring with setTimeout(0) lets
      // this callback return and the lock release before anything in here
      // touches supabase.auth again, per Supabase's own guidance:
      // https://github.com/supabase/auth-js/issues/762
      setTimeout(async () => {
        if (session?.user) {
          monitor.setUserId(session.user.id);
          trackAction('user_logged_in', 'App', { userId: session.user.id });

          try {
            const { user: userProfile } = await trackApiCall('getCurrentUser', () => api.getCurrentUser());
            if (isStale()) return;
            setUser(userProfile);
            callbacksRef.current.onProfileLoaded();
          } catch (error) {
            if (isStale()) return;
            console.error('Failed to fetch user profile:', error);
            catchError(error, { context: 'user_profile_load' });
            setUser(basicUserFromSession(session.user));
          }

          if (isStale()) return;
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
      }, 0);
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
