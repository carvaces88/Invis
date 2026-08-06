/**
 * Product close-up enrichment: live/stub vision → catalog FIRST → K-Ruoka seed → Add Product prefill.
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
import { analyzeInventoryImage, analyzeProductCloseups } from './vision';

const CONTAINER_BY_UNIT: Partial<Record<UnitCode, string>> = {
  PRK: 'Purkki (can / jar)',
  RSA: 'Rasia (box / container)',
  RAS: 'Rasia (box / container)',
  PSS: 'Pussi (bag / pouch)',
  PL: 'Pullo (bottle)',
  PLO: 'Pullo (bottle)',
  LTK: 'Laatikko (crate / box)',
  PKT: 'Paketti (packet / package)',
  L: 'Litra (liquid volume)',
  KG: 'Kilogramma (weight)',
  KPL: 'Kappale (piece / item)',
};

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

function containerFor(unit: UnitCode, override?: string | null): string | undefined {
  if (override?.trim()) return override.trim();
  return CONTAINER_BY_UNIT[unit];
}

function enrichmentFromProduct(
  product: Product,
  confidence: number,
  notes: string,
  matchedPublicListing: boolean,
): ProductEnrichment {
  const brand = inferBrand(product.officialName, product.aliases);
  const containerHint = containerFor(product.unit);
  return {
    officialName: product.officialName,
    unit: product.unit,
    packSize: product.packSize,
    unitPriceAlv0: product.unitPriceAlv0,
    brand,
    containerHint,
    ean: product.ean,
    sourceUrl: product.sourceUrl,
    imageUrl: product.imageUrl,
    aliases: [...product.aliases],
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
  const unit = extract.unit ?? fallbackUnit;
  const aliases = extract.aliases?.length
    ? [...extract.aliases]
    : [extract.suggestedName];
  return {
    officialName: extract.suggestedName,
    unit,
    packSize: extract.packSize ?? undefined,
    unitPriceAlv0: extract.unitPriceAlv0 ?? undefined,
    brand: extract.brand ?? inferBrand(extract.suggestedName, aliases),
    containerHint: containerFor(unit, extract.containerHint),
    ean: extract.ean ?? undefined,
    sourceUrl: extract.sourceUrl ?? undefined,
    imageUrl: extract.imageUrl ?? undefined,
    aliases,
    ingredientType: extract.ingredientType ?? undefined,
    confidence: extract.confidence,
    notes:
      extract.rawNotes ??
      extract.aiDescription ??
      'Label read from close-up photos',
    matchedPublicListing: Boolean(extract.sourceUrl || extract.ean),
  };
}

/**
 * Match vision extract against live catalog FIRST (EAN / name / alias / brand+pack),
 * then K-Ruoka public seed.
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

/** Inventory-first match using full VisionExtract identity signals. */
export function matchExtractListing(
  extract: VisionExtract,
  catalog: Product[],
): { product: Product; fromKruoka: boolean; score: number } | null {
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

/**
 * Analyze a series of close-up photos and prefill Add Product fields.
 * Uses vision stub + offline K-Ruoka / catalog public data (live web later).
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

  const listing = matchExtractListing(extract, catalog);
  if (listing) {
    const { product, fromKruoka, score } = listing;
    const alreadyInStock = !fromKruoka || catalog.some((p) => p.id === product.id);
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
        ? 'Matched public K-Ruoka listing'
        : 'Matched inventory / supplier catalog';
    const brand = inferBrand(product.officialName, product.aliases);
    const container =
      extract.containerHint ?? containerFor(product.unit);
    const notes = [
      source,
      `${Math.round(score * 100)}% match`,
      brand ? `Brand: ${brand}` : null,
      container ? `Container: ${container}` : null,
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
    );
  }

  const base = enrichmentFromExtract(extract);
  return {
    ...base,
    notes: [
      base.notes,
      base.brand ? `Brand: ${base.brand}` : null,
      base.containerHint ? `Container: ${base.containerHint}` : null,
      `Unit: ${UNIT_LABELS[base.unit]}`,
      'No inventory match — review suggested fields to add as new',
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Build enrichment from an existing VisionExtract (Confirm / Fridge → Add). */
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
        // Prefer extract overrides when richer
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
          ? 'Prefill from scan + K-Ruoka public data'
          : 'Prefill from scan + catalog match',
      true,
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
