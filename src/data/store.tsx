import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  appendMissingEventPlaceLines,
  createInitialSessionLines,
  SEED_PRODUCTS,
  SEED_QTY,
} from '../data/seedCatalog';
import { EVENT_PRODUCT_PLACE } from '../data/seedEventMenu';
import {
  DEFAULT_PLACE_ID,
  SEED_PLACES,
  SEED_SITE_NAME,
} from '../data/seedPlaces';
import {
  ensurePeriodSnapshot,
  finalizePeriodSnapshot,
  isPeriodSnapshot,
  openingQtyForLine,
  type FinalizeInventoryMonthResult,
} from '../data/periodSnapshot';
import { DEFAULT_PORTION_ERROR_PERCENT, SEED_RECIPES } from '../data/seedRecipes';
import { isStorageType, storageTypeFromKind } from '../data/storageTypes';
import type {
  HavikkiEntry,
  InventoryActivityEntry,
  InventoryLine,
  InventoryPeriodSnapshot,
  InventoryPhoto,
  InventorySession,
  Place,
  PriorStockListSnapshot,
  Product,
  Recipe,
  StockMovement,
  StockMovementType,
  StorageType,
  UnitCode,
} from '../data/types';

const CUSTOM_PRODUCTS_KEY = 'invis.customProducts';
const ALIAS_EXTRAS_KEY = 'invis.productAliasExtras';
const PACK_EXTRAS_KEY = 'invis.productPackExtras';
const CATALOG_FIELD_EXTRAS_KEY = 'invis.productCatalogFieldExtras';
const LAST_UNIT_KEY = 'invis.lastRecordUnit';
const ACTIVITY_KEY = 'invis.recentActivity';
const SESSION_KEY = 'invis.inventorySession';
const PLACES_KEY = 'invis.places';
const SITE_NAME_KEY = 'invis.siteName';
const ACTIVE_PLACE_KEY = 'invis.activePlaceId';
const PERIOD_SNAPSHOT_KEY = 'invis.periodSnapshot';
const PRIOR_STOCK_LIST_KEY = 'invis.priorStockList';
const INVENTORY_PHOTOS_KEY = 'invis.inventoryPhotos';
/** Once set, never re-inject SEED_QTY on startup — stay empty until user records */
const INVENTORY_CLEARED_KEY = 'invis.inventoryCleared';
/** Soft prompt window when adding the same product+place again */
export const RECENT_ADD_WINDOW_MS = 2 * 60 * 1000;
const MAX_ACTIVITY = 20;
const MAX_INVENTORY_PHOTOS = 80;

function isPriorStockListSnapshot(v: unknown): v is PriorStockListSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as PriorStockListSnapshot;
  return (
    typeof s.id === 'string' &&
    typeof s.importedAt === 'string' &&
    Array.isArray(s.lines) &&
    Array.isArray(s.sourceImageUris)
  );
}

function isInventoryPhoto(v: unknown): v is InventoryPhoto {
  if (!v || typeof v !== 'object') return false;
  const p = v as InventoryPhoto;
  return (
    typeof p.id === 'string' &&
    typeof p.uri === 'string' &&
    typeof p.placeId === 'string' &&
    typeof p.sessionDate === 'string' &&
    typeof p.createdAt === 'string'
  );
}

function isInventorySession(v: unknown): v is InventorySession {
  if (!v || typeof v !== 'object') return false;
  const s = v as InventorySession;
  return (
    typeof s.id === 'string' &&
    typeof s.date === 'string' &&
    Array.isArray(s.lines)
  );
}

/** Keep saved counts; ensure every catalog product has a line on the default place.
 * New catalog SKUs (not yet in the saved sheet) pick up SEED_QTY when defined.
 * Event mise also gets a stocked line on its preferred storage place. */
function reconcileSessionLines(
  saved: InventoryLine[],
  products: Product[],
  defaultPlaceId: string,
): InventoryLine[] {
  const productIds = new Set(products.map((p) => p.id));
  const kept = saved.filter((l) => productIds.has(l.productId));
  const haveDefault = new Set(
    kept.filter((l) => l.placeId === defaultPlaceId).map((l) => l.productId),
  );
  const missing = products
    .filter((p) => !haveDefault.has(p.id))
    .map((p) => {
      const preferred = EVENT_PRODUCT_PLACE[p.id] ?? defaultPlaceId;
      const quantity =
        preferred === defaultPlaceId
          ? ((SEED_QTY[p.id] ?? null) as number | null)
          : null;
      return {
        id: `line-${p.id}-${defaultPlaceId}`,
        productId: p.id,
        placeId: defaultPlaceId,
        quantity,
        officialName: p.officialName,
        unit: p.unit,
        unitPriceAlv0: p.unitPriceAlv0,
        countedAt: undefined as string | undefined,
        lastUpdatedAt: undefined as string | undefined,
        verificationStatus:
          quantity != null && quantity > 0
            ? ('correct' as const)
            : undefined,
      };
    });
  return appendMissingEventPlaceLines([...kept, ...missing], products);
}

type AliasExtras = Record<string, string[]>;
type PackExtras = Record<
  string,
  { unitsPerPack: number; packBaseUnit: UnitCode }
>;
type CatalogFieldExtras = Record<
  string,
  {
    packSize?: string;
    imageUrl?: string;
    sourceUrl?: string;
    ean?: string;
  }
>;

export type AddQuantityResult = {
  quantityBefore: number;
  quantityAfter: number;
  delta: number;
  lastUpdatedAt: string;
};

export type RecentAddWarning = {
  minutesAgo: number;
  lastDelta: number;
  lastUpdatedAt: string;
};

