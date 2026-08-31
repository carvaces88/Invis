import type { NavigatorScreenParams } from '@react-navigation/native';

/** Finnish kitchen units from inventaariopohja sheets */
export type UnitCode =
  | 'L'
  | 'KG'
  | 'KPL'
  | 'PRK'
  | 'RSA'
  | 'PSS'
  | 'PL'
  | 'PLO'
  | 'LTK'
  | 'PKT'
  | 'RAS';

export type IngredientType =
  | 'produce'
  | 'dairy'
  | 'oils'
  | 'dry_goods'
  | 'sauces'
  | 'nuts_seeds'
  | 'canned'
  | 'bakery'
  | 'frozen'
  | 'meat'
  | 'poultry'
  | 'deli'
  | 'other';

/** Stock movement kinds — ready for Supabase later */
export type StockMovementType =
  | 'inventory_count'
  | 'kuorma_in'
  | 'havikki_out'
  | 'adjustment';

export interface Product {
  id: string;
  /** Official POS / distributor name (NIMIKE) */
  officialName: string;
  unit: UnitCode;
  /** Pack size hint shown in UI, e.g. "935g/600g" */
  packSize?: string;
  /**
   * How many inner units (bottles/pieces) are in one outer pack.
   * Used for pack-aware save confirm when counting LTK/RSA/PSS/…
   */
  unitsPerPack?: number;
  /** Inner unit for unitsPerPack (default: PL/PLO if catalog unit is bottle, else KPL) */
  packBaseUnit?: UnitCode;
  unitPriceAlv0: number;
  ingredientType: IngredientType;
  /** Brand, FI/EN names, nicknames, partials — searchable */
  aliases: string[];
  /** Optional section label e.g. Top products */
  section?: string;
  lowStockThreshold?: number;
  isTop?: boolean;
  /** Remote https image (e.g. K-Ruoka CDN) — may 403; UI can fall back to bundled asset */
  imageUrl?: string;
  /** EAN / GTIN when known from retailer listing */
  ean?: string;
  /**
   * Restolution / POS product code (Tuotekoodi), e.g. M1001.
   * Used in Restolution export columns ahead of EAN.
   */
  productCode?: string;
  /** Public product page used as source attribution */
  sourceUrl?: string;
}

/** Optional place kind — UI may ignore; names stay free-form */
export type PlaceKind = 'kitchen' | 'freezer' | 'pantry' | 'other';

/**
 * Storage category for Inventory filter/group.
 * Prefer this over PlaceKind for spreadsheet filtering.
 */
export type StorageType =
  | 'dry_storage'
  | 'freezer'
  | 'prep_fridge'
  | 'drawers';

/** Named storage within a site (e.g. Downstairs kitchen, Freezer 1) */
export interface Place {
  id: string;
  name: string;
  kind?: PlaceKind;
  /** Filter/group category on the Inventory spreadsheet */
  storageType?: StorageType;
  sortOrder: number;
}

/**
 * Local-first month compare: opening qty at the start of `currentMonth`
 * (= closing counts from the previous calendar month).
 */
export interface InventoryPeriodSnapshot {
  /** YYYY-MM — openingQuantities are the opening for this month */
  currentMonth: string;
  capturedAt: string;
  /** `${productId}::${placeId}` → quantity at month start */
  openingQuantities: Record<string, number | null>;
  /** Last month the kitchen explicitly finalized (YYYY-MM) */
  lastFinalizedMonth?: string;
  /** ISO timestamp of that finalize */
  lastFinalizedAt?: string;
}

/** Final amount check — swipe verify before trusting totals */
export type LineVerificationStatus = 'pending' | 'correct' | 'incorrect';

export interface InventoryLine {
  id: string;
  productId: string;
  /** Storage place this count belongs to */
  placeId: string;
  quantity: number | null;
  /** Snapshot of name/unit/price at count time */
  officialName: string;
  unit: UnitCode;
  unitPriceAlv0: number;
  expiryDate?: string | null;
  notes?: string;
  /** @deprecated prefer lastUpdatedAt — kept for export compatibility */
  countedAt?: string;
  /** ISO timestamp of last qty change on this line */
  lastUpdatedAt?: string;
  /**
   * Amount verification (swipe right/left/up).
   * New counts start `pending`; seed/demo lines may be pre-marked `correct`.
   */
  verificationStatus?: LineVerificationStatus;
}

/** Recent additive stock updates (Record / confirm flows) — last ~20 */
export interface InventoryActivityEntry {
  id: string;
  productId: string;
  placeId: string;
  officialName: string;
  unit: UnitCode;
  /** Amount added (positive) */
  delta: number;
  quantityAfter: number;
  createdAt: string;
}

export interface InventorySession {
  id: string;
  title: string;
  /** PVM — inventory date ISO date */
  date: string;
  status: 'in_progress' | 'done';
  lines: InventoryLine[];
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  productId: string;
  officialName: string;
  unit: UnitCode;
  /** Signed delta (adds, waste, adjustments); for inventory_count = amount added/set */
  quantityDelta: number;
  quantityAfter: number | null;
  createdAt: string;
  notes?: string;
  station?: string;
  source?: 'product_scan' | 'kuorma' | 'havikki' | 'manual';
}

export interface HavikkiEntry {
  id: string;
  date: string;
  station?: string;
  productId: string;
  officialName: string;
  quantity: number;
  unit: UnitCode;
  notes?: string;
  createdAt: string;
}

