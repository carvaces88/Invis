import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { resolveAuthAccount } from '../lib/authAccounts';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ProfileRole = 'admin' | 'guest';

export type AppProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: ProfileRole;
  lastSeenAt: string | null;
};

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  isAdmin: boolean;
  configured: boolean;
  /** True after an explicit username/password sign-in (not restored session). */
  justSignedIn: boolean;
  clearJustSignedIn: () => void;
  signIn: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  last_seen_at: string | null;
}): AppProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'guest',
    lastSeenAt: row.last_seen_at,
  };
}

async function fetchProfile(userId: string): Promise<AppProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, email, role, last_seen_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    setProfile(await fetchProfile(uid));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        setProfile(await fetchProfile(data.session.user.id));
      }
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, next) => {
        setSession(next);
        if (next?.user) {
          setProfile(await fetchProfile(next.user.id));
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { ok: false as const, message: 'Supabase is not configured.' };
    }
    const account = resolveAuthAccount(username);
    if (!account) {
      return {
        ok: false as const,
        message: 'Unknown username. Use Cesar, Elena, Ivan, or Guest.',
      };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (error) {
      return { ok: false as const, message: error.message };
    }
    // Log visit for the admin deck (best-effort)
    try {
      await supabase.rpc('record_sign_in');
    } catch {
      /* ignore */
    }
    setJustSignedIn(true);
    await refreshProfile();
    return { ok: true as const };
  }, [refreshProfile]);

  const clearJustSignedIn = useCallback(() => setJustSignedIn(false), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setJustSignedIn(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === 'admin',
      configured: isSupabaseConfigured,
      justSignedIn,
      clearJustSignedIn,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      ready,
      session,
      profile,
      justSignedIn,
      clearJustSignedIn,
      signIn,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
