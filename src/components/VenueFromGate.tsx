import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import {
  LONKKA_SEED_PLACES,
  LONKKA_SITE_NAME,
} from '../data/seedPlaces';
import { useInventory } from '../data/store';
import { isBetaTesterName, normalizeGateName } from '../lib/authAccounts';
import { isSupabaseConfigured } from '../lib/supabase';
import { WORKSPACE_SYNC_AT_KEY } from '../lib/workspaceSnapshot';

const WORKSPACE_OWNER_KEY = 'invis.workspaceOwner.v1';

/**
 * When a named beta tester first claims this device workspace, apply their
 * venue layout (site + places) and wipe seed inventory.
 * With Supabase, cloud pull can refine afterward; local seed keeps UI correct
 * if pull is slow or fails.
 */
export function VenueFromGate() {
  const { session } = useAuth();
  const { setSiteName, clearAllInventory, resetWorkspaceLayout } =
    useInventory();
  const venueApplied = useRef<string | null>(null);
  const ownerApplied = useRef<string | null>(null);

  useEffect(() => {
    const venue = session?.venue?.trim();
    if (!venue || venueApplied.current === venue) return;
    // Bypass users (e.g. joonas) apply site+places together in the owner effect.
    if (isBetaTesterName(session?.name ?? '')) return;
    venueApplied.current = venue;
    setSiteName(venue);
  }, [session?.venue, session?.name, setSiteName]);

  useEffect(() => {
    if (!session?.name) return;
    const ownerKey = session.name.trim().toLowerCase();
    if (!ownerKey || ownerApplied.current === ownerKey) return;

    let cancelled = false;
    (async () => {
      try {
        const prev = await AsyncStorage.getItem(WORKSPACE_OWNER_KEY);
        if (cancelled) return;

        if (isBetaTesterName(session.name) && prev !== ownerKey) {
          const key = normalizeGateName(session.name).toLowerCase();
          // New owner on this device — force a fresh cloud pull next.
          await AsyncStorage.removeItem(WORKSPACE_SYNC_AT_KEY);
          if (key === 'joonas') {
            // Immediate Lonkka layout (1 fridge + 1 freezer). Cloud may refine.
            resetWorkspaceLayout({
              siteName: LONKKA_SITE_NAME,
              places: LONKKA_SEED_PLACES,
            });
          } else if (!isSupabaseConfigured) {
            clearAllInventory();
            setSiteName('Jani · beta 1');
          }
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
  }, [
    session?.name,
    clearAllInventory,
    resetWorkspaceLayout,
    setSiteName,
  ]);

  return null;
}
