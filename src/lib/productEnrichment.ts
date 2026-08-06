/**
 * Product close-up enrichment: live/stub vision → catalog FIRST → live K-Ruoka
 * (proxy / API / seed / Open Food Facts) → Add Product prefill.
 * Prefer existing inventory match; only suggest insert when unmatched.
 */
import { SEED_KRUOKA_PRODUCTS } from '../data/seedKruoka';
import type {
  IngredientType,
  Product,
  ProductEnrichment,
  UnitCode,
  VisionExtract,
} from '../data/types';
import { UNIT_LABELS } from '../data/units';
import {
  bestExtractMatch,
  bestMatch,
  isIdentityCatalogMatch,
} from './fuzzyMatch';
import { lookupKruokaForExtract } from './kruokaLookup';
import {
  containerLabelForUnit,
  extractEanFromText,
  inferPackaging,
  normalizeEanDigits,
} from './packaging';
import { generateProductAliases, mergeAliasLists } from './productAliases';
import { analyzeInventoryImage, analyzeProductCloseups } from './vision';

function inferBrand(officialName: string, aliases: string[]): string | undefined {
  const first = officialName.trim().split(/\s+/)[0];
  if (first && /^[A-ZÅÄÖ]/.test(first) && first.length > 1) return first;
  for (const a of aliases) {
    const word = a.trim().split(/\s+/)[0];
    if (word && word.length > 2) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }
  return undefined;
}

function resolvePackaging(
  unit: UnitCode,
  containerHint?: string | null,
  packSize?: string | null,
): { unit: UnitCode; containerHint: string } {
  const inferred = inferPackaging(containerHint, packSize, unit);
  if (inferred) {
    return {
      unit: inferred.unit ?? unit,
      containerHint: inferred.containerHint,
    };
  }
  return {
    unit,
    containerHint: containerLabelForUnit(unit) ?? unit,
  };
}

function buildAliases(opts: {
  officialName: string;
  brand?: string | null;
  packSize?: string | null;
  ean?: string | null;
  containerHint?: string | null;
  extra?: string[];
}): string[] {
  return generateProductAliases({
    officialName: opts.officialName,
    brand: opts.brand,
    packSize: opts.packSize,
    ean: opts.ean,
    containerHint: opts.containerHint,
    extra: opts.extra,
  });
}

function enrichmentFromProduct(
  product: Product,
  confidence: number,
  notes: string,
  matchedPublicListing: boolean,
  extract?: VisionExtract,
): ProductEnrichment {
  const brand =
    extract?.brand ?? inferBrand(product.officialName, product.aliases);
  const pack = resolvePackaging(
    product.unit,
    extract?.containerHint ?? null,
    product.packSize ?? extract?.packSize,
  );
  const ean = normalizeEanDigits(product.ean ?? extract?.ean) ?? undefined;
  const aliases = mergeAliasLists(
    buildAliases({
      officialName: product.officialName,
      brand,
      packSize: product.packSize ?? extract?.packSize,
      ean,
      containerHint: pack.containerHint,
      extra: [...product.aliases, ...(extract?.aliases ?? [])],
    }),
  );
  return {
    officialName: product.officialName,
    unit: pack.unit,
    packSize: product.packSize ?? extract?.packSize ?? undefined,
    unitPriceAlv0: product.unitPriceAlv0,
    brand,
    containerHint: pack.containerHint,
    ean,
    sourceUrl: product.sourceUrl,
    imageUrl: product.imageUrl,
    aliases,
    ingredientType: product.ingredientType,
    confidence,
    notes,
    matchedPublicListing,
  };
}

function enrichmentFromExtract(
  extract: VisionExtract,
  fallbackUnit: UnitCode = 'KPL',
): ProductEnrichment {
  const pack = resolvePackaging(
    extract.unit ?? fallbackUnit,
    extract.containerHint,
    extract.packSize,
  );
  const ean =
    normalizeEanDigits(extract.ean) ??
    extractEanFromText(
      [extract.suggestedName, ...(extract.aliases ?? []), extract.rawNotes ?? ''].join(
        ' ',
      ),
    ) ??
    undefined;
  const aliases = buildAliases({
    officialName: extract.suggestedName,
    brand: extract.brand,
    packSize: extract.packSize,
    ean,
    containerHint: pack.containerHint,
    extra: extract.aliases,
  });
  return {
    officialName: extract.suggestedName,
    unit: pack.unit,
    packSize: extract.packSize ?? undefined,
    unitPriceAlv0: extract.unitPriceAlv0 ?? undefined,
    brand: extract.brand ?? inferBrand(extract.suggestedName, aliases),
    containerHint: pack.containerHint,
    ean: ean ?? undefined,
    sourceUrl: extract.sourceUrl ?? undefined,
    imageUrl: extract.imageUrl ?? undefined,
    aliases,
    ingredientType: extract.ingredientType ?? undefined,
    confidence: extract.confidence,
    notes:
      extract.rawNotes ??
      extract.aiDescription ??
      'Label read from close-up photos',
    matchedPublicListing: Boolean(extract.sourceUrl || ean),
  };
}

