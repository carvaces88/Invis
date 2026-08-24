import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createInitialSessionLines,
  SEED_PRODUCTS,
  SEED_QTY,
} from '../data/seedCatalog';
import {
  DEFAULT_PLACE_ID,
  SEED_PLACES,
  SEED_SITE_NAME,
} from '../data/seedPlaces';
import { DEFAULT_PORTION_ERROR_PERCENT, SEED_RECIPES } from '../data/seedRecipes';
import type {
  HavikkiEntry,
  InventoryActivityEntry,
  InventoryLine,
  InventorySession,
  Place,
  Product,
  Recipe,
  StockMovement,
  StockMovementType,
  UnitCode,
} from '../data/types';
import { useAuth } from '../lib/auth/AuthProvider';
import {
  loadLocalSnapshot,
  markInventoryCleared,
  saveActivePlaceId,
  saveActivity,
  saveAliasExtras,
  saveCustomProducts,
  saveLastUnit,
  savePackExtras,
  savePlaces,
  saveSession,
  saveSiteName,
  type AliasExtras,
  type PackExtras,
} from './repository/localRepository';
import {
  cloudPullVenue,
  flushSyncQueue,
  syncInsertHavikki,
  syncInsertMovement,
  syncRenameVenue,
  syncUpsertLine,
  syncUpsertPlace,
  syncUpsertProduct,
  syncUpsertSession,
  type SyncContext,
} from './repository/syncedRepository';

/** Soft prompt window when adding the same product+place again */
export const RECENT_ADD_WINDOW_MS = 2 * 60 * 1000;
const MAX_ACTIVITY = 20;

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
 * New catalog SKUs (not yet in the saved sheet) pick up SEED_QTY when defined. */
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
      const quantity = (SEED_QTY[p.id] ?? null) as number | null;
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
  return [...kept, ...missing];
}

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
  /** Last unit chosen when recording / creating a product */
  lastRecordUnit: UnitCode;
  setLastRecordUnit: (unit: UnitCode) => void;
  setSiteName: (name: string) => void;
  setActivePlaceId: (placeId: string) => void;
  addPlace: (name: string, kind?: Place['kind']) => Place | null;
  renamePlace: (placeId: string, name: string) => void;
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
    /** When set, also write this count on the active place */
    initialQuantity?: number;
  }) => Product;
  /** Append a searchable alias on an existing product. Returns false if duplicate/empty. */
  addProductAlias: (productId: string, alias: string) => boolean;
  /** Persist pack → inner-unit multiplier (e.g. 6 bunches per box). */
  setProductPackInfo: (
    productId: string,
    unitsPerPack: number,
    packBaseUnit: UnitCode,
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
};

