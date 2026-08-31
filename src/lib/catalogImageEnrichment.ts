/**
 * Background catalog packshot enrichment from K-Ruoka / OFF cascade.
 * Persists imageUrl (and missing packSize/EAN/source) via catalog field extras.
 */
import { productImageSource } from '../data/seedKruoka';
import type { Product } from '../data/types';
import { lookupKruokaProducts } from './kruokaLookup';

const triedIds = new Set<string>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type CatalogImageFieldUpdate = {
  packSize?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  ean?: string | null;
};

/**
 * Enrich products that still lack a packshot. Safe to call repeatedly —
 * skips ids already attempted this session.
 */
export async function enrichCatalogImages(
  products: Product[],
  updateFields: (productId: string, fields: CatalogImageFieldUpdate) => void,
  opts?: { delayMs?: number; limit?: number; signal?: { cancelled: boolean } },
): Promise<number> {
  const delayMs = opts?.delayMs ?? 450;
  const limit = opts?.limit ?? 40;
  const missing = products.filter(
    (p) => !productImageSource(p) && !triedIds.has(p.id),
  );
  let updated = 0;

  for (const product of missing.slice(0, limit)) {
    if (opts?.signal?.cancelled) break;
    triedIds.add(product.id);
    try {
      const hits = await lookupKruokaProducts({
        query: [product.officialName, product.packSize]
          .filter(Boolean)
          .join(' '),
        ean: product.ean,
        limit: 3,
        preferLive: true,
      });
      const hit =
        hits.find((h) => h.imageUrl?.trim()) ??
        hits[0] ??
        null;
      if (!hit?.imageUrl?.trim()) continue;

      updateFields(product.id, {
        imageUrl: hit.imageUrl,
        sourceUrl: hit.sourceUrl || product.sourceUrl || null,
        packSize: product.packSize?.trim()
          ? undefined
          : hit.packSize || null,
        ean: product.ean?.trim() ? undefined : hit.ean || null,
      });
      updated += 1;
    } catch {
      // keep going — Cloudflare / network blips are expected
    }
    await sleep(delayMs);
  }

  return updated;
}

export function resetCatalogImageEnrichmentTried() {
  triedIds.clear();
}
