import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUGUST_SHEET_CATEGORY_TOTALS,
  ITEM_CATEGORY_IDS,
  type SimplifiedItemCategoryId,
} from '../data/simplifiedCountingSeed';
import { monthKeyFromIndex } from './supplierPriceHistory';

const STORAGE_KEY = 'invis.simpCount.monthStock.v1';

export type MonthStockSnapshot = {
  monthKey: string;
  byCategory: Partial<Record<SimplifiedItemCategoryId, number>>;
  foodTotal: number;
  savedAt: string;
};

export type MonthStockStore = Record<string, MonthStockSnapshot>;

export async function loadMonthStockStore(): Promise<MonthStockStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as MonthStockStore;
  } catch {
    return {};
  }
}

export async function saveMonthStockStore(
  store: MonthStockStore,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function foodTotalFromCategories(
  byCategory: Partial<Record<SimplifiedItemCategoryId, number>>,
): number {
  return (
    Math.round(
      ITEM_CATEGORY_IDS.reduce(
        (sum, id) => sum + (byCategory[id] ?? 0),
        0,
      ) * 100,
    ) / 100
  );
}

/** Seed August inventaario sheet totals once so prior-month demos have a baseline. */
export async function ensureSeededPriorMonthStock(
  year = new Date().getFullYear(),
): Promise<MonthStockStore> {
  const store = await loadMonthStockStore();
  const augustKey = monthKeyFromIndex(7, year);
  if (store[augustKey]) return store;
  const byCategory = { ...AUGUST_SHEET_CATEGORY_TOTALS };
  store[augustKey] = {
    monthKey: augustKey,
    byCategory,
    foodTotal: foodTotalFromCategories(byCategory),
    savedAt: new Date().toISOString(),
  };
  await saveMonthStockStore(store);
  return store;
}

export async function upsertMonthStockSnapshot(
  monthKey: string,
  byCategory: Partial<Record<SimplifiedItemCategoryId, number>>,
): Promise<MonthStockSnapshot> {
  const store = await loadMonthStockStore();
  const snap: MonthStockSnapshot = {
    monthKey,
    byCategory: { ...byCategory },
    foodTotal: foodTotalFromCategories(byCategory),
    savedAt: new Date().toISOString(),
  };
  store[monthKey] = snap;
  await saveMonthStockStore(store);
  return snap;
}

export function snapshotCategoryTotal(
  snap: MonthStockSnapshot | undefined,
  categoryId: SimplifiedItemCategoryId,
): number | null {
  if (!snap) return null;
  const n = snap.byCategory[categoryId];
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
