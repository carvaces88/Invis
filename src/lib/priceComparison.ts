/**
 * Price comparison: our inventory unitPriceAlv0 (0% ALV) vs competitor retail.
 */
import type { Product } from '../data/types';
import { FOOD_ALV_RATE, formatMoney, withFoodAlv } from './alv';
import { lookupKruokaProducts, type KruokaHit } from './kruokaLookup';
import {
  aimoPikatukkuSearchUrl,
  kruokaSearchUrl,
  lidlSearchUrl,
  skaupatSearchUrl,
  vihannesporssiUrl,
} from './priceComparisonUrls';
import { lookupSkaupatProducts, type SkaupatHit } from './skaupatLookup';

export type CompetitorSourceId =
  | 'kruoka'
  | 'skaupat'
  | 'lidl'
  | 'aimo'
  | 'vihannesporssi';

export type CompetitorAvailability = 'live' | 'seed' | 'link' | 'manual';

export type CompetitorRow = {
  id: CompetitorSourceId;
  /** Matched product name from live/seed, if any */
  matchedName?: string;
  packSize?: string;
  /** Competitor price at 0% ALV (converted from shelf when needed) */
  unitPriceAlv0?: number;
  /** Shelf / invoice € as entered or looked up (often incl. ALV for retail) */
  shelfPriceEur?: number;
  /** Whether shelfPriceEur includes food ALV */
  shelfIncludesAlv: boolean;
  sourceUrl: string;
  availability: CompetitorAvailability;
  lookupNote?: string;
};

export type PriceComparisonResult = {
  product: Product;
  ourAlv0: number;
  ourWithAlv: number;
  /** ISO timestamp when competitor prices were fetched */
  comparedAt: string;
  rows: CompetitorRow[];
};

export type CompareProductPricesOptions = {
  /** Prefer live/proxy over seed-first shortcuts; bust HTTP caches */
  forceRefresh?: boolean;
};

export function buildSearchQuery(product: Product): string {
  return [product.officialName, product.packSize].filter(Boolean).join(' ').trim();
}

function kruokaAvailability(hit: KruokaHit): CompetitorAvailability {
  if (hit.source === 'kruoka-live' || hit.source === 'kruoka-proxy') return 'live';
  if (hit.source === 'kruoka-seed') return 'seed';
  return 'link';
}

function skaupatAvailability(hit: SkaupatHit): CompetitorAvailability {
  return hit.source === 'skaupat-proxy' ? 'live' : 'seed';
}

/** Diff ourAlv0 − competitorAlv0; negative = we are cheaper */
export function priceDiffAlv0(
  ourAlv0: number,
  competitorAlv0: number | undefined,
): number | null {
  if (competitorAlv0 == null || !Number.isFinite(competitorAlv0)) return null;
  return Math.round((ourAlv0 - competitorAlv0) * 100) / 100;
}

export function formatEur(n: number): string {
  return `${formatMoney(n)} €`;
}

export function alv0FromRetailShelf(shelfInclAlv: number): number {
  if (!Number.isFinite(shelfInclAlv) || shelfInclAlv <= 0) return 0;
  return Math.round((shelfInclAlv / (1 + FOOD_ALV_RATE)) * 100) / 100;
}

export function retailShelfFromAlv0(alv0: number): number {
  return Math.round(withFoodAlv(alv0, true) * 100) / 100;
}

/**
 * Look up live/seed competitors; wholesale sources stay link + optional manual paste.
 * Does not invent prices — missing matches stay link-only with no €.
 */
export async function compareProductPrices(
  product: Product,
  manualShelfBySource?: Partial<Record<CompetitorSourceId, number>>,
  options?: CompareProductPricesOptions,
): Promise<PriceComparisonResult> {
  const query = buildSearchQuery(product);
  const ean = product.ean ?? null;
  const ourAlv0 = product.unitPriceAlv0 ?? 0;
  const preferLive = Boolean(options?.forceRefresh);

  const [kruokaHits, skaupatHits] = await Promise.all([
    lookupKruokaProducts({ query, ean, limit: 3, preferLive }),
    lookupSkaupatProducts({ query, ean, limit: 3, preferLive }),
  ]);

  const kruoka = kruokaHits[0];
  const skaupat = skaupatHits[0];

  const rows: CompetitorRow[] = [
    kruoka && kruoka.unitPriceAlv0 != null && kruoka.unitPriceAlv0 > 0
      ? {
          id: 'kruoka',
          matchedName: kruoka.officialName,
          packSize: kruoka.packSize,
          unitPriceAlv0: kruoka.unitPriceAlv0,
          shelfPriceEur: retailShelfFromAlv0(kruoka.unitPriceAlv0),
          shelfIncludesAlv: true,
          sourceUrl: kruoka.sourceUrl || kruokaSearchUrl(query, ean),
          availability: kruokaAvailability(kruoka),
        }
      : {
          id: 'kruoka',
          sourceUrl: kruokaSearchUrl(query, ean),
          shelfIncludesAlv: true,
          availability: 'link',
          lookupNote: 'open',
        },
    skaupat
      ? {
          id: 'skaupat',
          matchedName: skaupat.officialName,
          packSize: skaupat.packSize,
          unitPriceAlv0: skaupat.unitPriceAlv0,
          shelfPriceEur: skaupat.shelfPriceEur,
          shelfIncludesAlv: true,
          sourceUrl: skaupat.sourceUrl || skaupatSearchUrl(query),
          availability: skaupatAvailability(skaupat),
        }
      : {
          id: 'skaupat',
          sourceUrl: skaupatSearchUrl(query),
          shelfIncludesAlv: true,
          availability: 'link',
          lookupNote: 'open',
        },
    {
      id: 'lidl',
      sourceUrl: lidlSearchUrl(query),
      shelfIncludesAlv: true,
      availability: 'link',
      lookupNote: 'retail',
    },
    {
      id: 'aimo',
      sourceUrl: aimoPikatukkuSearchUrl(query),
      shelfIncludesAlv: false,
      availability: 'link',
      lookupNote: 'wholesale',
    },
    {
      id: 'vihannesporssi',
      sourceUrl: vihannesporssiUrl(query),
      shelfIncludesAlv: false,
      availability: 'link',
      lookupNote: 'wholesale',
    },
  ];

  // Apply manual pasted shelf € (overrides looked-up prices when set)
  for (const row of rows) {
    const manual = manualShelfBySource?.[row.id];
    if (manual == null || !Number.isFinite(manual) || manual <= 0) continue;
    row.shelfPriceEur = manual;
    row.availability = 'manual';
    if (row.shelfIncludesAlv) {
      row.unitPriceAlv0 = alv0FromRetailShelf(manual);
    } else {
      // Wholesale paste assumed excl. ALV (invoice / tukku net)
      row.unitPriceAlv0 = Math.round(manual * 100) / 100;
    }
  }

  return {
    product,
    ourAlv0,
    ourWithAlv: retailShelfFromAlv0(ourAlv0),
    comparedAt: new Date().toISOString(),
    rows,
  };
}