const InventoryContext = createContext<Store | null>(null);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function sortedPlaces(places: Place[]) {
  return [...places].sort((a, b) => a.sortOrder - b.sortOrder);
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

function mergeCatalog(
  seed: Product[],
  customs: Product[],
  extras: AliasExtras,
  packExtras: PackExtras = {},
): Product[] {
  const withExtras = seed.map((p) =>
    applyPackExtras(applyAliasExtras(p, extras), packExtras),
  );
  const seedIds = new Set(seed.map((p) => p.id));
  const customOnly = customs
    .filter((p) => !seedIds.has(p.id))
    .map((p) => applyPackExtras(applyAliasExtras(p, extras), packExtras));
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
  const { isLocalOnly, activeVenueId } = useAuth();
  const syncCtxRef = useRef<SyncContext>({
    venueId: null,
    cloudEnabled: false,
  });
  syncCtxRef.current = {
    venueId: activeVenueId,
    cloudEnabled: !isLocalOnly && Boolean(activeVenueId),
  };

  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [aliasExtras, setAliasExtras] = useState<AliasExtras>({});
  const [packExtras, setPackExtras] = useState<PackExtras>({});
  const [siteName, setSiteNameState] = useState(SEED_SITE_NAME);
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [activePlaceId, setActivePlaceIdState] =
    useState<string>(DEFAULT_PLACE_ID);
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
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await loadLocalSnapshot();
        if (cancelled) return;

        const customs = snap.customProducts;
        const extras = snap.aliasExtras;
        const packs = snap.packExtras;
        if (snap.lastRecordUnit && isUnitCode(snap.lastRecordUnit)) {
          setLastRecordUnitState(snap.lastRecordUnit);
        }
        if (snap.recentActivity.length) {
          setRecentActivity(snap.recentActivity.slice(0, MAX_ACTIVITY));
        }
        if (snap.siteName?.trim()) {
          setSiteNameState(snap.siteName.trim());
        }
        const loadedPlaces =
          snap.places && snap.places.length > 0 ? snap.places : SEED_PLACES;
        setPlaces(loadedPlaces);
        if (
          snap.activePlaceId &&
          loadedPlaces.some((p) => p.id === snap.activePlaceId)
        ) {
          setActivePlaceIdState(snap.activePlaceId);
        } else {
          setActivePlaceIdState(loadedPlaces[0]?.id ?? DEFAULT_PLACE_ID);
        }

        const merged = mergeCatalog(SEED_PRODUCTS, customs, extras, packs);
        setCustomProducts(customs);
        setAliasExtras(extras);
        setPackExtras(packs);
        setProducts(merged);

        const defaultPlaceId = loadedPlaces[0]?.id ?? DEFAULT_PLACE_ID;
        const cleared = snap.inventoryCleared;
        let restored: InventorySession | null = null;
        if (snap.session && isInventorySession(snap.session)) {
          restored = snap.session;
        }
        if (restored) {
          setSession({
            ...restored,
            status: restored.status === 'done' ? 'done' : 'in_progress',
            lines: reconcileSessionLines(
              restored.lines,
              merged,
              defaultPlaceId,
            ),
          });
        } else if (cleared) {
          setSession({
            id: `session-${Date.now()}`,
            title: 'Inventory sheet RR',
            date: todayIsoDate(),
            status: 'in_progress',
            lines: createInitialSessionLines(merged, defaultPlaceId, {
              seeded: false,
            }),
          });
        }
      } catch {
        // keep seed catalog / session
      } finally {
        if (!cancelled) {
          setCatalogReady(true);
          setSessionReady(true);
          setPlacesReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pull cloud snapshot when signed into a venue (merge custom products + places).
  useEffect(() => {
    if (isLocalOnly || !activeVenueId || !catalogReady) return;
    let cancelled = false;
    (async () => {
      const remote = await cloudPullVenue(activeVenueId);
      if (cancelled || !remote) return;
      if (remote.places.length) {
        setPlaces(remote.places);
        void savePlaces(remote.places);
      }
      if (remote.products.length) {
        setCustomProducts(remote.products);
        setProducts((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const p of remote.products) byId.set(p.id, p);
          return [...byId.values()];
        });
        void saveCustomProducts(remote.products);
      }
      if (remote.session) {
        setSession(remote.session);
        void saveSession(remote.session);
      }
      void flushSyncQueue();
    })();
    return () => {
      cancelled = true;
    };
  }, [isLocalOnly, activeVenueId, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void saveCustomProducts(customProducts).catch(() => {});
  }, [customProducts, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void saveAliasExtras(aliasExtras).catch(() => {});
  }, [aliasExtras, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void savePackExtras(packExtras).catch(() => {});
  }, [packExtras, catalogReady]);

  useEffect(() => {
    if (!catalogReady) return;
    void saveActivity(recentActivity).catch(() => {});
  }, [recentActivity, catalogReady]);

  useEffect(() => {
    if (!sessionReady) return;
    void saveSession(session).catch(() => {});
    void syncUpsertSession(syncCtxRef.current, session);
  }, [session, sessionReady]);

  useEffect(() => {
    if (!placesReady) return;
    void savePlaces(places).catch(() => {});
  }, [places, placesReady]);

  useEffect(() => {
    if (!placesReady) return;
    void saveSiteName(siteName).catch(() => {});
  }, [siteName, placesReady]);

  useEffect(() => {
    if (!placesReady) return;
    void saveActivePlaceId(activePlaceId).catch(() => {});
  }, [activePlaceId, placesReady]);

  const pushActivity = useCallback((entry: InventoryActivityEntry) => {
    setRecentActivity((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY));
  }, []);

  const setLastRecordUnit = useCallback((unit: UnitCode) => {
    setLastRecordUnitState(unit);
    void saveLastUnit(unit).catch(() => {});
  }, []);

  const setSiteName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      setSiteNameState(trimmed);
      void syncRenameVenue(syncCtxRef.current, trimmed);
    }
  }, []);

  const setActivePlaceId = useCallback(
    (placeId: string) => {
      if (places.some((p) => p.id === placeId)) {
        setActivePlaceIdState(placeId);
      }
    },
    [places],
  );

  const addPlace = useCallback((name: string, kind?: Place['kind']) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let created: Place | null = null;
    setPlaces((prev) => {
      const maxOrder = prev.reduce((m, p) => Math.max(m, p.sortOrder), -1);
      created = {
        id: `place-${Date.now()}`,
        name: trimmed,
        kind,
        sortOrder: maxOrder + 1,
      };
      return [...prev, created];
    });
    if (created) {
      void syncUpsertPlace(syncCtxRef.current, created);
    }
    return created;
  }, []);

  const renamePlace = useCallback((placeId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlaces((prev) => {
      const next = prev.map((p) =>
        p.id === placeId ? { ...p, name: trimmed } : p,
      );
      const updated = next.find((p) => p.id === placeId);
      if (updated) void syncUpsertPlace(syncCtxRef.current, updated);
      return next;
    });
  }, []);

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
    }) => {
      const product: Product = {
        id: `custom-${Date.now()}`,
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
      void syncUpsertProduct(syncCtxRef.current, product);
      setLastRecordUnit(input.unit);
      const placeId = activePlaceId;
      const qty =
        input.initialQuantity != null && !Number.isNaN(input.initialQuantity)
          ? input.initialQuantity
          : null;
      const now = new Date().toISOString();
      const newLine: InventoryLine = {
        id: `line-${product.id}-${placeId}`,
        productId: product.id,
        placeId,
        quantity: qty,
        officialName: product.officialName,
        unit: product.unit,
        unitPriceAlv0: product.unitPriceAlv0,
        countedAt: qty != null ? now : undefined,
        lastUpdatedAt: qty != null ? now : undefined,
      };
      setSession((prev) => {
        void syncUpsertLine(syncCtxRef.current, prev.id, newLine);
        return {
          ...prev,
          lines: [...prev.lines, newLine],
        };
      });
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
        void syncInsertMovement(syncCtxRef.current, movement);
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
        const updated: InventoryLine = {
          ...line,
          quantity: args.quantity,
          expiryDate: args.expiryDate ?? line.expiryDate,
          countedAt: now,
          lastUpdatedAt: now,
          notes: args.notes ?? line.notes,
          // Keep existing unit price — never wipe when counting
          unitPriceAlv0: line.unitPriceAlv0 || product.unitPriceAlv0,
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
        void syncUpsertLine(syncCtxRef.current, next.id, updated);
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
      void syncInsertMovement(syncCtxRef.current, movement);
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
      void saveSession(next).catch(() => {});
      void markInventoryCleared().catch(() => {});
      void syncUpsertSession(syncCtxRef.current, next);
      return next;
    });
    setMovements((m) => m.filter((x) => x.type !== 'inventory_count'));
    setRecentActivity([]);
    void saveActivity([]).catch(() => {});
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
        void syncInsertMovement(syncCtxRef.current, movement);
        const updatedLine: InventoryLine = {
          ...line,
          quantity: after,
          countedAt: now,
          lastUpdatedAt: now,
        };
        void syncUpsertLine(syncCtxRef.current, next.id, updatedLine);
        return {
          ...next,
          lines: next.lines.map((l) =>
            lineMatches(l, args.productId, placeId) ? updatedLine : l,
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
      void syncInsertHavikki(syncCtxRef.current, entry);
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
      lastRecordUnit,
      setLastRecordUnit,
      setSiteName,
      setActivePlaceId,
      addPlace,
      renamePlace,
      deletePlace,
      defaultPortionErrorPercent,
      setDefaultPortionErrorPercent,
      addProduct,
      addProductAlias,
      setProductPackInfo,
      updateLineQuantity,
      setLineVerification,
      updateLineCountDetails,
      upsertCountedProduct,
      addQuantity,
      getRecentAddWarning,
      clearAllInventory,
      applyStockDelta,
      recordHavikki,
      replaceProducts,
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
      lastRecordUnit,
      setLastRecordUnit,
      setSiteName,
      setActivePlaceId,
      addPlace,
      renamePlace,
      deletePlace,
      defaultPortionErrorPercent,
      addProduct,
      addProductAlias,
      setProductPackInfo,
      updateLineQuantity,
      setLineVerification,
      updateLineCountDetails,
      upsertCountedProduct,
      addQuantity,
      getRecentAddWarning,
      clearAllInventory,
      applyStockDelta,
      recordHavikki,
      replaceProducts,
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
