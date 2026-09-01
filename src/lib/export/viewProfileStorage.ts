import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_VIEW_PROFILE,
  type ExportColumnId,
  type ExportProfileId,
} from './profiles';

const STORAGE_KEY = 'invis.inventoryViewProfile';
const COLUMN_ORDER_KEY = 'invis.inventoryColumnOrder';

const VALID: ExportProfileId[] = [
  'simplified',
  'amounts',
  'withPrice',
  'nameQty',
  'restolution',
];

const VALID_COLUMNS = new Set<ExportColumnId>([
  'name',
  'unit',
  'qty',
  'price',
  'total',
  'date',
  'productCode',
  'storage',
  'openingStock',
  'purchases',
  'closingStock',
  'usage',
  'need',
  'variance',
  'turnover',
]);

export type ColumnOrderByProfile = Partial<
  Record<ExportProfileId, ExportColumnId[]>
>;

function isProfileId(value: string | null): value is ExportProfileId {
  return value != null && (VALID as string[]).includes(value);
}

function sanitizeOrder(raw: unknown): ExportColumnId[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExportColumnId[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && VALID_COLUMNS.has(item as ExportColumnId)) {
      out.push(item as ExportColumnId);
    }
  }
  return out.length > 0 ? out : null;
}

function sanitizeOrderMap(raw: unknown): ColumnOrderByProfile {
  if (!raw || typeof raw !== 'object') return {};
  const map: ColumnOrderByProfile = {};
  for (const id of VALID) {
    const order = sanitizeOrder((raw as Record<string, unknown>)[id]);
    if (order) map[id] = order;
  }
  return map;
}

/** Last on-screen spreadsheet column profile (Home → Inventory). */
export async function loadViewProfile(): Promise<ExportProfileId> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isProfileId(stored)) return stored;
  } catch {
    // keep default
  }
  return DEFAULT_VIEW_PROFILE;
}

export async function saveViewProfile(
  id: ExportProfileId,
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore persistence errors
  }
}

/** Per-profile on-screen column order overrides (does not affect file export). */
export async function loadColumnOrders(): Promise<ColumnOrderByProfile> {
  try {
    const stored = await AsyncStorage.getItem(COLUMN_ORDER_KEY);
    if (!stored) return {};
    return sanitizeOrderMap(JSON.parse(stored) as unknown);
  } catch {
    return {};
  }
}

export async function saveColumnOrder(
  profileId: ExportProfileId,
  order: ExportColumnId[],
): Promise<void> {
  try {
    const current = await loadColumnOrders();
    const next: ColumnOrderByProfile = { ...current, [profileId]: order };
    await AsyncStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence errors
  }
}

export async function clearColumnOrder(
  profileId: ExportProfileId,
): Promise<void> {
  try {
    const current = await loadColumnOrders();
    if (!(profileId in current)) return;
    const next: ColumnOrderByProfile = { ...current };
    delete next[profileId];
    await AsyncStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence errors
  }
}
