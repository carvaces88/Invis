/**
 * Live / full K-Ruoka product lookup.
 *
 * Cascade:
 *  1. Optional proxy (`EXPO_PUBLIC_KRUOKA_LOOKUP_URL` or same-origin `/api/kruoka-lookup`)
 *  2. Direct www.k-ruoka.fi/kr-api (works when Cloudflare allows — e.g. some native nets)
 *  3. Offline SEED_KRUOKA_PRODUCTS fuzzy match
 *  4. Open Food Facts (FI-leaning) + Keskofiles pack image + K-Ruoka search URL
 *
 * Shelf € → inventory unitPriceAlv0 via FOOD_ALV_RATE.
 */
import { SEED_KRUOKA_PRODUCTS } from '../data/seedKruoka';
import type { Product, UnitCode, VisionExtract } from '../data/types';
import { FOOD_ALV_RATE } from './alv';
import {
  bestExtractMatch,
  bestMatch,
  isGarbageProductName,
  normalizeLoose,
} from './fuzzyMatch';

/** Queries that must never hit Open Food Facts / fuzzy seed (Aldi "Unknown" trap). */
export function isUsableLookupQuery(query: string | null | undefined): boolean {
  const q = (query ?? '').trim();
  if (!q) return false;
  if (/^\d{8,14}$/.test(q.replace(/\D/g, '')) && q.replace(/\D/g, '').length >= 8) {
    return true;
  }
  if (isGarbageProductName(q)) return false;
  // Need a non-generic token (brand / product line)
  const loose = normalizeLoose(q);
  if (loose.length < 3) return false;
  return !isGarbageProductName(loose);
}

/**
 * Vision extracts that are safe to enrich via live K-Ruoka / OFF.
 * Stub / unconfigured OCR ("Unknown product") must not search the web.
 */
export function extractHasLookupSignal(extract: VisionExtract): boolean {
  const ean = (extract.ean ?? '').replace(/\D/g, '');
  if (ean.length >= 8) return true;
  if (extract.unrecognized) return false;
  const name = extract.suggestedName?.trim() ?? '';
  if (!isUsableLookupQuery(name)) return false;
  if (extract.brand?.trim() && !isGarbageProductName(extract.brand)) return true;
  return isUsableLookupQuery([extract.brand, name, extract.packSize].filter(Boolean).join(' '));
}

const DEFAULT_STORE = 'N106';
const SEARCH_PATH = 'https://www.k-ruoka.fi/kr-api/v2/product-search';
const KESKO_IMAGE = (ean: string) =>
  `https://public.keskofiles.com/f/k-ruoka/product/${ean}`;

export type KruokaLookupSource =
  | 'kruoka-live'
  | 'kruoka-proxy'
  | 'kruoka-seed'
  | 'openfoodfacts';

export type KruokaHit = {
  ean?: string;
  officialName: string;
  brand?: string;
  packSize?: string;
  unit: UnitCode;
  unitPriceAlv0?: number;
  imageUrl?: string;
  sourceUrl: string;
  aliases: string[];
  ingredientType?: Product['ingredientType'];
  source: KruokaLookupSource;
};

type RawKruokaProduct = {
  id?: string;
  ean?: string;
  localizedName?: { finnish?: string; english?: string; swedish?: string };
  brand?: { name?: string };
  images?: string[];
  productAttributes?: {
    urlSlug?: string;
    measurements?: {
      contentSize?: number;
      contentUnit?: string;
      netWeight?: number;
    };
    image?: { url?: string };
  };
  mobilescan?: {
    pricing?: {
      normal?: {
        price?: number;
        unit?: string;
        unitPrice?: { value?: number; unit?: string; contentSize?: number };
        soldBy?: { kind?: string };
      };
    };
  };
};

function storeId(): string {
  return (
    process.env.EXPO_PUBLIC_KRUOKA_STORE_ID?.trim() || DEFAULT_STORE
  );
}

