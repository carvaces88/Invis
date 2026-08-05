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
  /** Public product page used as source attribution */
  sourceUrl?: string;
}

/** Optional place kind — UI may ignore; names stay free-form */
export type PlaceKind = 'kitchen' | 'freezer' | 'pantry' | 'other';

/** Named storage within a site (e.g. Downstairs kitchen, Freezer 1) */
export interface Place {
  id: string;
  name: string;
  kind?: PlaceKind;
  sortOrder: number;
}

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
}

export interface DocumentExtract {
  /** kuorma = delivery in · havikki = waste out · fridge = multi-item inventory count */
  kind: 'kuorma' | 'havikki' | 'fridge';
  title?: string;
  station?: string;
  lines: VisionExtract[];
  confidence: number;
  rawNotes?: string;
}

export interface ProductMatch {
  product: Product;
  score: number;
  matchedOn: 'official' | 'alias';
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
  MainTabs:
    | {
        screen?: keyof MainTabParamList;
        params?: MainTabParamList[keyof MainTabParamList];
      }
    | undefined;
  Confirm: {
    extract: VisionExtract;
    imageUri?: string;
  };
  BatchConfirm: {
    document: DocumentExtract;
    imageUri?: string;
  };
  AddProduct: {
    prefillName?: string;
    unit?: UnitCode;
    returnToConfirm?: boolean;
    extract?: VisionExtract;
    imageUri?: string;
    returnToBatch?: boolean;
    document?: DocumentExtract;
    returnToFridge?: boolean;
    fridgeDocument?: DocumentExtract;
  };
  ProductScan: undefined;
  KuormaScan: undefined;
  HavikkiScan: undefined;
  RecordInventory: undefined;
  ReportsChat: undefined;
  HavikkiLog: undefined;
  VideoDemo: undefined;
  UnitsGuide: undefined;
  Places: undefined;
  RecentActivity: undefined;
  FridgeReview: {
    document: DocumentExtract;
    imageUri?: string;
  };
};
