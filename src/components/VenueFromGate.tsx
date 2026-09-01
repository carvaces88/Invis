import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../data/store';
import { isBetaTesterName } from '../lib/authAccounts';
import { isSupabaseConfigured } from '../lib/supabase';

const WORKSPACE_OWNER_KEY = 'invis.workspaceOwner.v1';

/**
 * When a named beta tester (e.g. Jani) first claims this device workspace,
 * wipe seed inventory so they start empty — only when cloud sync is off.
 * With Supabase, cloud pull is the source of truth across devices.
 */
export function VenueFromGate() {
  const { session } = useAuth();
  const { setSiteName, clearAllInventory } = useInventory();
  const venueApplied = useRef<string | null>(null);
  const ownerApplied = useRef<string | null>(null);

  useEffect(() => {
    const venue = session?.venue?.trim();
    if (!venue || venueApplied.current === venue) return;
    venueApplied.current = venue;
    setSiteName(venue);
  }, [session?.venue, setSiteName]);

  useEffect(() => {
    if (!session?.name) return;
    const ownerKey = session.name.trim().toLowerCase();
    if (!ownerKey || ownerApplied.current === ownerKey) return;

    let cancelled = false;
    (async () => {
      try {
        const prev = await AsyncStorage.getItem(WORKSPACE_OWNER_KEY);
        if (cancelled) return;

        if (
          isBetaTesterName(session.name) &&
          prev !== ownerKey &&
          !isSupabaseConfigured
        ) {
          clearAllInventory();
          setSiteName('Jani · beta 1');
        }

        if (prev !== ownerKey) {
          await AsyncStorage.setItem(WORKSPACE_OWNER_KEY, ownerKey);
        }
        if (!cancelled) ownerApplied.current = ownerKey;
      } catch {
        if (!cancelled) ownerApplied.current = ownerKey;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.name, clearAllInventory, setSiteName]);

  return null;
}