/** Prefer EAN identity on seed/catalog before fuzzy name. */
function matchByEan(
  ean: string | null | undefined,
  catalog: Product[],
): Product | null {
  const q = normalizeEanDigits(ean);
  if (!q) return null;
  const inCatalog = catalog.find((p) => normalizeEanDigits(p.ean) === q);
  if (inCatalog) return inCatalog;
  return (
    SEED_KRUOKA_PRODUCTS.find((p) => normalizeEanDigits(p.ean) === q) ?? null
  );
}

/**
 * Sync match against live catalog FIRST, then offline K-Ruoka seed.
 * Prefer {@link matchExtractListingAsync} for full live lookups.
 */
export function matchPublicListing(
  suggestedName: string,
  catalog: Product[],
): { product: Product; fromKruoka: boolean } | null {
  const catalogHit = bestMatch(catalog, suggestedName);
  if (catalogHit && catalogHit.score >= 0.45) {
    const fromKruoka = catalogHit.product.id.startsWith('kruoka-');
    return { product: catalogHit.product, fromKruoka };
  }
  const kruokaHit = bestMatch(SEED_KRUOKA_PRODUCTS, suggestedName);
  if (kruokaHit && kruokaHit.score >= 0.45) {
    return { product: kruokaHit.product, fromKruoka: true };
  }
  return null;
}

/** Inventory-first match using full VisionExtract identity signals (seed only). */
export function matchExtractListing(
  extract: VisionExtract,
  catalog: Product[],
): { product: Product; fromKruoka: boolean; score: number } | null {
  const byEan = matchByEan(extract.ean, catalog);
  if (byEan) {
    return {
      product: byEan,
      fromKruoka: byEan.id.startsWith('kruoka-'),
      score: 1,
    };
  }

  const catalogHit = bestExtractMatch(catalog, extract);
  if (catalogHit && catalogHit.score >= 0.45) {
    return {
      product: catalogHit.product,
      fromKruoka: catalogHit.product.id.startsWith('kruoka-'),
      score: catalogHit.score,
    };
  }
  const kruokaHit = bestExtractMatch(SEED_KRUOKA_PRODUCTS, extract);
  if (kruokaHit && kruokaHit.score >= 0.45) {
    return {
      product: kruokaHit.product,
      fromKruoka: true,
      score: kruokaHit.score,
    };
  }
  return null;
}

/** Catalog → live K-Ruoka / proxy / OFF cascade. */
export async function matchExtractListingAsync(
  extract: VisionExtract,
  catalog: Product[],
): Promise<{
  product: Product;
  fromKruoka: boolean;
  score: number;
  liveSource?: string;
} | null> {
  const local = matchExtractListing(extract, catalog);
  // Strong inventory / seed identity match — skip network
  if (local && local.score >= 0.85 && !local.fromKruoka) {
    return local;
  }
  if (
    local &&
    local.fromKruoka &&
    local.score >= 0.85 &&
    (extract.ean == null ||
      normalizeEanDigits(local.product.ean) === normalizeEanDigits(extract.ean))
  ) {
    return local;
  }

  const live = await lookupKruokaForExtract(extract);
  if (live) {
    // Prefer existing catalog row when EAN/name already stocked
    if (live.hit.ean) {
      const inStock = catalog.find(
        (p) =>
          normalizeEanDigits(p.ean) === normalizeEanDigits(live.hit.ean),
      );
      if (inStock) {
        return {
          product: {
            ...inStock,
            packSize: live.product.packSize ?? inStock.packSize,
            unitPriceAlv0:
              live.product.unitPriceAlv0 > 0
                ? live.product.unitPriceAlv0
                : inStock.unitPriceAlv0,
            sourceUrl: live.product.sourceUrl ?? inStock.sourceUrl,
            imageUrl: live.product.imageUrl ?? inStock.imageUrl,
          },
          fromKruoka: true,
          score: Math.max(live.score, 0.9),
          liveSource: live.hit.source,
        };
      }
    }
    return {
      product: live.product,
      fromKruoka: true,
      score: live.score,
      liveSource: live.hit.source,
    };
  }

  return local;
}

/**
 * Analyze a series of close-up photos and prefill Add Product fields.
 * Uses vision + live K-Ruoka lookup (with seed / OFF fallbacks).
 */
