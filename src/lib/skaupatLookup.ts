/**
 * S-Kaupat price lookup for Price comparison.
 *
 * Live GraphQL is Cloudflare / persisted-query gated — cascade:
 *  1. Optional proxy `/api/skaupat-lookup` (stub today)
 *  2. Offline SEED_SKAUPAT_PRODUCTS fuzzy match
 *
 * Returns shelf € (incl. food ALV) and unitPriceAlv0 for fair compare.
 */
import { SEED_SKAUPAT_PRODUCTS } from '../data/seedSkaupat';
import { FOOD_ALV_RATE } from './alv';
import { normalizeLoose } from './fuzzyMatch';
import { isUsableLookupQuery } from './kruokaLookup';
import { skaupatSearchUrl } from './priceComparisonUrls';

export type SkaupatLookupSource = 'skaupat-proxy' | 'skaupat-seed';

export type SkaupatHit = {
  ean?: string;
  officialName: string;
  brand?: string;
  packSize?: string;
  /** Retail shelf € incl. food ALV */
  shelfPriceEur: number;
  unitPriceAlv0: number;
  sourceUrl: string;
  source: SkaupatLookupSource;
};

function shelfToAlv0(shelfEur: number): number {
  if (!Number.isFinite(shelfEur) || shelfEur <= 0) return 0;
  return Math.round((shelfEur / (1 + FOOD_ALV_RATE)) * 100) / 100;
}

function proxyBase(): string | null {
  const explicit = process.env.EXPO_PUBLIC_SKAUPAT_LOOKUP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/skaupat-lookup`;
  }
  return null;
}

/** Sync offline seed match for snappy list UIs (no network). */
export function lookupSkaupatSeedSync(
  query: string,
  ean?: string | null,
): SkaupatHit[] {
  return scoreSeed(query, ean?.replace(/\D/g, '') || null);
}

function scoreSeed(query: string, ean: string | null): SkaupatHit[] {
  const q = normalizeLoose(query);
  const hits: { hit: SkaupatHit; score: number }[] = [];

  for (const p of SEED_SKAUPAT_PRODUCTS) {
    const seedEan = (p.ean ?? '').replace(/\D/g, '');
    if (ean && seedEan && seedEan === ean) {
      hits.push({
        hit: {
          ean: p.ean,
          officialName: p.officialName,
          brand: p.brand,
          packSize: p.packSize,
          shelfPriceEur: p.shelfPriceEur,
          unitPriceAlv0: shelfToAlv0(p.shelfPriceEur),
          sourceUrl: skaupatSearchUrl(p.officialName),
          source: 'skaupat-seed',
        },
        score: 1,
      });
      continue;
    }
    if (!q) continue;
    const hay = normalizeLoose(
      [p.officialName, p.brand, ...(p.aliases ?? [])].filter(Boolean).join(' '),
    );
    if (!hay) continue;
    let score = 0;
    if (hay === q) score = 0.95;
    else if (hay.includes(q) || q.includes(hay)) score = 0.8;
    else {
      const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
      const matched = tokens.filter((t) => hay.includes(t)).length;
      if (matched) score = 0.45 + matched / Math.max(tokens.length, 1) * 0.35;
    }
    if (score >= 0.45) {
      hits.push({
        hit: {
          ean: p.ean,
          officialName: p.officialName,
          brand: p.brand,
          packSize: p.packSize,
          shelfPriceEur: p.shelfPriceEur,
          unitPriceAlv0: shelfToAlv0(p.shelfPriceEur),
          sourceUrl: skaupatSearchUrl(query || p.officialName),
          source: 'skaupat-seed',
        },
        score,
      });
    }
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .map((x) => x.hit);
}

async function searchViaProxy(
  query: string,
  ean: string | null,
  limit: number,
  preferLive = false,
): Promise<SkaupatHit[]> {
  const base = proxyBase();
  if (!base) return [];
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (ean) params.set('ean', ean);
    params.set('limit', String(limit));
    if (preferLive) params.set('_t', String(Date.now()));
    const res = await fetch(`${base}?${params}`, {
      headers: { accept: 'application/json' },
      ...(preferLive ? { cache: 'no-store' as RequestCache } : {}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      products?: Array<{
        ean?: string;
        officialName: string;
        brand?: string;
        packSize?: string;
        shelfPriceEur?: number;
        unitPriceAlv0?: number;
        sourceUrl?: string;
      }>;
      source?: string;
    };
    const products = data.products ?? [];
    return products
      .filter((p) => p.officialName && (p.shelfPriceEur ?? p.unitPriceAlv0))
      .map((p) => {
        const shelf =
          p.shelfPriceEur ??
          (p.unitPriceAlv0 != null
            ? Math.round(p.unitPriceAlv0 * (1 + FOOD_ALV_RATE) * 100) / 100
            : 0);
        return {
          ean: p.ean,
          officialName: p.officialName,
          brand: p.brand,
          packSize: p.packSize,
          shelfPriceEur: shelf,
          unitPriceAlv0: p.unitPriceAlv0 ?? shelfToAlv0(shelf),
          sourceUrl: p.sourceUrl ?? skaupatSearchUrl(query || p.officialName),
          source: 'skaupat-proxy' as const,
        };
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function lookupSkaupatProducts(opts: {
  query?: string;
  ean?: string | null;
  limit?: number;
  preferLive?: boolean;
}): Promise<SkaupatHit[]> {
  const limit = opts.limit ?? 5;
  const preferLive = Boolean(opts.preferLive);
  const ean = opts.ean?.replace(/\D/g, '') || null;
  const rawQuery = (opts.query ?? '').trim();
  const query = isUsableLookupQuery(rawQuery) ? rawQuery : '';
  if (!query && !ean) return [];

  const viaProxy = await searchViaProxy(
    query || ean || '',
    ean,
    limit,
    preferLive,
  );
  if (viaProxy.length) return viaProxy.slice(0, limit);

  // Seed is labeled offline data — not invented; used only when live/proxy empty
  return scoreSeed(query || ean || '', ean).slice(0, limit);
}