function proxyBase(): string | null {
  const explicit = process.env.EXPO_PUBLIC_KRUOKA_LOOKUP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  // Same-origin Vercel/Netlify function when running the web build
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/kruoka-lookup`;
  }
  return null;
}

function shelfToAlv0(shelfEur: number): number {
  if (!Number.isFinite(shelfEur) || shelfEur <= 0) return 0;
  return Math.round((shelfEur / (1 + FOOD_ALV_RATE)) * 100) / 100;
}

function formatPackSize(
  size?: number,
  unit?: string,
): string | undefined {
  if (size == null || !Number.isFinite(size)) return undefined;
  const u = (unit ?? '').toLowerCase();
  if (u === 'kg') {
    if (size < 1) return `${Math.round(size * 1000)} g`;
    return `${String(size).replace('.', ',')} kg`;
  }
  if (u === 'g') return `${size} g`;
  if (u === 'l' || u === 'litra') {
    if (size < 1) return `${Math.round(size * 1000)} ml`;
    return `${String(size).replace('.', ',')} l`;
  }
  if (u === 'ml') return `${size} ml`;
  return `${size} ${unit ?? ''}`.trim();
}

function unitFromKruoka(raw: RawKruokaProduct): UnitCode {
  const sold = raw.mobilescan?.pricing?.normal?.soldBy?.kind?.toLowerCase();
  const priceUnit = raw.mobilescan?.pricing?.normal?.unit?.toLowerCase();
  const contentUnit =
    raw.productAttributes?.measurements?.contentUnit?.toLowerCase();
  if (sold === 'weight' || priceUnit === 'kg' || contentUnit === 'kg') {
    // Pack sold as piece with kg content → still KPL for a tray/bag
    if (priceUnit === 'kpl' || sold === 'piece') return 'KPL';
    return 'KG';
  }
  if (contentUnit === 'l' || priceUnit === 'l') return 'L';
  return 'KPL';
}

function mapKruokaRaw(
  raw: RawKruokaProduct,
  source: KruokaLookupSource,
): KruokaHit | null {
  const ean = (raw.ean || raw.id || '').replace(/\D/g, '') || undefined;
  const fi = raw.localizedName?.finnish?.trim();
  const en = raw.localizedName?.english?.trim();
  const sv = raw.localizedName?.swedish?.trim();
  const officialName = fi || en || sv;
  if (!officialName) return null;

  const brand = raw.brand?.name?.trim();
  const m = raw.productAttributes?.measurements;
  const packSize = formatPackSize(m?.contentSize, m?.contentUnit);
  const shelf = raw.mobilescan?.pricing?.normal?.price;
  const slug = raw.productAttributes?.urlSlug;
  const sourceUrl = slug
    ? `https://www.k-ruoka.fi/kauppa/tuote/${slug}`
    : ean
      ? `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(ean)}`
      : `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(officialName)}`;
  const imageUrl =
    raw.productAttributes?.image?.url ||
    raw.images?.[0] ||
    (ean ? KESKO_IMAGE(ean) : undefined);

  const aliases = [
    officialName.toLowerCase(),
    en?.toLowerCase(),
    sv?.toLowerCase(),
    brand ? `${brand} ${officialName}`.toLowerCase() : null,
    ean,
  ].filter(Boolean) as string[];

  return {
    ean,
    officialName,
    brand,
    packSize,
    unit: unitFromKruoka(raw),
    unitPriceAlv0:
      shelf != null && shelf > 0 ? shelfToAlv0(shelf) : undefined,
    imageUrl,
    sourceUrl,
    aliases: [...new Set(aliases)],
    source,
  };
}

function unwrapSearchPayload(json: unknown): RawKruokaProduct[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, unknown>;
  // Proxy may return { products: KruokaHit[] } already mapped
  if (Array.isArray(root.products) && root.products[0]?.officialName) {
    return [];
  }
  const result = root.result;
  if (!Array.isArray(result)) return [];
  return result
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as { product?: RawKruokaProduct } & RawKruokaProduct;
      return r.product ?? r;
    })
    .filter(Boolean) as RawKruokaProduct[];
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      // Cloudflare challenge HTML
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

async function searchViaProxy(
  query: string,
  limit: number,
): Promise<KruokaHit[]> {
  const base = proxyBase();
  if (!base) return [];
  const url = `${base}?q=${encodeURIComponent(query)}&limit=${limit}&storeId=${encodeURIComponent(storeId())}`;
  const json = await fetchJson(url);
  if (!json || typeof json !== 'object') return [];
  const root = json as {
    products?: KruokaHit[];
    result?: unknown;
  };
  if (Array.isArray(root.products) && root.products[0]?.officialName) {
    return root.products.map((p) => ({
      ...p,
      source: (p.source ?? 'kruoka-proxy') as KruokaLookupSource,
    }));
  }
  return unwrapSearchPayload(json)
    .map((raw) => mapKruokaRaw(raw, 'kruoka-proxy'))
    .filter(Boolean) as KruokaHit[];
}

