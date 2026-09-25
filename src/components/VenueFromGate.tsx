import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import {
  FAIR_BUFFET_PRODUCTS,
  FAIR_BUFFET_SEED_PLACES,
  FAIR_BUFFET_SITE_NAME,
  FAIR_BUFFET_STOCK,
  isFairBuffetVenue,
} from '../data/seedFairBuffet';
import {
  DAILY_DOSE_SEED_PLACES,
  DAILY_DOSE_SITE_NAME,
  isDailyDoseVenue,
  isLonkkaVenue,
  JANI_SITE_NAME,
  LONKKA_SEED_PLACES,
  LONKKA_SITE_NAME,
  SEED_PLACES,
} from '../data/seedPlaces';
import { useInventory } from '../data/store';
import {
  defaultVenueForName,
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

function resetDailyDoseEmpty(
  resetWorkspaceLayout: (args: {
    siteName: string;
    places: typeof DAILY_DOSE_SEED_PLACES;
  }) => void,
) {
  resetWorkspaceLayout({
    siteName: DAILY_DOSE_SITE_NAME,
    places: DAILY_DOSE_SEED_PLACES,
  });
}

function resetJaniKamppi(
  resetWorkspaceLayout: (args: {
    siteName: string;
    places: typeof SEED_PLACES;
  }) => void,
) {
  resetWorkspaceLayout({
    siteName: JANI_SITE_NAME,
    places: SEED_PLACES,
  });
}

function seedFairBuffet(
  seedWorkspaceSample: (args: {
    siteName: string;
    places: typeof FAIR_BUFFET_SEED_PLACES;
    products: typeof FAIR_BUFFET_PRODUCTS;
    stock: typeof FAIR_BUFFET_STOCK;
  }) => void,
) {
  seedWorkspaceSample({
    siteName: FAIR_BUFFET_SITE_NAME,
    places: FAIR_BUFFET_SEED_PLACES,
    products: FAIR_BUFFET_PRODUCTS,
    stock: FAIR_BUFFET_STOCK,
  });
}

/**
 * First claim on this device + always-on venue respect:
 * - joonas → Ravintola Lonkka (empty fridge + freezer)
 * - jani → Kamppi · Kulturikasarmi (Kamppi-style places)
 * - patricio → Daily Dose (empty fridge + freezer)
 * - heidi → Fair Buffet · Messukeskus (6 places + sample stock, Pro)
 * - Other new testers (isNew + email): empty normal inventory + empty Mini Invis
 */
export function VenueFromGate() {
  const { session } = useAuth();
  const {
    setSiteName,
    clearAllInventory,
    resetWorkspaceLayout,
    seedWorkspaceSample,
    siteName,
  } = useInventory();
  const venueApplied = useRef<string | null>(null);
  const ownerApplied = useRef<string | null>(null);

  // Always keep beta users on their restaurant label (even after cloud pull).
  useEffect(() => {
    if (!session?.name) return;
    const canonical = defaultVenueForName(session.name);
    if (!canonical) return;
    if (siteName?.trim() === canonical) return;
    setSiteName(canonical);
  }, [session?.name, siteName, setSiteName]);

  useEffect(() => {
    const venue = session?.venue?.trim();
    if (!venue || venueApplied.current === venue) return;
    // Bypass / named betas apply site+places together in the owner effect.
    if (isBetaTesterName(session?.name ?? '')) return;
    if (
      isLonkkaVenue(venue) ||
      isDailyDoseVenue(venue) ||
      isFairBuffetVenue(venue)
    ) {
      return;
    }
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
        const key = normalizeGateName(session.name).toLowerCase();
        const lonkka =
          isLonkkaVenue(session.venue) || key === 'joonas';
        const dailyDose =
          isDailyDoseVenue(session.venue) || key === 'patricio';
        const fairBuffet =
          isFairBuffetVenue(session.venue) || key === 'heidi';

        if (firstClaim) {
          // New owner on this device — force a fresh cloud pull next.
          await AsyncStorage.removeItem(WORKSPACE_SYNC_AT_KEY);

          if (beta) {
            if (key === 'heidi' || fairBuffet) {
              seedFairBuffet(seedWorkspaceSample);
              await clearSimpCountEmptyStart();
            } else if (key === 'joonas' || lonkka) {
              resetLonkkaEmpty(resetWorkspaceLayout);
              await markSimpCountEmptyStart();
            } else if (key === 'patricio' || dailyDose) {
              resetDailyDoseEmpty(resetWorkspaceLayout);
              await markSimpCountEmptyStart();
            } else if (key === 'jani') {
              resetJaniKamppi(resetWorkspaceLayout);
              await clearSimpCountEmptyStart();
            } else if (!isSupabaseConfigured) {
              clearAllInventory();
              const venue = defaultVenueForName(session.name);
              if (venue) setSiteName(venue);
              await clearSimpCountEmptyStart();
            } else {
              const venue = defaultVenueForName(session.name);
              if (venue) setSiteName(venue);
              await clearSimpCountEmptyStart();
            }
          } else if (fairBuffet && !bypass) {
            seedFairBuffet(seedWorkspaceSample);
            await clearSimpCountEmptyStart();
          } else if (lonkka && !bypass) {
            resetLonkkaEmpty(resetWorkspaceLayout);
            await markSimpCountEmptyStart();
          } else if (dailyDose && !bypass) {
            resetDailyDoseEmpty(resetWorkspaceLayout);
            await markSimpCountEmptyStart();
          } else if (isNewTester) {
            clearAllInventory();
            const venue = session.venue?.trim();
            if (venue) setSiteName(venue);
            await markSimpCountEmptyStart();
          } else {
            await clearSimpCountEmptyStart();
          }
        } else {
          // Returning user — still correct the site label if it drifted.
          const venue = defaultVenueForName(session.name);
          if (venue) setSiteName(venue);
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
    seedWorkspaceSample,
    setSiteName,
  ]);

  return null;
}
