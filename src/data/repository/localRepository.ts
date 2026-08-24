/**
 * Local AsyncStorage persistence — guest / offline cache.
 * Cloud sync layers on top via SyncedRepository; screens never call this directly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  InventoryActivityEntry,
  InventorySession,
  Place,
  Product,
  UnitCode,
} from '../types';

export const STORAGE_KEYS = {
  customProducts: 'invis.customProducts',
  aliasExtras: 'invis.productAliasExtras',
  packExtras: 'invis.productPackExtras',
  lastUnit: 'invis.lastRecordUnit',
  activity: 'invis.recentActivity',
  session: 'invis.inventorySession',
  inventoryCleared: 'invis.inventoryCleared',
  places: 'invis.places',
  siteName: 'invis.siteName',
  activePlaceId: 'invis.activePlaceId',
  syncQueue: 'invis.syncQueue',
} as const;

export type AliasExtras = Record<string, string[]>;
export type PackExtras = Record<
  string,
  { unitsPerPack: number; packBaseUnit: UnitCode }
>;

export type LocalSnapshot = {
  customProducts: Product[];
  aliasExtras: AliasExtras;
  packExtras: PackExtras;
  lastRecordUnit: UnitCode | null;
  recentActivity: InventoryActivityEntry[];
  session: InventorySession | null;
  inventoryCleared: boolean;
  places: Place[] | null;
  siteName: string | null;
  activePlaceId: string | null;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const [
    customsRaw,
    extrasRaw,
    packRaw,
    unitRaw,
    activityRaw,
    sessionRaw,
    clearedRaw,
    placesRaw,
    siteRaw,
    activeRaw,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.customProducts),
    AsyncStorage.getItem(STORAGE_KEYS.aliasExtras),
    AsyncStorage.getItem(STORAGE_KEYS.packExtras),
    AsyncStorage.getItem(STORAGE_KEYS.lastUnit),
    AsyncStorage.getItem(STORAGE_KEYS.activity),
    AsyncStorage.getItem(STORAGE_KEYS.session),
    AsyncStorage.getItem(STORAGE_KEYS.inventoryCleared),
    AsyncStorage.getItem(STORAGE_KEYS.places),
    AsyncStorage.getItem(STORAGE_KEYS.siteName),
    AsyncStorage.getItem(STORAGE_KEYS.activePlaceId),
  ]);

  const customs = safeParse<Product[]>(customsRaw, []);
  const extras = safeParse<AliasExtras>(extrasRaw, {});
  const packs = safeParse<PackExtras>(packRaw, {});
  const activity = safeParse<InventoryActivityEntry[]>(activityRaw, []);
  const session = safeParse<InventorySession | null>(sessionRaw, null);
  const places = safeParse<Place[] | null>(placesRaw, null);

  return {
    customProducts: Array.isArray(customs) ? customs : [],
    aliasExtras: extras && typeof extras === 'object' ? extras : {},
    packExtras: packs && typeof packs === 'object' ? packs : {},
    lastRecordUnit: unitRaw as UnitCode | null,
    recentActivity: Array.isArray(activity) ? activity : [],
    session,
    inventoryCleared: clearedRaw === '1',
    places: Array.isArray(places) ? places : null,
    siteName: siteRaw,
    activePlaceId: activeRaw,
  };
}

export async function saveCustomProducts(products: Product[]) {
  await AsyncStorage.setItem(
    STORAGE_KEYS.customProducts,
    JSON.stringify(products),
  );
}

export async function saveAliasExtras(extras: AliasExtras) {
  await AsyncStorage.setItem(STORAGE_KEYS.aliasExtras, JSON.stringify(extras));
}

export async function savePackExtras(extras: PackExtras) {
  await AsyncStorage.setItem(STORAGE_KEYS.packExtras, JSON.stringify(extras));
}

export async function saveActivity(entries: InventoryActivityEntry[]) {
  await AsyncStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(entries));
}

export async function saveSession(session: InventorySession) {
  await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

export async function savePlaces(places: Place[]) {
  await AsyncStorage.setItem(STORAGE_KEYS.places, JSON.stringify(places));
}

export async function saveSiteName(name: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.siteName, name);
}

export async function saveActivePlaceId(id: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.activePlaceId, id);
}

export async function saveLastUnit(unit: UnitCode) {
  await AsyncStorage.setItem(STORAGE_KEYS.lastUnit, unit);
}

export async function markInventoryCleared() {
  await AsyncStorage.setItem(STORAGE_KEYS.inventoryCleared, '1');
}

export type SyncOp =
  | { kind: 'upsert_place'; venueId: string; place: Place; at: string }
  | {
      kind: 'upsert_product';
      venueId: string;
      product: Product;
      at: string;
    }
  | {
      kind: 'upsert_session';
      venueId: string;
      session: InventorySession;
      at: string;
    }
  | {
      kind: 'upsert_line';
      venueId: string;
      sessionId: string;
      line: import('../types').InventoryLine;
      at: string;
    }
  | {
      kind: 'insert_movement';
      venueId: string;
      movement: import('../types').StockMovement;
      at: string;
    }
  | {
      kind: 'insert_havikki';
      venueId: string;
      entry: import('../types').HavikkiEntry;
      at: string;
    }
  | { kind: 'rename_venue'; venueId: string; name: string; at: string };

export async function loadSyncQueue(): Promise<SyncOp[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.syncQueue);
  const parsed = safeParse<SyncOp[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveSyncQueue(ops: SyncOp[]) {
  await AsyncStorage.setItem(STORAGE_KEYS.syncQueue, JSON.stringify(ops));
}

export async function enqueueSyncOp(op: SyncOp) {
  const q = await loadSyncQueue();
  q.push(op);
  // Cap queue to avoid unbounded growth offline
  await saveSyncQueue(q.slice(-500));
}
