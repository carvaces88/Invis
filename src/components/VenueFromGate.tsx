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

const WORKSPACE_OWNER_KEY = 'invis.workspaceOwner.v1';

/**
 * When a named beta tester first claims this device workspace, apply their
 * venue layout (site + places) and wipe seed inventory.
 * With Supabase, cloud pull remains source of truth after the first push.
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

        if (isBetaTesterName(session.name) && prev !== ownerKey) {
          const key = normalizeGateName(session.name).toLowerCase();
          if (key === 'joonas') {
            // Offline / no cloud: seed Ravintola Lonkka (1 fridge + 1 freezer).
            // With Supabase, pull the pre-seeded joonas@invis.app snapshot instead
            // so phone/web stay in sync and Places edits are not wiped.
            if (!isSupabaseConfigured) {
              resetWorkspaceLayout({
                siteName: LONKKA_SITE_NAME,
                places: LONKKA_SEED_PLACES,
              });
            }
          } else if (!isSupabaseConfigured) {
            // Jani-style offline first claim — empty Kamppi-style layout.
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