export async function enrichProductFromPhotos(
  photoUris: string[],
  catalog: Product[],
  hint?: string,
): Promise<ProductEnrichment> {
  const extract =
    photoUris.length > 1
      ? await analyzeProductCloseups(photoUris, hint)
      : await analyzeInventoryImage(photoUris[0] ?? 'demo', hint);

  const listing = await matchExtractListingAsync(extract, catalog);
  if (listing) {
    const { product, fromKruoka, score, liveSource } = listing;
    const alreadyInStock =
      !fromKruoka ||
      catalog.some(
        (p) =>
          p.id === product.id ||
          (p.ean &&
            product.ean &&
            normalizeEanDigits(p.ean) === normalizeEanDigits(product.ean)),
      );
    const source = isIdentityCatalogMatch({
      product,
      score,
      matchedOn: 'vision',
      matchedTerm: extract.suggestedName,
    })
      ? alreadyInStock
        ? 'Already in catalog / inventory'
        : 'Matched public K-Ruoka listing'
      : fromKruoka
        ? liveSource === 'openfoodfacts'
          ? 'Matched Open Food Facts · K-Ruoka link'
          : liveSource === 'kruoka-seed'
            ? 'Matched offline K-Ruoka seed'
            : 'Matched live K-Ruoka listing'
        : 'Matched inventory / supplier catalog';
    const brand = extract.brand ?? inferBrand(product.officialName, product.aliases);
    const pack = resolvePackaging(
      product.unit,
      extract.containerHint,
      product.packSize ?? extract.packSize,
    );
    const notes = [
      source,
      `${Math.round(score * 100)}% match`,
      brand ? `Brand: ${brand}` : null,
      pack.containerHint ? `Packaging: ${pack.containerHint}` : null,
      product.packSize ? `Size: ${product.packSize}` : null,
      product.unitPriceAlv0 > 0
        ? `Price 0% ALV: €${product.unitPriceAlv0.toFixed(2)}`
        : null,
      product.ean ? `EAN: ${product.ean}` : null,
      extract.rawNotes,
    ]
      .filter(Boolean)
      .join(' · ');

    return enrichmentFromProduct(
      product,
      Math.max(extract.confidence, score),
      notes,
      true,
      extract,
    );
  }

  const base = enrichmentFromExtract(extract);
  return {
    ...base,
    notes: [
      base.notes,
      base.brand ? `Brand: ${base.brand}` : null,
      base.containerHint ? `Packaging: ${base.containerHint}` : null,
      `Unit: ${UNIT_LABELS[base.unit]}`,
      'No inventory match — review suggested fields to add as new',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Sync seed/catalog-only enrich (no network). */
export function enrichFromExtract(
  extract: VisionExtract,
  catalog: Product[],
): ProductEnrichment {
  const listing = matchExtractListing(extract, catalog);
  if (listing) {
    const { product, fromKruoka, score } = listing;
    return enrichmentFromProduct(
      {
        ...product,
        packSize: extract.packSize ?? product.packSize,
        unitPriceAlv0:
          extract.unitPriceAlv0 != null
            ? extract.unitPriceAlv0
            : product.unitPriceAlv0,
        ean: extract.ean ?? product.ean,
        sourceUrl: extract.sourceUrl ?? product.sourceUrl,
        imageUrl: extract.imageUrl ?? product.imageUrl,
      },
      Math.max(extract.confidence, score),
      isIdentityCatalogMatch({
        product,
        score,
        matchedOn: 'vision',
        matchedTerm: extract.suggestedName,
      })
        ? 'Already in catalog — confirm existing product'
        : fromKruoka
          ? 'Prefill from scan + K-Ruoka seed'
          : 'Prefill from scan + catalog match',
      true,
      extract,
    );
  }
  return enrichmentFromExtract(extract);
}

/** Async enrich with live K-Ruoka / full lookup cascade. */
export async function enrichFromExtractAsync(
  extract: VisionExtract,
  catalog: Product[],
): Promise<ProductEnrichment> {
  const listing = await matchExtractListingAsync(extract, catalog);
  if (listing) {
    const { product, fromKruoka, score, liveSource } = listing;
    const note =
      isIdentityCatalogMatch({
        product,
        score,
        matchedOn: 'vision',
        matchedTerm: extract.suggestedName,
      })
        ? 'Already in catalog — confirm existing product'
        : fromKruoka
          ? liveSource === 'openfoodfacts'
            ? 'Prefill from scan + Open Food Facts / K-Ruoka'
            : liveSource === 'kruoka-seed'
              ? 'Prefill from scan + K-Ruoka seed'
              : 'Prefill from scan + live K-Ruoka'
          : 'Prefill from scan + catalog match';
    return enrichmentFromProduct(
      {
        ...product,
        packSize: extract.packSize ?? product.packSize,
        unitPriceAlv0:
          extract.unitPriceAlv0 != null && extract.unitPriceAlv0 > 0
            ? extract.unitPriceAlv0
            : product.unitPriceAlv0,
        ean: extract.ean ?? product.ean,
        sourceUrl: extract.sourceUrl ?? product.sourceUrl,
        imageUrl: extract.imageUrl ?? product.imageUrl,
      },
      Math.max(extract.confidence, score),
      note,
      true,
      extract,
    );
  }
  return enrichmentFromExtract(extract);
}

export function enrichmentToExtract(e: ProductEnrichment): VisionExtract {
  return {
    suggestedName: e.officialName,
    unit: e.unit,
    quantity: 1,
    unitPriceAlv0: e.unitPriceAlv0 ?? null,
    expiryDate: null,
    confidence: e.confidence,
    rawNotes: e.notes,
    packSize: e.packSize ?? null,
    brand: e.brand ?? null,
    containerHint: e.containerHint ?? null,
    ean: e.ean ?? null,
    sourceUrl: e.sourceUrl ?? null,
    imageUrl: e.imageUrl ?? null,
    aliases: e.aliases,
    ingredientType: (e.ingredientType ?? null) as IngredientType | null,
  };
}