type Store = {
  products: Product[];
  session: InventorySession;
  movements: StockMovement[];
  havikkiLog: HavikkiEntry[];
  /** Last additive inventory adds (max 20) */
  recentActivity: InventoryActivityEntry[];
  recipes: Recipe[];
  /** Site / location label (e.g. Kamppi) */
  siteName: string;
  places: Place[];
  /** Place used for new inventory counts */
  activePlaceId: string;
  /**
   * Opening quantities for the current calendar month
   * (closing counts from last month after rollover).
   */
  periodSnapshot: InventoryPeriodSnapshot | null;
  /** Opening / last-month qty for a product+place line */
  getOpeningQuantity: (
    productId: string,
    placeId: string,
  ) => number | null | undefined;
  /**
   * End-of-month wrap-up: current counts become opening for the next month.
   * Returns whether the period advanced or was already just finalized.
   */
  finalizeInventoryMonth: () => FinalizeInventoryMonthResult;
  /** Last unit chosen when recording / creating a product */
  lastRecordUnit: UnitCode;
  setLastRecordUnit: (unit: UnitCode) => void;
  setSiteName: (name: string) => void;
  setActivePlaceId: (placeId: string) => void;
  addPlace: (
    name: string,
    kind?: Place['kind'],
    storageType?: StorageType,
  ) => Place | null;
  renamePlace: (placeId: string, name: string) => void;
  setPlaceStorageType: (placeId: string, storageType: StorageType) => void;
  /** Returns error key when blocked, else null */
  deletePlace: (placeId: string) => 'last' | 'has_stock' | 'not_found' | null;
  /** Global default portioning error (0–1), used when recipe has none */
  defaultPortionErrorPercent: number;
  setDefaultPortionErrorPercent: (n: number) => void;
  addProduct: (input: {
    officialName: string;
    unit: UnitCode;
    unitPriceAlv0?: number;
    packSize?: string;
    aliases: string[];
    ingredientType?: Product['ingredientType'];
    ean?: string;
    productCode?: string;
    imageUrl?: string;
    sourceUrl?: string;
    /** When set, also write this count on placeId (or active place) */
    initialQuantity?: number;
    /** Override active place for the optional opening count line */
    placeId?: string;
  }) => Product;
  /**
   * Atomic sheet / prior-list write: create missing catalog products and set
   * absolute counts for one place. Empty quantity does not wipe existing stock.
   */
  importStockListCounts: (args: {
    placeId: string;
    notes?: string;
    rows: Array<{
      productId: string | null;
      name: string;
      unit: UnitCode;
      quantity: number | null;
      unitPriceAlv0?: number | null;
      packSize?: string;
      aliases?: string[];
      ingredientType?: Product['ingredientType'];
    }>;
  }) => { written: number; created: number; skippedNoQty: number };
  /** Append a searchable alias on an existing product. Returns false if duplicate/empty. */
  addProductAlias: (productId: string, alias: string) => boolean;
  /** Persist pack → inner-unit multiplier (e.g. 6 bunches per box). */
  setProductPackInfo: (
    productId: string,
    unitsPerPack: number,
    packBaseUnit: UnitCode,
  ) => void;
  /** Update pack size / image / source / EAN on a catalog product (persisted). */
  updateProductCatalogFields: (
    productId: string,
    fields: {
      packSize?: string | null;
      imageUrl?: string | null;
      sourceUrl?: string | null;
      ean?: string | null;
    },
  ) => void;
  /** Absolute set — Inventaario tab tap-to-edit */
  updateLineQuantity: (lineId: string, quantity: number | null) => void;
  /** Mark swipe-verify result on a counted line */
  setLineVerification: (
    lineId: string,
    status: 'pending' | 'correct' | 'incorrect',
  ) => void;
  /** Edit qty + unit during verify (resets verification to pending) */
  updateLineCountDetails: (
    lineId: string,
    args: { quantity: number; unit: UnitCode },
  ) => void;
  /**
   * Absolute set — prefer addQuantity for Record / Add flows.
   * Kept for rare absolute-count use cases.
   */
  upsertCountedProduct: (args: {
    productId: string;
    quantity: number;
    placeId?: string;
    expiryDate?: string | null;
    notes?: string;
    /** When set (e.g. sheet HINTA), apply to the inventory line at 0% ALV */
    unitPriceAlv0?: number;
  }) => void;
  /** Additive receive — Record inventory / confirm / fridge */
  addQuantity: (args: {
    productId: string;
    delta: number;
    placeId?: string;
    expiryDate?: string | null;
    notes?: string;
    source?: StockMovement['source'];
  }) => AddQuantityResult | null;
  /** Soft double-add check for product+place within RECENT_ADD_WINDOW_MS */
  getRecentAddWarning: (
    productId: string,
    placeId?: string,
  ) => RecentAddWarning | null;
  /** Erase all counted stock across places; keeps catalog + places */
  clearAllInventory: () => void;
  /** Signed delta — kuorma_in (+), havikki_out (-), adjustment */
  applyStockDelta: (args: {
    productId: string;
    delta: number;
    type: Exclude<StockMovementType, 'inventory_count'>;
    placeId?: string;
    notes?: string;
    station?: string;
    source?: StockMovement['source'];
  }) => void;
  recordHavikki: (args: {
    productId: string;
    quantity: number;
    placeId?: string;
    station?: string;
    notes?: string;
  }) => void;
  replaceProducts: (products: Product[]) => void;
  /** Last imported prior stock list (cross-ref corpus) */
  priorStockList: PriorStockListSnapshot | null;
  savePriorStockList: (snapshot: PriorStockListSnapshot) => void;
  clearPriorStockList: () => void;
  /** Photos saved into the inventory album */
  inventoryPhotos: InventoryPhoto[];
  addInventoryPhoto: (args: {
    uri: string;
    placeId?: string;
    note?: string;
  }) => InventoryPhoto | null;
  removeInventoryPhoto: (id: string) => void;
};

const InventoryContext = createContext<Store | null>(null);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function sortedPlaces(places: Place[]) {
  return [...places].sort((a, b) => a.sortOrder - b.sortOrder);
}

function migratePlace(place: Place): Place {
  if (place.storageType && isStorageType(place.storageType)) {
    return place;
  }
  const seed = SEED_PLACES.find((s) => s.id === place.id);
  return {
    ...place,
    storageType:
      seed?.storageType ?? storageTypeFromKind(place.kind) ?? 'dry_storage',
  };
}

function parsePlaces(raw: string | null): Place[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const places: Place[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Place;
      if (typeof p.id !== 'string' || typeof p.name !== 'string') continue;
      places.push(
        migratePlace({
          id: p.id,
          name: p.name,
          kind: p.kind,
          storageType: p.storageType,
          sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : places.length,
        }),
      );
    }
    return places.length > 0 ? places : null;
  } catch {
    return null;
  }
}

function applyAliasExtras(p: Product, extras: AliasExtras): Product {
  const extra = extras[p.id];
  if (!extra?.length) return p;
  const seen = new Set(p.aliases.map((a) => a.toLowerCase()));
  const merged = [...p.aliases];
  for (const a of extra) {
    const t = a.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    merged.push(t);
  }
  return { ...p, aliases: merged };
}

function applyPackExtras(p: Product, packExtras: PackExtras): Product {
  const pack = packExtras[p.id];
  if (!pack || !(pack.unitsPerPack > 1)) return p;
  return {
    ...p,
    unitsPerPack: pack.unitsPerPack,
    packBaseUnit: pack.packBaseUnit,
  };
}

function applyCatalogFieldExtras(
  p: Product,
  extras: CatalogFieldExtras,
): Product {
  const e = extras[p.id];
  if (!e) return p;
  return {
    ...p,
    packSize:
      e.packSize !== undefined
        ? e.packSize.trim() || undefined
        : p.packSize,
    imageUrl:
      e.imageUrl !== undefined
        ? e.imageUrl.trim() || undefined
        : p.imageUrl,
    sourceUrl:
      e.sourceUrl !== undefined
        ? e.sourceUrl.trim() || undefined
        : p.sourceUrl,
    ean: e.ean !== undefined ? e.ean.trim() || undefined : p.ean,
  };
}

