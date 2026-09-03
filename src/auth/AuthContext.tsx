import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  displayKitchenName,
  isAdminName,
  isBetaTesterName,
  isGateBypassName,
  isInvestorName,
  isKitchenName,
  isMasterName,
  isValidEmail,
  normalizeGateName,
  resolveAuthAccount,
  resolveSyncEmail,
} from '../lib/authAccounts';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const SESSION_KEY = 'invis.gateSession.v1';

export type GateSession = {
  name: string;
  venue: string | null;
  email: string | null;
  kind: 'kitchen' | 'tester' | 'investor';
  enteredAt: string;
};

type EnterInput = {
  name: string;
  venue?: string;
  email?: string;
};

type AuthContextValue = {
  ready: boolean;
  session: GateSession | null;
  profile: {
    username: string;
    displayName: string;
    email: string | null;
    venue: string | null;
    role: 'admin' | 'guest';
  } | null;
  isAdmin: boolean;
  isMaster: boolean;
  /** Investor walkthrough login */
  isInvestor: boolean;
  /** Pro features (video walkthrough, etc.) — unlocked for investors */
  isPro: boolean;
  configured: boolean;
  justSignedIn: boolean;
  clearJustSignedIn: () => void;
  enter: (
    input: EnterInput,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toProfile(session: GateSession) {
  const known =
    isKitchenName(session.name) ||
    isBetaTesterName(session.name) ||
    isInvestorName(session.name);
  return {
    username: session.name.toLowerCase(),
    displayName: known ? displayKitchenName(session.name) : session.name,
    email: session.email,
    venue: session.venue,
    role: (isAdminName(session.name) ? 'admin' : 'guest') as 'admin' | 'guest',
  };
}

async function logEntry(session: GateSession) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('app_entries').insert({
      name: session.name,
      venue: session.venue,
      email: session.email,
      kind: session.kind,
    });
  } catch {
    /* best-effort */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<GateSession | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as GateSession;
          if (parsed?.name) {
            const patchedEmail = resolveSyncEmail(parsed);
            if (patchedEmail && parsed.email !== patchedEmail) {
              parsed.email = patchedEmail;
              await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
            }
            setSession(parsed);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = useCallback(async (input: EnterInput) => {
    const name = normalizeGateName(input.name);
    if (!name) {
      return { ok: false as const, message: 'Enter your name.' };
    }

    const kitchen = isKitchenName(name);
    const beta = isBetaTesterName(name);
    const investor = isInvestorName(name);
    const bypass = isGateBypassName(name);
    const venue = normalizeGateName(input.venue ?? '') || null;
    const emailRaw = (input.email ?? '').trim();
    const email = emailRaw || null;

    if (!bypass) {
      if (!email) {
        return {
          ok: false as const,
          message: 'Add your email so we can follow up — then tap Continue.',
        };
      }
      if (!isValidEmail(email)) {
        return {
          ok: false as const,
          message: 'That email does not look valid.',
        };
      }
    }

    const account = resolveAuthAccount(name);
    const syncEmail = bypass
      ? (account?.email?.trim().toLowerCase() ?? null)
      : email;

    const defaultVenue =
      beta && normalizeGateName(name).toLowerCase() === 'joonas'
        ? 'Ravintola Lonkka'
        : null;

    const next: GateSession = {
      name:
        kitchen || beta || investor ? displayKitchenName(name) : name,
      venue: bypass ? defaultVenue : venue,
      email: syncEmail,
      kind: kitchen ? 'kitchen' : investor ? 'investor' : 'tester',
      enteredAt: new Date().toISOString(),
    };

    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      // Still allow entry if storage is blocked (private mode / web quirks).
    }
    setSession(next);
    setJustSignedIn(true);
    void logEntry(next);
    return { ok: true as const };
  }, []);

  const clearJustSignedIn = useCallback(() => setJustSignedIn(false), []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
    setJustSignedIn(false);
  }, []);

  const profile = session ? toProfile(session) : null;

  const isInvestor = session ? isInvestorName(session.name) : false;

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      isMaster: session ? isMasterName(session.name) : false,
      isInvestor,
      isPro: isInvestor,
      configured: true,
      justSignedIn,
      clearJustSignedIn,
      enter,
      signOut,
    }),
    [
      ready,
      session,
      profile,
      isInvestor,
      justSignedIn,
      clearJustSignedIn,
      enter,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
