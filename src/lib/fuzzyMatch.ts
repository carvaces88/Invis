import Fuse from 'fuse.js';
import type {
  Product,
  ProductMatch,
  ProductMatchKind,
  VisionExtract,
} from '../data/types';

type SearchRow = {
  product: Product;
  term: string;
  kind: ProductMatchKind;
};

/** Kitchen synonyms Fuse alone often misses (cilantro ↔ coriander). */
const SYNONYM_GROUPS: string[][] = [
  ['cilantro', 'coriander', 'korianteri', 'koriander'],
  ['parsley', 'persilja'],
  ['yogurt', 'yoghurt', 'jogurtti', 'jugurtti'],
  ['capers', 'kapris', 'caper', 'kapriksia'],
  [
    'tuuti',
    'tuuti2',
    'tuuti 2',
    'vieroitusvalmiste',
    'follow-on formula',
    'baby formula',
    'infant formula',
  ],
];

/** Minimum score to treat as a “strong similar” merge candidate. */
export const SIMILAR_MATCH_MIN = 0.35;

/**
 * Score at/above this → treat as the same catalog product already in stock.
 * Shown as “you already have this” (near-100% identity), not a fuzzy maybe.
 */
export const IDENTITY_MATCH_MIN = 0.9;

/** Auto-select / prefer confirm-existing over Add to DB. */
export const STRONG_MATCH_MIN = 0.85;

const STOP_TOKENS = new Set([
  'the',
  'and',
  'with',
  'in',
  'of',
  'a',
  'an',
  'ja',
  'tai',
  'g',
  'kg',
  'ml',
  'cl',
  'dl',
  'l',
  'pcs',
  'pc',
  'kpl',
]);

/**
 * Generic / placeholder tokens that must never drive a high-confidence catalog
 * or K-Ruoka identity match (e.g. stub "Unknown product" → Aldi "Unknown").
 */
const GENERIC_MATCH_TOKENS = new Set([
  'unknown',
  'product',
  'item',
  'container',
  'unrecognized',
  'n/a',
  'na',
  'null',
  'none',
  'test',
  'demo',
  'sample',
  'tuote',
  'tuntematon',
]);

export function isGenericMatchToken(token: string): boolean {
  return GENERIC_MATCH_TOKENS.has(normalizeLoose(token));
}

/** True when a vision/catalog name is only placeholders (not a real product). */
export function isGarbageProductName(name: string | null | undefined): boolean {
  const tokens = significantTokens(name ?? '');
  if (!tokens.length) return true;
  return tokens.every((t) => isGenericMatchToken(t));
}

function buildIndex(products: Product[]): SearchRow[] {
  const rows: SearchRow[] = [];
  for (const product of products) {
    rows.push({ product, term: product.officialName, kind: 'official' });
    for (const alias of product.aliases) {
      rows.push({ product, term: alias, kind: 'alias' });
    }
    if (product.packSize) {
      rows.push({
        product,
        term: `${product.officialName} ${product.packSize}`,
        kind: 'official',
      });
    }
    if (product.ean) {
      rows.push({ product, term: product.ean, kind: 'ean' });
    }
  }
  return rows;
}

function productTerms(
  product: Product,
): { term: string; kind: ProductMatchKind }[] {
  return [
    { term: product.officialName, kind: 'official' },
    ...product.aliases.map((a) => ({ term: a, kind: 'alias' as const })),
  ];
}

