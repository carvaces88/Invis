import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import {
  LONKKA_SEED_PLACES,
  LONKKA_SITE_NAME,
} from '../data/seedPlaces';
import { useInventory } from '../data/store';
import {
  isBetaTesterName,
  isGateBypassName,
  normalizeGateName,
} from '../lib/authAccounts';
import {
  clearSimpCountEmptyStart,
  markSimpCountEmptyStart,
} from '../lib/simpCountNewUser';
import { isSupabaseConfigured } from '../lib/supabase';
import { WORKSPACE_SYNC_AT_KEY } from '../lib/workspaceSnapshot';

const WORKSPACE_OWNER_KEY = 'invis.workspaceOwner.v1';

/**
 * First claim on this device:
 * - Named beta (joonas/jani): seeded or cleared layouts
 * - New testers (isNew + email): empty normal inventory + empty Simple invis
 * Venue label from the gate is applied for non-beta users.
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

        const firstClaim = prev !== ownerKey;
        const bypass = isGateBypassName(session.name);
        const beta = isBetaTesterName(session.name);
        const isNewTester = Boolean(session.isNew) && !bypass;

        if (firstClaim) {
          // New owner on this device — force a fresh cloud pull next.
          await AsyncStorage.removeItem(WORKSPACE_SYNC_AT_KEY);

          if (beta) {
            const key = normalizeGateName(session.name).toLowerCase();
            if (key === 'joonas') {
              resetWorkspaceLayout({
                siteName: LONKKA_SITE_NAME,
                places: LONKKA_SEED_PLACES,
              });
            } else if (!isSupabaseConfigured) {
              clearAllInventory();
              setSiteName('Jani · beta 1');
            }
            await clearSimpCountEmptyStart();
          } else if (isNewTester) {
            // Empty normal Invis + empty Simple invis; keep catalog, wipe counts.
            clearAllInventory();
            const venue = session.venue?.trim();
            if (venue) setSiteName(venue);
            await markSimpCountEmptyStart();
          } else {
            await clearSimpCountEmptyStart();
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
    session?.isNew,
    session?.venue,
    clearAllInventory,
    resetWorkspaceLayout,
    setSiteName,
  ]);

  return null;
}
