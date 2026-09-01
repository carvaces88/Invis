import type {
  InventoryActivityEntry,
  InventoryLine,
  InventoryPeriodSnapshot,
  InventoryPhoto,
  InventorySession,
  Place,
  PriorStockListSnapshot,
  Product,
  UnitCode,
} from '../data/types';

/** AsyncStorage keys mirrored in the cloud workspace payload. */
export const WORKSPACE_STORAGE_KEYS = {
  customProducts: 'invis.customProducts',
  aliasExtras: 'invis.productAliasExtras',
  packExtras: 'invis.productPackExtras',
  catalogFieldExtras: 'invis.productCatalogFieldExtras',
  lastRecordUnit: 'invis.lastRecordUnit',
  activity: 'invis.recentActivity',
  session: 'invis.inventorySession',
  inventoryCleared: 'invis.inventoryCleared',
  places: 'invis.places',
  siteName: 'invis.siteName',
  activePlaceId: 'invis.activePlaceId',
  periodSnapshot: 'invis.periodSnapshot',
  priorStockList: 'invis.priorStockList',
  inventoryPhotos: 'invis.inventoryPhotos',
} as const;

/** Last successful cloud pull/push timestamp (ISO) on this device. */
export const WORKSPACE_SYNC_AT_KEY = 'invis.workspaceSyncAt.v1';

export type AliasExtras = Record<string, string[]>;
export type PackExtras = Record<
  string,
  { unitsPerPack: number; packBaseUnit: UnitCode }
>;
export type CatalogFieldExtras = Record<
  string,
  {
    packSize?: string;
    imageUrl?: string;
    sourceUrl?: string;
    ean?: string;
  }
>;

/** Serializable inventory workspace — everything that survives app restarts. */
export type WorkspaceSnapshotPayload = {
  customProducts: Product[];
  aliasExtras: AliasExtras;
  packExtras: PackExtras;
  catalogFieldExtras: CatalogFieldExtras;
  lastRecordUnit: UnitCode;
  recentActivity: InventoryActivityEntry[];
  session: InventorySession;
  inventoryCleared: boolean;
  places: Place[];
  siteName: string;
  activePlaceId: string;
  periodSnapshot: InventoryPeriodSnapshot | null;
  priorStockList: PriorStockListSnapshot | null;
  inventoryPhotos: InventoryPhoto[];
};

export function normalizeWorkspaceKey(email: string): string {
  return email.trim().toLowerCase();
}

export function hasMeaningfulWorkspaceData(payload: WorkspaceSnapshotPayload): boolean {
  if (payload.customProducts.length > 0) return true;
  if (payload.priorStockList) return true;
  if (payload.inventoryPhotos.length > 0) return true;
  if (payload.siteName.trim() && payload.siteName !== 'Kamppi') return true;
  const counted = payload.session.lines.some(
    (l: InventoryLine) => l.quantity != null && l.quantity !== 0,
  );
  return counted;
}