/** Case-fold + collapse whitespace; keep åäö for display equality checks. */
export function normalizeTerm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Loose compare: fold Finnish diacritics, strip punctuation. */
export function normalizeLoose(s: string): string {
  return normalizeTerm(s)
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEan(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

function normalizePack(s: string | null | undefined): string {
  return normalizeLoose(s ?? '').replace(/\s/g, '');
}

function significantTokens(s: string): string[] {
  return normalizeLoose(s)
    .split(' ')
    .filter(
      (t) =>
        t.length > 1 && !STOP_TOKENS.has(t) && !GENERIC_MATCH_TOKENS.has(t),
    );
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(significantTokens(a));
  const tb = new Set(significantTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function consider(
  map: Map<string, ProductMatch>,
  product: Product,
  score: number,
  matchedOn: ProductMatchKind,
  matchedTerm: string,
) {
  if (score <= 0) return;
  const existing = map.get(product.id);
  if (!existing || score > existing.score) {
    map.set(product.id, { product, score, matchedOn, matchedTerm });
  }
}

/** True when query equals official name or any alias (case-insensitive). */
export function isExactProductMatch(product: Product, query: string): boolean {
  const lower = normalizeTerm(query);
  if (!lower) return false;
  return productTerms(product).some(({ term }) => normalizeTerm(term) === lower);
}

/**
 * Exact hit on official name or alias. Prefers official when both match.
 */
export function exactProductMatch(
  products: Product[],
  query: string,
): ProductMatch | null {
  const lower = normalizeTerm(query);
  if (!lower) return null;

  let aliasHit: ProductMatch | null = null;
  for (const product of products) {
    if (normalizeTerm(product.officialName) === lower) {
      return {
        product,
        score: 1,
        matchedOn: 'official',
        matchedTerm: product.officialName,
      };
    }
    for (const alias of product.aliases) {
      if (normalizeTerm(alias) === lower) {
        aliasHit ??= {
          product,
          score: 1,
          matchedOn: 'alias',
          matchedTerm: alias,
        };
        break;
      }
    }
  }
  return aliasHit;
}

function synonymPeers(query: string): string[] {
  const lower = normalizeLoose(query);
  if (!lower) return [];
  const peers = new Set<string>();
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some(
      (g) =>
        normalizeLoose(g) === lower ||
        lower.includes(normalizeLoose(g)) ||
        normalizeLoose(g).includes(lower),
    );
    if (!hit) continue;
    for (const g of group) {
      if (normalizeLoose(g) !== lower) peers.add(g);
    }
  }
  return [...peers];
}

function applySynonymBoosts(
  products: Product[],
  query: string,
  bestByProduct: Map<string, ProductMatch>,
) {
  const peers = synonymPeers(query);
  if (!peers.length) return;

  for (const product of products) {
    for (const { term, kind } of productTerms(product)) {
      const t = normalizeLoose(term);
      const peer = peers.find(
        (p) =>
          t === normalizeLoose(p) ||
          t.includes(normalizeLoose(p)) ||
          normalizeLoose(p).includes(t),
      );
      if (!peer) continue;
      consider(bestByProduct, product, 0.92, kind, term);
    }
  }
}

/**
 * Identity signals from a vision extract against one catalog product.
 * Returns best score for that product (0 if no signal).
 */
export function identityScoreForProduct(
  product: Product,
  extract: VisionExtract,
): ProductMatch | null {
  const map = new Map<string, ProductMatch>();
  applyIdentitySignals(product, extract, map);
  return map.get(product.id) ?? null;
}

function applyIdentitySignals(
  product: Product,
  extract: VisionExtract,
  map: Map<string, ProductMatch>,
) {
  const eanQ = normalizeEan(extract.ean);
  const eanP = normalizeEan(product.ean);
  if (eanQ && eanP && eanQ === eanP) {
    consider(map, product, 1, 'ean', product.ean!);
  }

  const names = [
    extract.suggestedName,
    ...(extract.aliases ?? []),
    extract.brand ?? '',
  ].filter(Boolean);

  for (const name of names) {
    const q = normalizeTerm(name);
    const qLoose = normalizeLoose(name);
    if (!q) continue;

    if (normalizeTerm(product.officialName) === q) {
      consider(map, product, 1, 'official', product.officialName);
    } else if (normalizeLoose(product.officialName) === qLoose) {
      consider(map, product, 0.99, 'official', product.officialName);
    }

    for (const alias of product.aliases) {
      const a = normalizeTerm(alias);
      const aLoose = normalizeLoose(alias);
      if (isGarbageProductName(alias) || isGarbageProductName(name)) continue;
      if (a === q) {
        consider(map, product, 1, 'alias', alias);
      } else if (aLoose === qLoose) {
        consider(map, product, 0.99, 'alias', alias);
      } else if (
        aLoose.length >= 5 &&
        !isGenericMatchToken(aLoose) &&
        (qLoose.includes(aLoose) || aLoose.includes(qLoose))
      ) {
        // Informal vision name contained in alias (or reverse).
        // Require strong length ratio so "unknown" ≠ "unknown product".
        const ratio =
          Math.min(aLoose.length, qLoose.length) /
          Math.max(aLoose.length, qLoose.length);
        if (ratio < 0.72) continue;
        consider(
          map,
          product,
          ratio >= 0.85 ? 0.96 : 0.88,
          'alias',
          alias,
        );
      }
    }

    if (isGarbageProductName(name) || isGarbageProductName(product.officialName)) {
      // Placeholders never create official-name identity (Aldi Unknown trap)
    } else {
      const off = normalizeLoose(product.officialName);
      if (off.startsWith(qLoose) || qLoose.startsWith(off)) {
        consider(map, product, 0.97, 'official', product.officialName);
      } else if (off.includes(qLoose) && qLoose.length >= 5) {
        consider(map, product, 0.93, 'official', product.officialName);
      } else if (qLoose.includes(off) && off.length >= 6) {
        consider(map, product, 0.94, 'official', product.officialName);
      }
    }

    const j = tokenJaccard(name, product.officialName);
    if (j >= 0.7) {
      consider(map, product, Math.min(0.98, 0.8 + j * 0.2), 'vision', name);
    } else if (j >= 0.45) {
      consider(map, product, 0.75 + j * 0.2, 'vision', name);
    }

    for (const { term, kind } of productTerms(product)) {
      const jAlias = tokenJaccard(name, term);
      if (jAlias >= 0.65) {
        consider(map, product, Math.min(0.97, 0.82 + jAlias * 0.15), kind, term);
      }
    }
  }

  // Brand + pack size — strong kitchen identity when both agree
  const brandQ = normalizeLoose(extract.brand ?? '');
  const packQ = normalizePack(extract.packSize);
  const packP = normalizePack(product.packSize);
  const brandInOfficial = brandQ
    ? normalizeLoose(product.officialName).includes(brandQ) ||
      product.aliases.some((a) => normalizeLoose(a).includes(brandQ))
    : false;

  if (brandQ && brandQ.length >= 2 && brandInOfficial && packQ && packP) {
    if (packQ === packP || packP.includes(packQ) || packQ.includes(packP)) {
      consider(
        map,
        product,
        0.98,
        'brand_pack',
        `${extract.brand} ${product.packSize}`,
      );
    }
  } else if (brandQ && brandInOfficial && extract.confidence >= 0.8) {
    consider(map, product, 0.88, 'brand_pack', extract.brand!);
  }

  // High-confidence vision naming a known alias/official → near-certain
  if (extract.confidence >= 0.85) {
    const existing = map.get(product.id);
    if (existing && existing.score >= 0.75 && existing.score < 0.98) {
      consider(
        map,
        product,
        Math.min(0.99, existing.score + 0.12),
        'vision',
        existing.matchedTerm,
      );
    }
  }

  // Catalog listing image only confirms already-strong text/EAN identity —
  // never promote a weak fuzzy hit to 97% (false "Matched public K-Ruoka").
  if (
    (product.imageUrl || product.sourceUrl) &&
    map.get(product.id) &&
    (map.get(product.id)!.score ?? 0) >= 0.92
  ) {
    const cur = map.get(product.id)!;
    if (cur.matchedOn === 'ean') {
      consider(map, product, Math.min(1, Math.max(cur.score, 0.98)), 'ean', cur.matchedTerm);
    }
  }
}

/**
 * Inventory-first match for a vision extract: EAN → exact name/alias →
 * brand+pack → token / Fuse fuzzy. Prefer existing catalog over “add new”.
 */
export function matchExtractToCatalog(
  products: Product[],
  extract: VisionExtract,
  limit = 5,
): ProductMatch[] {
  const bestByProduct = new Map<string, ProductMatch>();

  for (const product of products) {
    applyIdentitySignals(product, extract, bestByProduct);
  }

  // Also run text search on suggested name + aliases for Fuse coverage
  const queries = [
    extract.suggestedName,
    ...(extract.aliases ?? []),
    extract.brand && extract.packSize
      ? `${extract.brand} ${extract.packSize}`
      : '',
    extract.ean ?? '',
  ].filter((q) => q.trim().length >= 2);

  for (const q of queries) {
    for (const m of searchProducts(products, q, limit * 2)) {
      consider(bestByProduct, m.product, m.score, m.matchedOn, m.matchedTerm);
    }
  }

  return [...bestByProduct.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function bestExtractMatch(
  products: Product[],
  extract: VisionExtract,
): ProductMatch | null {
  const results = matchExtractToCatalog(products, extract, 1);
  if (!results.length || results[0].score < SIMILAR_MATCH_MIN) return null;
  return results[0];
}

export function isStrongCatalogMatch(match: ProductMatch | null): boolean {
  return Boolean(match && match.score >= STRONG_MATCH_MIN);
}

export function isIdentityCatalogMatch(match: ProductMatch | null): boolean {
  return Boolean(match && match.score >= IDENTITY_MATCH_MIN);
}

/**
 * Ranked suggestions against official names + aliases.
 * Typing "capers" / "kapris" should surface Figaro Kapris…
 * Synonym groups help cilantro ↔ coriander ↔ korianteri.
 */
export function searchProducts(
  products: Product[],
  query: string,
  limit = 8,
): ProductMatch[] {
  const q = query.trim();
  if (!q) return [];

  const rows = buildIndex(products);
  const fuse = new Fuse(rows, {
    keys: ['term'],
    includeScore: true,
    // Slightly looser so coriander ↔ cilantro / korianteri can surface
    threshold: 0.52,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const hits = fuse.search(q, { limit: limit * 3 });
  const bestByProduct = new Map<string, ProductMatch>();

  for (const hit of hits) {
    const { product, term, kind } = hit.item;
    // Fuse score is 0 = perfect … 1 = miss. ~0.33 → ~67% without identity boosts.
    const score = 1 - (hit.score ?? 1);
    consider(bestByProduct, product, score, kind, term);
  }

  // Boost exact / prefix / containment hits (staff informal names)
  const lower = normalizeTerm(q);
  const loose = normalizeLoose(q);
  for (const product of products) {
    for (const { term, kind } of productTerms(product)) {
      const t = normalizeTerm(term);
      const tl = normalizeLoose(term);
      let boost = 0;
      if (t === lower || tl === loose) boost = 1;
      else if (t.startsWith(lower) || lower.startsWith(t)) boost = 0.95;
      else if (tl.startsWith(loose) || loose.startsWith(tl)) boost = 0.94;
      else if (t.includes(lower) && lower.length >= 3) boost = 0.9;
      else if (tl.includes(loose) && loose.length >= 3) boost = 0.88;
      else if (lower.includes(t) && t.length >= 3) boost = 0.9;
      else if (loose.includes(tl) && tl.length >= 3) boost = 0.88;
      else {
        const j = tokenJaccard(q, term);
        if (j >= 0.7) boost = 0.92;
        else if (j >= 0.5) boost = 0.8;
      }
      if (boost === 0) continue;
      consider(bestByProduct, product, boost, kind, term);
    }

    if (product.ean) {
      const pe = normalizeEan(product.ean);
      const qe = normalizeEan(q);
      if (pe && qe && (pe === qe || pe.endsWith(qe) || qe.endsWith(pe))) {
        consider(bestByProduct, product, 1, 'ean', product.ean);
      }
    }
  }

  applySynonymBoosts(products, q, bestByProduct);

  return [...bestByProduct.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function bestMatch(
  products: Product[],
  suggestedName: string,
): ProductMatch | null {
  const results = searchProducts(products, suggestedName, 1);
  if (!results.length || results[0].score < SIMILAR_MATCH_MIN) return null;
  return results[0];
}

/**
 * Strong similar catalog hits that are not an exact name/alias match.
 * Used for “Did you mean…?” merge-or-create.
 */
export function similarProductCandidates(
  products: Product[],
  query: string,
  limit = 5,
): ProductMatch[] {
  const q = query.trim();
  if (!q) return [];
  return searchProducts(products, q, limit + 4)
    .filter(
      (m) =>
        m.score >= SIMILAR_MATCH_MIN && !isExactProductMatch(m.product, q),
    )
    .slice(0, limit);
}
