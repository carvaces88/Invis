import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../data/store';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchRemoteWorkspaceSnapshot,
  pushRemoteWorkspaceSnapshot,
} from '../lib/workspaceSync';
import {
  hasMeaningfulWorkspaceData,
  WORKSPACE_SYNC_AT_KEY,
} from '../lib/workspaceSnapshot';

const PUSH_DEBOUNCE_MS = 2500;

/**
 * Keeps inventory workspace in Supabase so the same gate email sees identical
 * data on phone and web. Photo file URIs stay device-local; metadata syncs.
 */
export function WorkspaceCloudSync() {
  const { session } = useAuth();
  const {
    storeHydrated,
    applyWorkspaceSnapshot,
    getWorkspaceSnapshot,
    session: inventorySession,
    products,
    priorStockList,
    inventoryPhotos,
    siteName,
  } = useInventory();

  const syncReadyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const email = session?.email?.trim().toLowerCase() ?? '';

  useEffect(() => {
    if (!email || !storeHydrated || !isSupabaseConfigured) return;

    let cancelled = false;
    syncReadyRef.current = false;

    (async () => {
      try {
        const localSyncAt = await AsyncStorage.getItem(WORKSPACE_SYNC_AT_KEY);
        const remote = await fetchRemoteWorkspaceSnapshot(email);
        if (cancelled) return;

        const local = getWorkspaceSnapshot();

        if (!remote) {
          if (hasMeaningfulWorkspaceData(local)) {
            const pushedAt = await pushRemoteWorkspaceSnapshot({
              email,
              venue: session?.venue ?? null,
              payload: local,
            });
            if (pushedAt) {
              await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, pushedAt);
            }
          }
        } else if (!localSyncAt || remote.updatedAt > localSyncAt) {
          applyingRemoteRef.current = true;
          applyWorkspaceSnapshot(remote.payload);
          await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, remote.updatedAt);
          applyingRemoteRef.current = false;
        } else if (localSyncAt > remote.updatedAt) {
          const pushedAt = await pushRemoteWorkspaceSnapshot({
            email,
            venue: session?.venue ?? null,
            payload: local,
          });
          if (pushedAt) {
            await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, pushedAt);
          }
        }
      } catch {
        applyingRemoteRef.current = false;
      } finally {
        if (!cancelled) syncReadyRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    email,
    storeHydrated,
    applyWorkspaceSnapshot,
    getWorkspaceSnapshot,
    session?.venue,
  ]);

  useEffect(() => {
    if (!email || !storeHydrated || !isSupabaseConfigured) return;
    if (!syncReadyRef.current || applyingRemoteRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void (async () => {
        const payload = getWorkspaceSnapshot();
        const pushedAt = await pushRemoteWorkspaceSnapshot({
          email,
          venue: session?.venue ?? null,
          payload,
        });
        if (pushedAt) {
          await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, pushedAt);
        }
      })();
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [
    email,
    storeHydrated,
    getWorkspaceSnapshot,
    session?.venue,
    inventorySession,
    products,
    priorStockList,
    inventoryPhotos,
    siteName,
  ]);

  return null;
}