function mergeCatalog(
  seed: Product[],
  customs: Product[],
  extras: AliasExtras,
  packExtras: PackExtras = {},
  fieldExtras: CatalogFieldExtras = {},
): Product[] {
  const decorate = (p: Product) =>
    applyCatalogFieldExtras(
      applyPackExtras(applyAliasExtras(p, extras), packExtras),
      fieldExtras,
    );
  const withExtras = seed.map(decorate);
  const seedIds = new Set(seed.map((p) => p.id));
  const customOnly = customs.filter((p) => !seedIds.has(p.id)).map(decorate);
  return [...withExtras, ...customOnly];
}

function ensureLine(
  session: InventorySession,
  products: Product[],
  productId: string,
  placeId: string,
): { session: InventorySession; line: InventoryLine } {
  const existing = session.lines.find(
    (l) => l.productId === productId && l.placeId === placeId,
  );
  if (existing) return { session, line: existing };
  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error(`Unknown product ${productId}`);
  }
  const line: InventoryLine = {
    id: `line-${product.id}-${placeId}-${Date.now()}`,
    productId: product.id,
    placeId,
    quantity: 0,
    officialName: product.officialName,
    unit: product.unit,
    unitPriceAlv0: product.unitPriceAlv0,
  };
  return {
    session: { ...session, lines: [...session.lines, line] },
    line,
  };
}

function lineMatches(
  line: InventoryLine,
  productId: string,
  placeId: string,
) {
  return line.productId === productId && line.placeId === placeId;
}