async function searchDirectKruoka(
  query: string,
  limit: number,
): Promise<KruokaHit[]> {
  const url =
    `${SEARCH_PATH}/${encodeURIComponent(query)}` +
    `?storeId=${encodeURIComponent(storeId())}&offset=0&limit=${limit}`;
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-k-build-number': '30858',
    },
    body: '{}',
  });
  if (!json) return [];
  return unwrapSearchPayload(json)
    .map((raw) => mapKruokaRaw(raw, 'kruoka-live'))
    .filter(Boolean) as KruokaHit[];
}

function searchSeed(query: string, ean?: string | null): KruokaHit[] {
  if (ean) {
    const byEan = SEED_KRUOKA_PRODUCTS.find((p) => p.ean === ean);
    if (byEan) {
      return [
        {
          ean: byEan.ean,
          officialName: byEan.officialName,
          packSize: byEan.packSize,
          unit: byEan.unit,
          unitPriceAlv0: byEan.unitPriceAlv0,
          imageUrl: byEan.imageUrl,
          sourceUrl:
            byEan.sourceUrl ??
            `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(ean)}`,
          aliases: byEan.aliases,
          ingredientType: byEan.ingredientType,
          brand: byEan.officialName.split(/\s+/)[0],
          source: 'kruoka-seed',
        },
      ];
    }
  }
  const hit = bestMatch(SEED_KRUOKA_PRODUCTS, query);
  if (!hit || hit.score < 0.45) return [];
  const p = hit.product;
  return [
    {
      ean: p.ean,
      officialName: p.officialName,
      packSize: p.packSize,
      unit: p.unit,
      unitPriceAlv0: p.unitPriceAlv0,
      imageUrl: p.imageUrl,
      sourceUrl:
        p.sourceUrl ??
        `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(p.officialName)}`,
      aliases: p.aliases,
      ingredientType: p.ingredientType,
      source: 'kruoka-seed',
    },
  ];
}

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_fi?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  image_front_url?: string;
};

