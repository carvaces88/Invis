import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from '../supabase';
import { setApiSessionSnapshot } from './sessionBridge';

const ACTIVE_VENUE_KEY = 'invis.activeVenueId';
const GUEST_MODE_KEY = 'invis.guestMode';

export type VenueRole = 'owner' | 'staff';

export type VenueMembership = {
  venueId: string;
  name: string;
  role: VenueRole;
};

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  /**
   * Intentional local demo (Continue as guest).
   * Distinct from “no session” so AuthScreen can still be shown.
   */
  guestMode: boolean;
  /** True when inventory should stay local-only (no cloud sync / no API auth). */
  isLocalOnly: boolean;
  venues: VenueMembership[];
  activeVenueId: string | null;
  setActiveVenueId: (id: string | null) => void;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (args: {
    email: string;
    password: string;
    venueName: string;
  }) => Promise<{ error?: string; venueId?: string }>;
  signOut: () => Promise<void>;
  refreshVenues: () => Promise<void>;
  createVenue: (name: string) => Promise<{ error?: string; venueId?: string }>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  /** Prefer auth gate when cloud is configured; guest is an explicit choice. */
  const [guestMode, setGuestMode] = useState(!configured);
  const [venues, setVenues] = useState<VenueMembership[]>([]);
  const [activeVenueId, setActiveVenueIdState] = useState<string | null>(null);

  const refreshVenues = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setVenues([]);
      return;
    }
    const { data: memberships, error } = await sb
      .from('venue_members')
      .select('venue_id, role, venues(id, name)');
    if (error || !memberships) {
      setVenues([]);
      return;
    }
    const mapped: VenueMembership[] = memberships
      .map((row) => {
        const v = row.venues as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        const venue = Array.isArray(v) ? v[0] : v;
        if (!venue?.id) return null;
        return {
          venueId: venue.id,
          name: venue.name,
          role: (row.role === 'owner' ? 'owner' : 'staff') as VenueRole,
        };
      })
      .filter(Boolean) as VenueMembership[];
    setVenues(mapped);
    if (mapped.length) {
      const stored = await AsyncStorage.getItem(ACTIVE_VENUE_KEY);
      const pick =
        (stored && mapped.some((m) => m.venueId === stored) && stored) ||
        mapped[0]!.venueId;
      setActiveVenueIdState(pick);
      await AsyncStorage.setItem(ACTIVE_VENUE_KEY, pick);
    } else {
      setActiveVenueIdState(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const guestFlag = await AsyncStorage.getItem(GUEST_MODE_KEY);
      if (!configured) {
        if (!cancelled) {
          setGuestMode(true);
          setReady(true);
        }
        return;
      }
      // Explicit guest opt-in only
      setGuestMode(guestFlag === '1');
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) setReady(true);
        return;
      }
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session) {
        setGuestMode(false);
        await AsyncStorage.setItem(GUEST_MODE_KEY, '0');
        await refreshVenues();
      }
      if (!cancelled) setReady(true);
    })();

    if (!configured) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        setGuestMode(false);
        void AsyncStorage.setItem(GUEST_MODE_KEY, '0');
        void refreshVenues();
      } else {
        setVenues([]);
        setActiveVenueIdState(null);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured, refreshVenues]);

  const setActiveVenueId = useCallback((id: string | null) => {
    setActiveVenueIdState(id);
    if (id) {
      void AsyncStorage.setItem(ACTIVE_VENUE_KEY, id);
    } else {
      void AsyncStorage.removeItem(ACTIVE_VENUE_KEY);
    }
  }, []);

  const enterGuestMode = useCallback(async () => {
    setGuestMode(true);
    await AsyncStorage.setItem(GUEST_MODE_KEY, '1');
  }, []);

  const exitGuestMode = useCallback(async () => {
    setGuestMode(false);
    await AsyncStorage.setItem(GUEST_MODE_KEY, '0');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const sb = getSupabase();
      if (!sb) return { error: 'Cloud is not configured' };
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { error: error.message };
      setGuestMode(false);
      await AsyncStorage.setItem(GUEST_MODE_KEY, '0');
      await refreshVenues();
      return {};
    },
    [refreshVenues],
  );

  const createVenue = useCallback(
    async (name: string) => {
      const sb = getSupabase();
      if (!sb) return { error: 'Cloud is not configured' };
      const { data, error } = await sb.rpc('create_venue_with_owner', {
        p_name: name.trim(),
      });
      if (error) return { error: error.message };
      const venueId = String(data);
      await refreshVenues();
      setActiveVenueId(venueId);
      return { venueId };
    },
    [refreshVenues, setActiveVenueId],
  );

  const signUp = useCallback(
    async (args: { email: string; password: string; venueName: string }) => {
      const sb = getSupabase();
      if (!sb) return { error: 'Cloud is not configured' };
      const { data, error } = await sb.auth.signUp({
        email: args.email.trim(),
        password: args.password,
      });
      if (error) return { error: error.message };
      if (!data.session) {
        return {
          error:
            'Check your email to confirm the account, then sign in to create your venue.',
        };
      }
      setGuestMode(false);
      await AsyncStorage.setItem(GUEST_MODE_KEY, '0');
      const created = await createVenue(args.venueName);
      if (created.error) return { error: created.error };
      return { venueId: created.venueId };
    },
    [createVenue],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setVenues([]);
    setActiveVenueIdState(null);
    setGuestMode(true);
    await AsyncStorage.setItem(GUEST_MODE_KEY, '1');
    await AsyncStorage.removeItem(ACTIVE_VENUE_KEY);
  }, []);

  const getAccessToken = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    setApiSessionSnapshot({
      accessToken: session?.access_token ?? null,
      venueId: activeVenueId,
    });
  }, [session, activeVenueId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      session,
      user: session?.user ?? null,
      guestMode,
      isLocalOnly: !configured || guestMode || !session,
      venues,
      activeVenueId,
      setActiveVenueId,
      enterGuestMode,
      exitGuestMode,
      signIn,
      signUp,
      signOut,
      refreshVenues,
      createVenue,
      getAccessToken,
    }),
    [
      configured,
      ready,
      session,
      guestMode,
      venues,
      activeVenueId,
      setActiveVenueId,
      enterGuestMode,
      exitGuestMode,
      signIn,
      signUp,
      signOut,
      refreshVenues,
      createVenue,
      getAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