function isUnitCode(v: string): v is UnitCode {
  return (
    v === 'L' ||
    v === 'KPL' ||
    v === 'PRK' ||
    v === 'RSA' ||
    v === 'PSS' ||
    v === 'PL' ||
    v === 'PLO' ||
    v === 'LTK' ||
    v === 'KG' ||
    v === 'RAS' ||
    v === 'PKT'
  );
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [aliasExtras, setAliasExtras] = useState<AliasExtras>({});
  const [packExtras, setPackExtras] = useState<PackExtras>({});
  const [catalogFieldExtras, setCatalogFieldExtras] =
    useState<CatalogFieldExtras>({});
  const [siteName, setSiteNameState] = useState(SEED_SITE_NAME);
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [activePlaceId, setActivePlaceIdState] =
    useState<string>(DEFAULT_PLACE_ID);
  const [periodSnapshot, setPeriodSnapshot] =
    useState<InventoryPeriodSnapshot | null>(null);
  const [placesReady, setPlacesReady] = useState(false);
  const [session, setSession] = useState<InventorySession>(() => ({
    id: 'session-demo',
    title: 'Inventory sheet RR',
    date: todayIsoDate(),
    status: 'in_progress',
    lines: createInitialSessionLines(SEED_PRODUCTS, DEFAULT_PLACE_ID),
  }));
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [havikkiLog, setHavikkiLog] = useState<HavikkiEntry[]>([]);
  const [recentActivity, setRecentActivity] = useState<InventoryActivityEntry[]>(
    [],
  );
  const [recipes] = useState<Recipe[]>(SEED_RECIPES);
  const [defaultPortionErrorPercent, setDefaultPortionErrorPercent] = useState(
    DEFAULT_PORTION_ERROR_PERCENT,
  );
  const [lastRecordUnit, setLastRecordUnitState] = useState<UnitCode>('KPL');
  const [catalogReady, setCatalogReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [priorStockList, setPriorStockList] =
    useState<PriorStockListSnapshot | null>(null);
  const [inventoryPhotos, setInventoryPhotos] = useState<InventoryPhoto[]>([]);
  const [vaultReady, setVaultReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          customsRaw,
          extrasRaw,
          packRaw,
          fieldExtrasRaw,
          unitRaw,
          activityRaw,
          sessionRaw,
          clearedRaw,
          placesRaw,
          siteRaw,
          activeRaw,
          snapshotRaw,
          priorListRaw,
          photosRaw,
        ] = await Promise.all([
          AsyncStorage.getItem(CUSTOM_PRODUCTS_KEY),
          AsyncStorage.getItem(ALIAS_EXTRAS_KEY),
          AsyncStorage.getItem(PACK_EXTRAS_KEY),
          AsyncStorage.getItem(CATALOG_FIELD_EXTRAS_KEY),
          AsyncStorage.getItem(LAST_UNIT_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(INVENTORY_CLEARED_KEY),
          AsyncStorage.getItem(PLACES_KEY),
          AsyncStorage.getItem(SITE_NAME_KEY),
          AsyncStorage.getItem(ACTIVE_PLACE_KEY),
          AsyncStorage.getItem(PERIOD_SNAPSHOT_KEY),
          AsyncStorage.getItem(PRIOR_STOCK_LIST_KEY),
          AsyncStorage.getItem(INVENTORY_PHOTOS_KEY),
        ]);
        if (cancelled) return;
        let customs: Product[] = [];
        let extras: AliasExtras = {};
        let packs: PackExtras = {};
        let fields: CatalogFieldExtras = {};
        if (priorListRaw) {
          try {
            const parsed = JSON.parse(priorListRaw) as unknown;
            if (isPriorStockListSnapshot(parsed)) setPriorStockList(parsed);
          } catch {
            /* ignore */
          }
        }
        if (photosRaw) {
          try {
            const parsed = JSON.parse(photosRaw) as unknown;
            if (Array.isArray(parsed)) {
              setInventoryPhotos(
                parsed.filter(isInventoryPhoto).slice(0, MAX_INVENTORY_PHOTOS),
              );
            }
          } catch {
            /* ignore */
          }
        }
        if (customsRaw) {
          const parsed = JSON.parse(customsRaw) as Product[];
          if (Array.isArray(parsed)) customs = parsed;
        }
        if (extrasRaw) {
          const parsed = JSON.parse(extrasRaw) as AliasExtras;
          if (parsed && typeof parsed === 'object') extras = parsed;
        }
        if (packRaw) {
          const parsed = JSON.parse(packRaw) as PackExtras;
          if (parsed && typeof parsed === 'object') packs = parsed;
        }
        if (fieldExtrasRaw) {
          const parsed = JSON.parse(fieldExtrasRaw) as CatalogFieldExtras;
          if (parsed && typeof parsed === 'object') fields = parsed;
        }
        if (unitRaw && isUnitCode(unitRaw)) {
          setLastRecordUnitState(unitRaw);
        }
        if (activityRaw) {
          const parsed = JSON.parse(activityRaw) as InventoryActivityEntry[];
          if (Array.isArray(parsed)) {
            setRecentActivity(parsed.slice(0, MAX_ACTIVITY));
          }
        }
        const merged = mergeCatalog(
          SEED_PRODUCTS,
          customs,
          extras,
          packs,
          fields,
        );
        setCustomProducts(customs);
        setAliasExtras(extras);
        setPackExtras(packs);
        setCatalogFieldExtras(fields);
        setProducts(merged);

        const loadedPlaces = parsePlaces(placesRaw) ?? SEED_PLACES.map(migratePlace);
        setPlaces(loadedPlaces);
        if (siteRaw && siteRaw.trim()) {
          setSiteNameState(siteRaw.trim());
        }
        if (activeRaw && loadedPlaces.some((p) => p.id === activeRaw)) {
          setActivePlaceIdState(activeRaw);
        } else {
          setActivePlaceIdState(loadedPlaces[0]?.id ?? DEFAULT_PLACE_ID);
        }

        const cleared = clearedRaw === '1';
        const defaultPlaceId = loadedPlaces[0]?.id ?? DEFAULT_PLACE_ID;
        let restored: InventorySession | null = null;
        if (sessionRaw) {
          try {
            const parsed = JSON.parse(sessionRaw) as unknown;
            if (isInventorySession(parsed)) restored = parsed;
          } catch {
            restored = null;
          }
        }
        let linesForSnapshot: InventoryLine[];
        if (restored) {
          const nextSession = {
            ...restored,
            status: restored.status === 'done' ? 'done' : 'in_progress',
            lines: reconcileSessionLines(restored.lines, merged, defaultPlaceId),
          } as InventorySession;
          setSession(nextSession);
          linesForSnapshot = nextSession.lines;
        } else if (cleared) {
          const nextSession: InventorySession = {
            id: `session-${Date.now()}`,
            title: 'Inventory sheet RR',
            date: todayIsoDate(),
            status: 'in_progress',
            lines: createInitialSessionLines(merged, defaultPlaceId, {
              seeded: false,
            }),
          };
          setSession(nextSession);
          linesForSnapshot = nextSession.lines;
        } else {
          // Keep in-memory seed session; refresh catalog lines onto default place.
          setSession((prev) => ({
            ...prev,
            lines: reconcileSessionLines(prev.lines, merged, defaultPlaceId),
          }));
          linesForSnapshot = createInitialSessionLines(merged, defaultPlaceId);
        }

        let savedSnapshot: InventoryPeriodSnapshot | null = null;
        if (snapshotRaw) {
          try {
            const parsed = JSON.parse(snapshotRaw) as unknown;
            if (isPeriodSnapshot(parsed)) savedSnapshot = parsed;
          } catch {
            savedSnapshot = null;
          }
        }
        setPeriodSnapshot(ensurePeriodSnapshot(savedSnapshot, linesForSnapshot));
      } catch {
        // keep seed catalog / session
        setPeriodSnapshot(
          ensurePeriodSnapshot(
            null,
            createInitialSessionLines(SEED_PRODUCTS, DEFAULT_PLACE_ID),
          ),
        );
      } finally {
        if (!cancelled) {
          setCatalogReady(true);
          setSessionReady(true);
          setPlacesReady(true);
          setVaultReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catalogReady) return;
    void AsyncStorage.setItem(
      CUSTOM_PRODUCTS_KEY,
      JSON.stringify(customProducts),
    ).catch(() => {});
  }, [customProducts, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void AsyncStorage.setItem(
      ALIAS_EXTRAS_KEY,
      JSON.stringify(aliasExtras),
    ).catch(() => {});
  }, [aliasExtras, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void AsyncStorage.setItem(
      PACK_EXTRAS_KEY,
      JSON.stringify(packExtras),
    ).catch(() => {});
  }, [packExtras, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void AsyncStorage.setItem(
      CATALOG_FIELD_EXTRAS_KEY,
      JSON.stringify(catalogFieldExtras),
    ).catch(() => {});
  }, [catalogFieldExtras, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void AsyncStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify(recentActivity),
    ).catch(() => {});
  }, [recentActivity, catalogReady]);

  useEffect(() => {
    if (!sessionReady) return;
    void AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)).catch(
      () => {},
    );
  }, [session, sessionReady]);

  useEffect(() => {
    if (!placesReady) return;
    void AsyncStorage.setItem(PLACES_KEY, JSON.stringify(places)).catch(
      () => {},
    );
  }, [places, placesReady]);

  useEffect(() => {
    if (!placesReady) return;
    void AsyncStorage.setItem(SITE_NAME_KEY, siteName).catch(() => {});
  }, [siteName, placesReady]);

  useEffect(() => {
    if (!placesReady) return;
    void AsyncStorage.setItem(ACTIVE_PLACE_KEY, activePlaceId).catch(() => {});
  }, [activePlaceId, placesReady]);

  useEffect(() => {
    if (!vaultReady) return;
    if (priorStockList) {
      void AsyncStorage.setItem(
        PRIOR_STOCK_LIST_KEY,
        JSON.stringify(priorStockList),
      ).catch(() => {});
    } else {
      void AsyncStorage.removeItem(PRIOR_STOCK_LIST_KEY).catch(() => {});
    }
  }, [priorStockList, vaultReady]);

  useEffect(() => {
    if (!vaultReady) return;
    void AsyncStorage.setItem(
      INVENTORY_PHOTOS_KEY,
      JSON.stringify(inventoryPhotos),
    ).catch(() => {});
  }, [inventoryPhotos, vaultReady]);

  useEffect(() => {
    if (!placesReady || !periodSnapshot) return;
    void AsyncStorage.setItem(
      PERIOD_SNAPSHOT_KEY,
      JSON.stringify(periodSnapshot),
    ).catch(() => {});
  }, [periodSnapshot, placesReady]);

  /** Rollover opening snapshot when the calendar month advances while running. */
  useEffect(() => {
    if (!sessionReady || !periodSnapshot) return;
    const next = ensurePeriodSnapshot(periodSnapshot, session.lines);
    if (next !== periodSnapshot) {
      setPeriodSnapshot(next);
    }
  }, [session.lines, sessionReady, periodSnapshot]);

  const pushActivity = useCallback((entry: InventoryActivityEntry) => {
    setRecentActivity((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY));
  }, []);

  const setLastRecordUnit = useCallback((unit: UnitCode) => {
    setLastRecordUnitState(unit);
    void AsyncStorage.setItem(LAST_UNIT_KEY, unit).catch(() => {});
  }, []);

  const setSiteName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed) setSiteNameState(trimmed);
  }, []);

  const setActivePlaceId = useCallback(
    (placeId: string) => {
      if (places.some((p) => p.id === placeId)) {
        setActivePlaceIdState(placeId);
      }
    },
    [places],
  );

  const getOpeningQuantity = useCallback(
    (productId: string, placeId: string) =>
      openingQtyForLine(periodSnapshot, productId, placeId),
    [periodSnapshot],
  );

  const finalizeInventoryMonth =
    useCallback((): FinalizeInventoryMonthResult => {
      const { snapshot, result } = finalizePeriodSnapshot(
        periodSnapshot,
        session.lines,
      );
      setPeriodSnapshot(snapshot);
      return result;
    }, [periodSnapshot, session.lines]);

  const addPlace = useCallback(
    (name: string, kind?: Place['kind'], storageType?: StorageType) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      let created: Place | null = null;
      setPlaces((prev) => {
        const maxOrder = prev.reduce((m, p) => Math.max(m, p.sortOrder), -1);
        const resolvedType =
          storageType ?? storageTypeFromKind(kind) ?? 'dry_storage';
        created = {
          id: `place-${Date.now()}`,
          name: trimmed,
          kind,
          storageType: resolvedType,
          sortOrder: maxOrder + 1,
        };
        return [...prev, created];
      });
      return created;
    },
    [],
  );

  const renamePlace = useCallback((placeId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlaces((prev) =>
      prev.map((p) => (p.id === placeId ? { ...p, name: trimmed } : p)),
    );
  }, []);

  const setPlaceStorageType = useCallback(
    (placeId: string, storageType: StorageType) => {
      setPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, storageType } : p)),
      );
    },
    [],
  );

  const deletePlace = useCallback(
    (placeId: string): 'last' | 'has_stock' | 'not_found' | null => {
      if (!places.some((p) => p.id === placeId)) return 'not_found';
      if (places.length <= 1) return 'last';
      const hasStock = session.lines.some(
        (l) =>
          l.placeId === placeId &&
          l.quantity != null &&
          l.quantity !== 0,
      );
      if (hasStock) return 'has_stock';
      const next = places.filter((p) => p.id !== placeId);
      setPlaces(next);
      setSession((s) => ({
        ...s,
        lines: s.lines.filter((l) => l.placeId !== placeId),
      }));
      if (activePlaceId === placeId) {
        setActivePlaceIdState(next[0]?.id ?? activePlaceId);
      }
      return null;
    },
    [places, session.lines, activePlaceId],
  );

  const addProduct = useCallback(
    (input: {
      officialName: string;
      unit: UnitCode;
      unitPriceAlv0?: number;
      packSize?: string;
      aliases: string[];
      ingredientType?: Product['ingredientType'];
      ean?: string;
      productCode?: string;
      imageUrl?: string;
      sourceUrl?: string;
      initialQuantity?: number;
      placeId?: string;
    }) => {
      const product: Product = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        officialName: input.officialName.trim(),
        unit: input.unit,
        packSize: input.packSize,
        unitPriceAlv0: input.unitPriceAlv0 ?? 0,
        ingredientType: input.ingredientType ?? 'other',
        aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
        ean: input.ean?.trim() || undefined,
        productCode: input.productCode?.trim() || undefined,
        imageUrl: input.imageUrl?.trim() || undefined,
        sourceUrl: input.sourceUrl?.trim() || undefined,
        lowStockThreshold: 1,
      };
      setCustomProducts((prev) => [...prev, product]);
      setProducts((prev) => [...prev, product]);
      setLastRecordUnit(input.unit);
      const placeId = input.placeId ?? activePlaceId;
      const qty =
        input.initialQuantity != null && !Number.isNaN(input.initialQuantity)
          ? input.initialQuantity
          : null;
      const now = new Date().toISOString();
      setSession((prev) => ({
        ...prev,
        lines: [
          ...prev.lines,
          {
            id: `line-${product.id}-${placeId}`,
            productId: product.id,
            placeId,
            quantity: qty,
            officialName: product.officialName,
            unit: product.unit,
            unitPriceAlv0: product.unitPriceAlv0,
            countedAt: qty != null ? now : undefined,
            lastUpdatedAt: qty != null ? now : undefined,
          },
        ],
      }));
      if (qty != null) {
        const movement: StockMovement = {
          id: `mov-${Date.now()}-${product.id}`,
          type: 'inventory_count',
          productId: product.id,
          officialName: product.officialName,
          unit: product.unit,
          quantityDelta: qty,
          quantityAfter: qty,
          createdAt: now,
          station: placeId,
          source: 'product_scan',
        };
        setMovements((m) => [movement, ...m]);
        pushActivity({
          id: `act-${Date.now()}-${product.id}`,
          productId: product.id,
          placeId,
          officialName: product.officialName,
          unit: product.unit,
          delta: qty,
          quantityAfter: qty,
          createdAt: now,
        });
      }
      return product;
    },
    [activePlaceId, setLastRecordUnit, pushActivity],
  );

  const importStockListCounts = useCallback(
    (args: {
      placeId: string;
      notes?: string;
      rows: Array<{
        productId: string | null;
        name: string;
        unit: UnitCode;
        quantity: number | null;
        unitPriceAlv0?: number | null;
        packSize?: string;
        aliases?: string[];
        ingredientType?: Product['ingredientType'];
      }>;
    }) => {
      setActivePlaceIdState(args.placeId);
      const now = new Date().toISOString();
      const stamp = Date.now();
      const createdProducts: Product[] = [];
      let written = 0;
      let created = 0;
      let skippedNoQty = 0;

      type Resolved = {
        product: Product;
        quantity: number | null;
        unitPriceAlv0?: number;
      };
      const resolved: Resolved[] = [];
      const known = new Map(products.map((p) => [p.id, p]));

      args.rows.forEach((row, i) => {
        let product =
          row.productId && known.has(row.productId)
            ? known.get(row.productId)!
            : undefined;
        if (!product) {
          product = {
            id: `custom-${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
            officialName: row.name.trim() || `Product ${i + 1}`,
            unit: row.unit,
            packSize: row.packSize,
            unitPriceAlv0:
              row.unitPriceAlv0 != null && Number.isFinite(row.unitPriceAlv0)
                ? Math.round(row.unitPriceAlv0 * 100) / 100
                : 0,
            ingredientType: row.ingredientType ?? 'other',
            aliases: (row.aliases ?? []).map((a) => a.trim()).filter(Boolean),
            lowStockThreshold: 1,
          };
          createdProducts.push(product);
          known.set(product.id, product);
          created += 1;
        }
        const qty =
          row.quantity != null &&
          Number.isFinite(row.quantity) &&
          row.quantity >= 0
            ? row.quantity
            : null;
        if (qty == null) skippedNoQty += 1;
        const price =
          row.unitPriceAlv0 != null && Number.isFinite(row.unitPriceAlv0)
            ? Math.round(row.unitPriceAlv0 * 100) / 100
            : undefined;
        resolved.push({ product, quantity: qty, unitPriceAlv0: price });
      });

      if (createdProducts.length) {
        setCustomProducts((prev) => [...prev, ...createdProducts]);
        setProducts((prev) => [...prev, ...createdProducts]);
      }

      const applyRows = (baseLines: InventoryLine[]) => {
        const lines = [...baseLines];
        const movements: StockMovement[] = [];
        const activities: Parameters<typeof pushActivity>[0][] = [];
        let writeCount = 0;

        for (const r of resolved) {
          const idx = lines.findIndex(
            (l) =>
              l.productId === r.product.id && l.placeId === args.placeId,
          );
          const existing = idx >= 0 ? lines[idx] : null;
          const price =
            r.unitPriceAlv0 != null
              ? r.unitPriceAlv0
              : existing?.unitPriceAlv0 || r.product.unitPriceAlv0;

          if (r.quantity == null) {
            if (!existing) {
              lines.push({
                id: `line-${r.product.id}-${args.placeId}-${stamp}`,
                productId: r.product.id,
                placeId: args.placeId,
                quantity: null,
                officialName: r.product.officialName,
                unit: r.product.unit,
                unitPriceAlv0: price,
                notes: args.notes,
              });
            } else if (r.unitPriceAlv0 != null) {
              lines[idx] = { ...existing, unitPriceAlv0: price };
            }
            continue;
          }

          const before = existing?.quantity ?? 0;
          const updated: InventoryLine = {
            id:
              existing?.id ??
              `line-${r.product.id}-${args.placeId}-${stamp}-${writeCount}`,
            productId: r.product.id,
            placeId: args.placeId,
            quantity: r.quantity,
            officialName: r.product.officialName,
            unit: r.product.unit,
            unitPriceAlv0: price,
            countedAt: now,
            lastUpdatedAt: now,
            notes: args.notes ?? existing?.notes,
            expiryDate: existing?.expiryDate,
            verificationStatus: 'pending',
          };
          if (idx >= 0) lines[idx] = updated;
          else lines.push(updated);

          movements.push({
            id: `mov-${stamp}-${writeCount}-${r.product.id}`,
            type: 'inventory_count',
            productId: r.product.id,
            officialName: r.product.officialName,
            unit: r.product.unit,
            quantityDelta: r.quantity - before,
            quantityAfter: r.quantity,
            createdAt: now,
            notes: args.notes,
            station: args.placeId,
            source: 'product_scan',
          });
          activities.push({
            id: `act-${stamp}-${writeCount}-${r.product.id}`,
            productId: r.product.id,
            placeId: args.placeId,
            officialName: r.product.officialName,
            unit: r.product.unit,
            delta: r.quantity - before,
            quantityAfter: r.quantity,
            createdAt: now,
          });
          writeCount += 1;
        }
        return { lines, movements, activities, writeCount };
      };

      // Compute once against current session for movements/counts, then merge
      // onto whatever is pending via functional update.
      const first = applyRows(session.lines);
      written = first.writeCount;
      setSession((prev) => {
        const next = applyRows(prev.lines);
        return { ...prev, lines: next.lines };
      });
      if (first.movements.length) {
        setMovements((m) => [...first.movements, ...m]);
      }
      for (const act of first.activities) pushActivity(act);

      return { written, created, skippedNoQty };
    },
    [products, session.lines, pushActivity],
  );

  const addProductAlias = useCallback(
    (productId: string, alias: string) => {
      const trimmed = alias.trim();
      if (!trimmed) return false;
      const lower = trimmed.toLowerCase();
      const product = products.find((p) => p.id === productId);
      if (!product) return false;
      if (
        product.officialName.toLowerCase() === lower ||
        product.aliases.some((a) => a.toLowerCase() === lower)
      ) {
        return false;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, aliases: [...p.aliases, trimmed] }
            : p,
        ),
      );
      setCustomProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, aliases: [...p.aliases, trimmed] }
            : p,
        ),
      );
      setAliasExtras((prev) => {
        const existing = prev[productId] ?? [];
        if (existing.some((a) => a.toLowerCase() === lower)) return prev;
        return { ...prev, [productId]: [...existing, trimmed] };
      });
      return true;
    },
    [products],
  );

  const setProductPackInfo = useCallback(
    (productId: string, unitsPerPack: number, packBaseUnit: UnitCode) => {
      if (!(unitsPerPack > 1) || !Number.isFinite(unitsPerPack)) return;
      const per = Math.round(unitsPerPack);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, unitsPerPack: per, packBaseUnit }
            : p,
        ),
      );
      setCustomProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, unitsPerPack: per, packBaseUnit }
            : p,
        ),
      );
      setPackExtras((prev) => ({
        ...prev,
        [productId]: { unitsPerPack: per, packBaseUnit },
      }));
    },
    [],
  );

  const updateProductCatalogFields = useCallback(
    (
      productId: string,
      fields: {
        packSize?: string | null;
        imageUrl?: string | null;
        sourceUrl?: string | null;
        ean?: string | null;
      },
    ) => {
      const patch: CatalogFieldExtras[string] = {};
      if (fields.packSize !== undefined) {
        patch.packSize = fields.packSize?.trim() || '';
      }
      if (fields.imageUrl !== undefined) {
        patch.imageUrl = fields.imageUrl?.trim() || '';
      }
      if (fields.sourceUrl !== undefined) {
        patch.sourceUrl = fields.sourceUrl?.trim() || '';
      }
      if (fields.ean !== undefined) {
        patch.ean = fields.ean?.replace(/\D/g, '') || '';
      }
      if (!Object.keys(patch).length) return;

      setCatalogFieldExtras((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], ...patch },
      }));

      const apply = (p: Product): Product => {
        if (p.id !== productId) return p;
        return {
          ...p,
          packSize:
            fields.packSize !== undefined
              ? fields.packSize?.trim() || undefined
              : p.packSize,
          imageUrl:
            fields.imageUrl !== undefined
              ? fields.imageUrl?.trim() || undefined
              : p.imageUrl,
          sourceUrl:
            fields.sourceUrl !== undefined
              ? fields.sourceUrl?.trim() || undefined
              : p.sourceUrl,
          ean:
            fields.ean !== undefined
              ? fields.ean?.replace(/\D/g, '') || undefined
              : p.ean,
        };
      };
      setProducts((prev) => prev.map(apply));
      setCustomProducts((prev) => prev.map(apply));
    },
    [],
  );

  const updateLineQuantity = useCallback(
    (lineId: string, quantity: number | null) => {
      const now = new Date().toISOString();
      setSession((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                quantity,
                countedAt: now,
                lastUpdatedAt: now,
                verificationStatus:
                  quantity != null && quantity > 0 ? 'pending' : undefined,
              }
            : line,
        ),
      }));
    },
    [],
  );

  const setLineVerification = useCallback(
    (lineId: string, status: 'pending' | 'correct' | 'incorrect') => {
      setSession((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId ? { ...line, verificationStatus: status } : line,
        ),
      }));
    },
    [],
  );

  const updateLineCountDetails = useCallback(
    (lineId: string, args: { quantity: number; unit: UnitCode }) => {
      const now = new Date().toISOString();
      setSession((prev) => ({
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                quantity: args.quantity,
                unit: args.unit,
                countedAt: now,
                lastUpdatedAt: now,
                verificationStatus: 'pending',
              }
            : line,
        ),
      }));
    },
    [],
  );

  const upsertCountedProduct = useCallback(
    (args: {
      productId: string;
      quantity: number;
      placeId?: string;
      expiryDate?: string | null;
      notes?: string;
      unitPriceAlv0?: number;
    }) => {
      const placeId = args.placeId ?? activePlaceId;
      const now = new Date().toISOString();
      setSession((prev) => {
        let next = prev;
        let line: InventoryLine;
        try {
          const ensured = ensureLine(next, products, args.productId, placeId);
          next = ensured.session;
          line = ensured.line;
        } catch {
          return prev;
        }
        const product = products.find((p) => p.id === args.productId)!;
        const before = line.quantity ?? 0;
        const price =
          typeof args.unitPriceAlv0 === 'number' &&
          Number.isFinite(args.unitPriceAlv0)
            ? Math.round(args.unitPriceAlv0 * 100) / 100
            : line.unitPriceAlv0 || product.unitPriceAlv0;
        const updated: InventoryLine = {
          ...line,
          quantity: args.quantity,
          expiryDate: args.expiryDate ?? line.expiryDate,
          countedAt: now,
          lastUpdatedAt: now,
          notes: args.notes ?? line.notes,
          unitPriceAlv0: price,
          verificationStatus: 'pending',
        };
        const movement: StockMovement = {
          id: `mov-${Date.now()}-${args.productId}`,
          type: 'inventory_count',
          productId: args.productId,
          officialName: product.officialName,
          unit: product.unit,
          quantityDelta: args.quantity - before,
          quantityAfter: args.quantity,
          createdAt: now,
          notes: args.notes,
          station: placeId,
          source: 'product_scan',
        };
        setMovements((m) => [movement, ...m]);
        return {
          ...next,
          lines: next.lines.map((l) =>
            lineMatches(l, args.productId, placeId) ? updated : l,
          ),
        };
      });
    },
    [products, activePlaceId],
  );

  const addQuantity = useCallback(
    (args: {
      productId: string;
      delta: number;
      placeId?: string;
      expiryDate?: string | null;
      notes?: string;
      source?: StockMovement['source'];
    }): AddQuantityResult | null => {
      const placeId = args.placeId ?? activePlaceId;
      const product = products.find((p) => p.id === args.productId);
      if (!product) return null;
      const now = new Date().toISOString();
      const captured: {
        quantityBefore: number;
        quantityAfter: number;
      } = { quantityBefore: 0, quantityAfter: 0 };
      let applied = false;

      setSession((prev) => {
        let next = prev;
        let line: InventoryLine;
        try {
          const ensured = ensureLine(next, products, args.productId, placeId);
          next = ensured.session;
          line = ensured.line;
        } catch {
          return prev;
        }
        const quantityBefore = line.quantity ?? 0;
        const quantityAfter =
          Math.round((quantityBefore + args.delta) * 1000) / 1000;
        captured.quantityBefore = quantityBefore;
        captured.quantityAfter = quantityAfter;
        applied = true;
        const updated: InventoryLine = {
          ...line,
          quantity: quantityAfter,
          expiryDate: args.expiryDate ?? line.expiryDate,
          countedAt: now,
          lastUpdatedAt: now,
          notes: args.notes ?? line.notes,
          unitPriceAlv0: line.unitPriceAlv0 || product.unitPriceAlv0,
          verificationStatus: 'pending',
        };
        return {
          ...next,
          lines: next.lines.map((l) =>
            lineMatches(l, args.productId, placeId) ? updated : l,
          ),
        };
      });

      if (!applied) return null;

      const result: AddQuantityResult = {
        quantityBefore: captured.quantityBefore,
        quantityAfter: captured.quantityAfter,
        delta: args.delta,
        lastUpdatedAt: now,
      };

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${args.productId}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'inventory_count',
        productId: args.productId,
        officialName: product.officialName,
        unit: product.unit,
        quantityDelta: args.delta,
        quantityAfter: result.quantityAfter,
        createdAt: now,
        notes: args.notes,
        station: placeId,
        source: args.source ?? 'product_scan',
      };
      setMovements((m) => [movement, ...m]);
      pushActivity({
        id: `act-${Date.now()}-${args.productId}`,
        productId: args.productId,
        placeId,
        officialName: product.officialName,
        unit: product.unit,
        delta: args.delta,
        quantityAfter: result.quantityAfter,
        createdAt: now,
      });

      return result;
    },
    [products, activePlaceId, pushActivity],
  );

  const getRecentAddWarning = useCallback(
    (productId: string, placeId?: string): RecentAddWarning | null => {
      const pid = placeId ?? activePlaceId;
      const hit = recentActivity.find(
        (a) => a.productId === productId && a.placeId === pid,
      );
      if (!hit) return null;
      const age = Date.now() - new Date(hit.createdAt).getTime();
      if (Number.isNaN(age) || age > RECENT_ADD_WINDOW_MS) return null;
      return {
        minutesAgo: Math.max(1, Math.ceil(age / 60_000)),
        lastDelta: hit.delta,
        lastUpdatedAt: hit.createdAt,
      };
    },
    [recentActivity, activePlaceId],
  );

  const clearAllInventory = useCallback(() => {
    const nowDate = todayIsoDate();
    setSession((prev) => {
      const next: InventorySession = {
        ...prev,
        id: `session-${Date.now()}`,
        date: nowDate,
        status: 'in_progress',
        lines: prev.lines.map((l) => ({
          ...l,
          quantity: null,
          countedAt: undefined,
          lastUpdatedAt: undefined,
          notes: undefined,
          expiryDate: undefined,
          verificationStatus: undefined,
        })),
      };
      // Persist immediately so a remount/refresh cannot reseed from SEED_QTY
      void AsyncStorage.multiSet([
        [SESSION_KEY, JSON.stringify(next)],
        [INVENTORY_CLEARED_KEY, '1'],
      ]).catch(() => {});
      return next;
    });
    setMovements((m) => m.filter((x) => x.type !== 'inventory_count'));
    setRecentActivity([]);
    void AsyncStorage.removeItem(ACTIVITY_KEY).catch(() => {});
  }, []);

  const applyStockDelta = useCallback(
    (args: {
      productId: string;
      delta: number;
      type: Exclude<StockMovementType, 'inventory_count'>;
      placeId?: string;
      notes?: string;
      station?: string;
      source?: StockMovement['source'];
    }) => {
      const placeId = args.placeId ?? activePlaceId;
      const now = new Date().toISOString();
      setSession((prev) => {
        let next = prev;
        let line: InventoryLine;
        try {
          const ensured = ensureLine(next, products, args.productId, placeId);
          next = ensured.session;
          line = ensured.line;
        } catch {
          return prev;
        }
        const product = products.find((p) => p.id === args.productId)!;
        const current = line.quantity ?? 0;
        const after = Math.round((current + args.delta) * 1000) / 1000;
        const movement: StockMovement = {
          id: `mov-${Date.now()}-${args.productId}-${Math.random().toString(36).slice(2, 6)}`,
          type: args.type,
          productId: args.productId,
          officialName: product.officialName,
          unit: product.unit,
          quantityDelta: args.delta,
          quantityAfter: after,
          createdAt: now,
          notes: args.notes,
          station: args.station ?? placeId,
          source: args.source,
        };
        setMovements((m) => [movement, ...m]);
        return {
          ...next,
          lines: next.lines.map((l) =>
            lineMatches(l, args.productId, placeId)
              ? {
                  ...l,
                  quantity: after,
                  countedAt: now,
                  lastUpdatedAt: now,
                }
              : l,
          ),
        };
      });
    },
    [products, activePlaceId],
  );

  const recordHavikki = useCallback(
    (args: {
      productId: string;
      quantity: number;
      placeId?: string;
      station?: string;
      notes?: string;
    }) => {
      const product = products.find((p) => p.id === args.productId);
      if (!product) return;
      const entry: HavikkiEntry = {
        id: `hav-${Date.now()}-${args.productId}`,
        date: todayIsoDate(),
        station: args.station,
        productId: args.productId,
        officialName: product.officialName,
        quantity: args.quantity,
        unit: product.unit,
        notes: args.notes,
        createdAt: new Date().toISOString(),
      };
      setHavikkiLog((prev) => [entry, ...prev]);
      applyStockDelta({
        productId: args.productId,
        delta: -Math.abs(args.quantity),
        type: 'havikki_out',
        placeId: args.placeId,
        notes: args.notes,
        station: args.station,
        source: 'havikki',
      });
    },
    [products, applyStockDelta],
  );

  const replaceProducts = useCallback((next: Product[]) => {
    setProducts(next);
    setCustomProducts(next.filter((p) => p.id.startsWith('custom-')));
  }, []);

  const savePriorStockList = useCallback((snapshot: PriorStockListSnapshot) => {
    setPriorStockList(snapshot);
  }, []);

  const clearPriorStockList = useCallback(() => {
    setPriorStockList(null);
  }, []);

  const addInventoryPhoto = useCallback(
    (args: { uri: string; placeId?: string; note?: string }) => {
      const uri = args.uri?.trim();
      if (!uri) return null;
      const placeId = args.placeId ?? activePlaceId;
      const photo: InventoryPhoto = {
        id: `iphoto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        uri,
        placeId,
        sessionDate: session.date,
        createdAt: new Date().toISOString(),
        note: args.note?.trim() || undefined,
      };
      setInventoryPhotos((prev) =>
        [photo, ...prev].slice(0, MAX_INVENTORY_PHOTOS),
      );
      return photo;
    },
    [activePlaceId, session.date],
  );

  const removeInventoryPhoto = useCallback((id: string) => {
    setInventoryPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      products,
      session,
      movements,
      havikkiLog,
      recentActivity,
      recipes,
      siteName,
      places: sortedPlaces(places),
      activePlaceId,
      periodSnapshot,
      getOpeningQuantity,
      finalizeInventoryMonth,
      lastRecordUnit,
      setLastRecordUnit,
      setSiteName,
      setActivePlaceId,
      addPlace,
      renamePlace,
      setPlaceStorageType,
      deletePlace,
      defaultPortionErrorPercent,
      setDefaultPortionErrorPercent,
      addProduct,
      addProductAlias,
      setProductPackInfo,
      updateProductCatalogFields,
      updateLineQuantity,
      setLineVerification,
      updateLineCountDetails,
      upsertCountedProduct,
      importStockListCounts,
      addQuantity,
      getRecentAddWarning,
      clearAllInventory,
      applyStockDelta,
      recordHavikki,
      replaceProducts,
      priorStockList,
      savePriorStockList,
      clearPriorStockList,
      inventoryPhotos,
      addInventoryPhoto,
      removeInventoryPhoto,
    }),
    [
      products,
      session,
      movements,
      havikkiLog,
      recentActivity,
      recipes,
      siteName,
      places,
      activePlaceId,
      periodSnapshot,
      getOpeningQuantity,
      finalizeInventoryMonth,
      lastRecordUnit,
      setLastRecordUnit,
      setSiteName,
      setActivePlaceId,
      addPlace,
      renamePlace,
      setPlaceStorageType,
      deletePlace,
      defaultPortionErrorPercent,
      addProduct,
      addProductAlias,
      setProductPackInfo,
      updateProductCatalogFields,
      updateLineQuantity,
      setLineVerification,
      updateLineCountDetails,
      upsertCountedProduct,
      importStockListCounts,
      addQuantity,
      getRecentAddWarning,
      clearAllInventory,
      applyStockDelta,
      recordHavikki,
      replaceProducts,
      priorStockList,
      savePriorStockList,
      clearPriorStockList,
      inventoryPhotos,
      addInventoryPhoto,
      removeInventoryPhoto,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

/** True when at least one inventory line has a recorded quantity (incl. 0). */
export function hasRecordedInventory(session: InventorySession): boolean {
  return session.lines.some((l) => l.quantity != null);
}

export function lineTotal(line: InventoryLine): number {
  if (line.quantity == null) return 0;
  return Math.round(line.quantity * line.unitPriceAlv0 * 100) / 100;
}

export function sessionTotals(
  session: InventorySession,
  placeId?: string | null,
) {
  const lines =
    placeId != null && placeId !== ''
      ? session.lines.filter((l) => l.placeId === placeId)
      : session.lines;
  const qty = lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
  const value = lines.reduce((s, l) => s + lineTotal(l), 0);
  return {
    quantity: Math.round(qty * 10) / 10,
    value: Math.round(value * 100) / 100,
  };
}

/** Sum stock across all places (recipes / global availability). */
export function getStockQty(
  session: InventorySession,
  productId: string,
  placeId?: string | null,
): number {
  const lines = session.lines.filter((l) => {
    if (l.productId !== productId) return false;
    if (placeId != null && placeId !== '') return l.placeId === placeId;
    return true;
  });
  return lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
}