async function searchOpenFoodFacts(
  query: string,
  ean?: string | null,
  limit = 5,
): Promise<KruokaHit[]> {
  const hits: KruokaHit[] = [];

  if (ean && /^\d{8,14}$/.test(ean)) {
    const json = (await fetchJson(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json`,
    )) as { status?: number; product?: OffProduct } | null;
    if (json?.status === 1 && json.product) {
      const mapped = mapOff(json.product);
      if (mapped) hits.push(mapped);
    }
  }

  if (hits.length >= limit) return hits.slice(0, limit);

  const searchUrl =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=code,product_name,product_name_fi,brands,quantity,image_url,image_front_url`;
  const json = (await fetchJson(searchUrl)) as {
    products?: OffProduct[];
  } | null;
  for (const p of json?.products ?? []) {
    const mapped = mapOff(p);
    if (!mapped) continue;
    if (hits.some((h) => h.ean && h.ean === mapped.ean)) continue;
    hits.push(mapped);
    if (hits.length >= limit) break;
  }
  return hits;
}

function mapOff(p: OffProduct): KruokaHit | null {
  const ean = (p.code ?? '').replace(/\D/g, '') || undefined;
  const officialName = (
    p.product_name_fi ||
    p.product_name ||
    ''
  ).trim();
  if (!officialName) return null;
  // OFF has literal products named "Unknown" (e.g. Aldi) — never surface those
  // from a text search; EAN exact lookup may still return them intentionally.
  if (isGarbageProductName(officialName)) return null;
  const brand = p.brands?.split(',')[0]?.trim();
  const displayName = brand ? `${brand} ${officialName}` : officialName;
  if (isGarbageProductName(displayName) && !ean) return null;
  const packSize = p.quantity?.trim() || undefined;
  const q = ean || officialName;
  return {
    ean,
    officialName: displayName,
    brand,
    packSize,
    unit: 'KPL',
    imageUrl:
      (ean ? KESKO_IMAGE(ean) : undefined) ||
      p.image_front_url ||
      p.image_url,
    sourceUrl: `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(q)}`,
    aliases: [
      officialName.toLowerCase(),
      brand ? brand.toLowerCase() : null,
      ean,
    ].filter(Boolean) as string[],
    source: 'openfoodfacts',
  };
}

function hitToProduct(hit: KruokaHit): Product {
  const id = hit.ean
    ? `kruoka-live-${hit.ean}`
    : `kruoka-live-${hit.officialName
        .toLowerCase()
        .replace(/[^a-z0-9åäö]+/gi, '-')
        .slice(0, 48)}`;
  return {
    id,
    officialName: hit.officialName,
    unit: hit.unit,
    packSize: hit.packSize,
    unitPriceAlv0: hit.unitPriceAlv0 ?? 0,
    ingredientType: hit.ingredientType ?? 'other',
    aliases: hit.aliases,
    ean: hit.ean,
    sourceUrl: hit.sourceUrl,
    imageUrl: hit.imageUrl,
    section: 'K-Ruoka · live',
  };
}

/**
 * Search K-Ruoka (and fallbacks) by free-text and/or EAN.
 */
export async function lookupKruokaProducts(opts: {
  query?: string;
  ean?: string | null;
  limit?: number;
}): Promise<KruokaHit[]> {
  const limit = opts.limit ?? 8;
  const ean = opts.ean?.replace(/\D/g, '') || null;
  const rawQuery = (opts.query ?? '').trim();
  const query = isUsableLookupQuery(rawQuery) ? rawQuery : '';
  if (!query && !ean) return [];

  // Instant offline hit when seed already knows this EAN
  if (ean) {
    const seedHit = searchSeed(query || ean, ean);
    if (seedHit.length && seedHit[0].ean === ean) {
      return seedHit;
    }
  }

  const searches = [query, ean].filter(
    (q, i, arr): q is string => Boolean(q) && arr.indexOf(q) === i,
  );

  for (const q of searches) {
    const viaProxy = await searchViaProxy(q, limit);
    if (viaProxy.length) return viaProxy.slice(0, limit);

    const viaLive = await searchDirectKruoka(q, limit);
    if (viaLive.length) return viaLive.slice(0, limit);
  }

  // Seed fuzzy only for usable text (never "Unknown product")
  if (query || ean) {
    const seed = searchSeed(query || ean || '', ean);
    if (seed.length) {
      if (ean && seed[0].ean === ean) return seed;
      if (query && !isGarbageProductName(query)) return seed;
    }
  }

  // OFF: EAN exact always OK; text search only with a real product query
  if (ean || query) {
    return searchOpenFoodFacts(query || ean || '', ean, limit);
  }
  return [];
}

/** Best single hit for a vision extract (EAN preferred, then name). */
export async function lookupKruokaForExtract(
  extract: VisionExtract,
): Promise<{ product: Product; hit: KruokaHit; score: number } | null> {
  if (!extractHasLookupSignal(extract)) return null;

  const query = [extract.brand, extract.suggestedName, extract.packSize]
    .filter(Boolean)
    .join(' ')
    .trim();
  const usableQuery = isUsableLookupQuery(query)
    ? query
    : isUsableLookupQuery(extract.suggestedName)
      ? extract.suggestedName
      : undefined;
  const hits = await lookupKruokaProducts({
    query: usableQuery,
    ean: extract.ean,
    limit: 10,
  });
  if (!hits.length) return null;

  const eanQ = (extract.ean ?? '').replace(/\D/g, '');
  if (eanQ) {
    const exact = hits.find((h) => (h.ean ?? '').replace(/\D/g, '') === eanQ);
    if (exact) {
      return { product: hitToProduct(exact), hit: exact, score: 0.98 };
    }
  }

  const asProducts = hits.map(hitToProduct);
  const ranked = bestExtractMatch(asProducts, extract);
  // Require a real name/brand agreement — never promote a random OFF top hit
  if (ranked && ranked.score >= 0.72) {
    const hit = hits[asProducts.indexOf(ranked.product)] ?? hits[0];
    // Live K-Ruoka / proxy can be trusted slightly lower; OFF needs stronger score
    if (hit.source === 'openfoodfacts' && ranked.score < 0.85) {
      return null;
    }
    return { product: ranked.product, hit, score: ranked.score };
  }

  // Only accept an unranked top hit when it came from live K-Ruoka and
  // vision already has a usable brand+name (not stub placeholders).
  const top = hits[0];
  if (
    (top.source === 'kruoka-live' || top.source === 'kruoka-proxy') &&
    usableQuery &&
    !extract.unrecognized
  ) {
    return { product: hitToProduct(top), hit: top, score: 0.62 };
  }
  return null;
}