export interface RecipeIngredient {
  productId: string;
  /** Qty of product unit needed per one portion */
  qtyPerPortion: number;
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  ingredients: RecipeIngredient[];
  /** Extra usage buffer for chef over-portioning, e.g. 0.12 = 12% */
  portionErrorPercent: number;
}

export interface VisionCropRegion {
  /** Normalized 0–1 box within the source photo (stub / future real crop) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Demo tint when no real crop bitmap is available */
  previewColor?: string;
}

export interface VisionExtract {
  suggestedName: string;
  unit?: UnitCode | null;
  quantity?: number | null;
  unitPriceAlv0?: number | null;
  expiryDate?: string | null;
  confidence: number;
  rawNotes?: string;
  /** AI prose when the model is unsure what the item is */
  aiDescription?: string;
  /** True when the model saw something but could not name it confidently */
  unrecognized?: boolean;
  crop?: VisionCropRegion;
  /** Pack / net weight from label or public listing, e.g. "935g/600g" */
  packSize?: string | null;
  /** Brand read from label or matched listing */
  brand?: string | null;
  /** Container type hint (purkki, pullo, pussi…) */
  containerHint?: string | null;
  ean?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  aliases?: string[];
  ingredientType?: IngredientType | null;
}

/** Prefill payload after analyzing one or more close-up product photos */
export interface ProductEnrichment {
  officialName: string;
  unit: UnitCode;
  packSize?: string;
  unitPriceAlv0?: number;
  brand?: string;
  containerHint?: string;
  ean?: string;
  sourceUrl?: string;
  imageUrl?: string;
  aliases: string[];
  ingredientType?: IngredientType;
  confidence: number;
  /** Human-readable analysis notes (source, brand, container…) */
  notes: string;
  /** True when matched to K-Ruoka / catalog public data */
  matchedPublicListing?: boolean;
}

export interface DocumentExtract {
  /**
   * kuorma = delivery in · havikki = waste out · fridge = multi-item shelf count
   * · sheet = printed inventaariopohja / clipboard inventory form
   */
  kind: 'kuorma' | 'havikki' | 'fridge' | 'sheet';
  title?: string;
  station?: string;
  lines: VisionExtract[];
  confidence: number;
  rawNotes?: string;
}

export type ProductMatchKind =
  | 'official'
  | 'alias'
  | 'ean'
  | 'brand_pack'
  | 'vision';

export interface ProductMatch {
  product: Product;
  score: number;
  matchedOn: ProductMatchKind;
  matchedTerm: string;
}

export type ScanMode = 'product' | 'delivery' | 'waste';

export type MainTabParamList = {
  Home: undefined;
  Inventaario: undefined;
  Scan: { mode?: ScanMode } | undefined;
  Catalog: undefined;
  More: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Confirm: {
    extract: VisionExtract;
    imageUri?: string;
  };
  /** On-device EAN/UPC scan (no Gemini) → Confirm or Add Product prefill */
  BarcodeScan: {
    purpose?: 'confirm' | 'addProduct';
    imageUri?: string;
    quantity?: number | null;
    expiryDate?: string | null;
  };
  BatchConfirm: {
    document: DocumentExtract;
    imageUri?: string;
  };
  AddProduct: {
    prefillName?: string;
    unit?: UnitCode;
    packSize?: string;
    unitPriceAlv0?: number;
    aliases?: string[];
    ean?: string;
    sourceUrl?: string;
    imageUrl?: string;
    ingredientType?: IngredientType;
    brand?: string;
    containerHint?: string;
    /** Close-up photo URIs already captured upstream */
    photoUris?: string[];
    returnToConfirm?: boolean;
    extract?: VisionExtract;
    imageUri?: string;
    returnToBatch?: boolean;
    document?: DocumentExtract;
    returnToFridge?: boolean;
    fridgeDocument?: DocumentExtract;
    /** Set by BarcodeScanScreen when returning with EAN prefill */
    scannedEan?: string;
    barcodeEnrichNotes?: string;
  };
  ProductScan: undefined;
  KuormaScan: undefined;
  HavikkiScan: undefined;
  RecordInventory: { heroFridge?: boolean } | undefined;
  ReportsChat: undefined;
  HavikkiLog: undefined;
  VideoDemo: undefined;
  UnitsGuide: undefined;
  Places: undefined;
  RecentActivity: undefined;
  ExportPreview: undefined;
  /** End-of-month finalize · summary · Restolution report */
  MonthWrapUp: undefined;
  /** Photo of printed inventaariopohja → OCR → validate → absolute counts */
  SheetImport: undefined;
  SheetImportReview: {
    document: DocumentExtract;
    imageUri?: string;
  };
  /** Optional feedback / comments (strongly nudged after sign-in) */
  Feedback: { nudged?: boolean } | undefined;
  /** Cesar: full people / feedback; investor: user-count traction only */
  AdminDeck: undefined;
  /** Investor pitch deck (Also previewable by Cesar) */
  PitchDeck: undefined;
  /** Catalog product detail (identity + inventory price + distributor lookups) */
  ProductDetail: { productId: string };
  /** Compare inventory 0% ALV vs competitor / distributor shelf prices */
  PriceComparison: undefined;
  /** Swipe-verify counted amounts (boxes vs pieces, etc.) */
  VerifyAmounts:
    | {
        /** Only lines touched in recent activity (default: all pending) */
        mode?: 'pending' | 'recent';
      }
    | undefined;
  FridgeReview: {
    document: DocumentExtract;
    imageUri?: string;
  };
};
