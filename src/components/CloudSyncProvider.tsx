import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { useInventory } from '../data/store';
import { resolveSyncEmail } from '../lib/authAccounts';
import { isSupabaseConfigured } from '../lib/supabase';
import { uploadInventoryPhotosForSync } from '../lib/workspacePhotoStorage';
import {
  fetchRemoteWorkspaceSnapshot,
  pushRemoteWorkspaceSnapshot,
} from '../lib/workspaceSync';
import {
  hasMeaningfulWorkspaceData,
  WORKSPACE_SYNC_AT_KEY,
  type WorkspaceSnapshotPayload,
} from '../lib/workspaceSnapshot';

const PUSH_DEBOUNCE_MS = 2500;

export type CloudSyncStatus =
  | 'offline'
  | 'idle'
  | 'pulling'
  | 'pushing'
  | 'synced'
  | 'error';

type CloudSyncContextValue = {
  status: CloudSyncStatus;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
  configured: boolean;
  email: string | null;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

async function payloadWithCloudPhotos(
  payload: WorkspaceSnapshotPayload,
  email: string,
): Promise<WorkspaceSnapshotPayload> {
  const uploaded = await uploadInventoryPhotosForSync(
    payload.inventoryPhotos,
    email,
  );
  if (uploaded.size === 0) return payload;
  return {
    ...payload,
    inventoryPhotos: payload.inventoryPhotos.map((p) => ({
      ...p,
      uri: uploaded.get(p.id) ?? p.uri,
    })),
  };
}

/**
 * Keeps inventory workspace in Supabase so the same gate email sees identical
 * data on phone and web. Photos upload to Supabase Storage; metadata in snapshot.
 */
export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
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
    places,
  } = useInventory();

  const [status, setStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured ? 'idle' : 'offline',
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState(false);

  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const email = session ? resolveSyncEmail(session) : '';

  const pushSnapshot = useCallback(
    async (opts?: { refreshLocalPhotos?: boolean }) => {
      if (!email || !isSupabaseConfigured) return null;
      setStatus('pushing');
      try {
        let payload = getWorkspaceSnapshot();
        payload = await payloadWithCloudPhotos(payload, email);
        if (opts?.refreshLocalPhotos) {
          applyWorkspaceSnapshot(payload);
        }
        const pushedAt = await pushRemoteWorkspaceSnapshot({
          email,
          venue: session?.venue ?? null,
          payload,
        });
        if (pushedAt) {
          await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, pushedAt);
          setLastSyncedAt(pushedAt);
          setStatus('synced');
        } else {
          setStatus('error');
        }
        return pushedAt;
      } catch {
        setStatus('error');
        return null;
      }
    },
    [email, getWorkspaceSnapshot, session?.venue, applyWorkspaceSnapshot],
  );

  const pullAndMerge = useCallback(async () => {
    if (!email || !isSupabaseConfigured || !storeHydrated) return;
    setStatus('pulling');
    try {
      const localSyncAt = await AsyncStorage.getItem(WORKSPACE_SYNC_AT_KEY);
      const remote = await fetchRemoteWorkspaceSnapshot(email);
      const local = getWorkspaceSnapshot();

      if (!remote) {
        if (hasMeaningfulWorkspaceData(local)) {
          await pushSnapshot({ refreshLocalPhotos: true });
        } else {
          setStatus('synced');
        }
        return;
      }

      if (!localSyncAt || remote.updatedAt > localSyncAt) {
        applyingRemoteRef.current = true;
        applyWorkspaceSnapshot(remote.payload);
        await AsyncStorage.setItem(WORKSPACE_SYNC_AT_KEY, remote.updatedAt);
        setLastSyncedAt(remote.updatedAt);
        applyingRemoteRef.current = false;
        setStatus('synced');
      } else if (localSyncAt > remote.updatedAt) {
        await pushSnapshot({ refreshLocalPhotos: true });
      } else {
        setLastSyncedAt(localSyncAt);
        setStatus('synced');
      }
    } catch {
      applyingRemoteRef.current = false;
      setStatus('error');
    } finally {
      setSyncReady(true);
    }
  }, [
    email,
    storeHydrated,
    getWorkspaceSnapshot,
    applyWorkspaceSnapshot,
    pushSnapshot,
  ]);

  useEffect(() => {
    if (!email || !storeHydrated) {
      setSyncReady(false);
      if (!isSupabaseConfigured) setStatus('offline');
      return;
    }
    setSyncReady(false);
    void pullAndMerge();
  }, [email, storeHydrated, pullAndMerge]);

  useEffect(() => {
    if (!email || !storeHydrated || !isSupabaseConfigured) return;
    if (!syncReady || applyingRemoteRef.current) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void pushSnapshot();
    }, PUSH_DEBOUNCE_MS);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [
    email,
    storeHydrated,
    syncReady,
    pushSnapshot,
    inventorySession,
    products,
    priorStockList,
    inventoryPhotos,
    siteName,
    places,
  ]);

  const syncNow = useCallback(async () => {
    await pullAndMerge();
    await pushSnapshot({ refreshLocalPhotos: true });
  }, [pullAndMerge, pushSnapshot]);

  const value = useMemo<CloudSyncContextValue>(
    () => ({
      status,
      lastSyncedAt,
      syncNow,
      configured: isSupabaseConfigured,
      email: email || null,
    }),
    [status, lastSyncedAt, syncNow, email],
  );

  return (
    <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>
  );
}

export function useCloudSync() {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) {
    throw new Error('useCloudSync must be used within CloudSyncProvider');
  }
  return ctx;
}
