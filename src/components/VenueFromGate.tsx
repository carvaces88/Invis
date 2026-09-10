import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import {
  isLonkkaVenue,
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

function resetLonkkaEmpty(
  resetWorkspaceLayout: (args: {
    siteName: string;
    places: typeof LONKKA_SEED_PLACES;
  }) => void,
) {
  resetWorkspaceLayout({
    siteName: LONKKA_SITE_NAME,
    places: LONKKA_SEED_PLACES,
  });
}

/**
 * First claim on this device:
 * - Named beta (joonas/jani): seeded or cleared layouts
 * - Ravintola Lonkka (any new / first-claim tester): always empty fridge+freezer
 * - Other new testers (isNew + email): empty normal inventory + empty Mini Invis
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
    // Bypass / Lonkka apply site+places together in the owner effect.
    if (isBetaTesterName(session?.name ?? '')) return;
    if (isLonkkaVenue(venue)) return;
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
        const lonkka =
          isLonkkaVenue(session.venue) ||
          (beta &&
            normalizeGateName(session.name).toLowerCase() === 'joonas');

        if (firstClaim) {
          // New owner on this device — force a fresh cloud pull next.
          await AsyncStorage.removeItem(WORKSPACE_SYNC_AT_KEY);

          if (beta) {
            const key = normalizeGateName(session.name).toLowerCase();
            if (key === 'joonas') {
              // Every new claim of joonas / Lonkka starts empty.
              resetLonkkaEmpty(resetWorkspaceLayout);
              await markSimpCountEmptyStart();
            } else if (!isSupabaseConfigured) {
              clearAllInventory();
              setSiteName('Jani · beta 1');
              await clearSimpCountEmptyStart();
            } else {
              await clearSimpCountEmptyStart();
            }
          } else if (lonkka && !bypass) {
            // Any new person entering Ravintola Lonkka → empty fridge + freezer.
            resetLonkkaEmpty(resetWorkspaceLayout);
            await markSimpCountEmptyStart();
          } else if (isNewTester) {
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
