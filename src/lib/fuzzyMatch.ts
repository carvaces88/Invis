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
    'kurkku',
    'kurkkuja',
    'cucumber',
    'cucumbers',
    'gurka',
    'gurkor',
    'finska gurkor',
  ],
  [
    'mayo',
    'mayonnaise',
    'majoneesi',
    'vegan mayo',
    'vege mayo',
    'vegaaninen majoneesi',
    'vegaaninen majo',
  ],
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

/**
 * True when query and catalog term describe the same SKU identity-wise.
 * Blocks "Arla Pro Crème Fraîche 28% 1,8 kg" ≡ alias "crème fraîche" /
 * official "Smetana" — short category words must not identity-match a
 * longer branded label.
 */
export function namesIdentityCompatible(
  query: string,
  matchedTerm: string,
): boolean {
  const qTokens = significantTokens(query);
  const tTokens = significantTokens(matchedTerm);
  if (!qTokens.length || !tTokens.length) return false;

  // Every catalog-term token should appear in the query (or vice versa when
  // query is the shorter informal name).
  const qSet = new Set(qTokens);
  const tSet = new Set(tTokens);
  const termCovered = tTokens.filter((t) => qSet.has(t)).length;
  const queryCovered = qTokens.filter((t) => tSet.has(t)).length;

  if (termCovered < tTokens.length && queryCovered < qTokens.length) {
    return false;
  }

  // Branded / pack-rich query vs short category alias → not the same SKU.
  if (qTokens.length >= tTokens.length + 2) return false;
  if (tTokens.length >= qTokens.length + 2) return false;

  return true;
}

/** Jaccard overlap of significant tokens between two product labels. */
export function visionCatalogTokenOverlap(
  extract: VisionExtract,
  product: Product,
): number {
  const vision = [extract.suggestedName, extract.brand ?? '']
    .filter(Boolean)
    .join(' ');
  return tokenJaccard(vision, product.officialName);
}

type PackFamily = 'crate' | 'tub' | 'bottle' | 'bag' | 'other';

function packagingFamily(
  hint: string | null | undefined,
  unit?: string | null,
): PackFamily {
  const h = normalizeLoose(hint ?? '');
  const u = (unit ?? '').toUpperCase();
  if (u === 'LTK' || /laatikko|crate|cardboard|laatik/.test(h)) return 'crate';
  if (
    u === 'PRK' ||
    /purkki|astia|bucket|tub|jar|kannu|mayo|majoneesi/.test(h)
  ) {
    return 'tub';
  }
  if (u === 'PL' || u === 'PLO' || /pullo|bottle/.test(h)) return 'bottle';
  if (u === 'PSS' || /pussi|bag|pouch/.test(h)) return 'bag';
  return 'other';
}

/** Ingredient families that must not identity-match each other. */
const INCOMPATIBLE_INGREDIENT_PAIRS = new Set([
  'produce|sauces',
  'sauces|produce',
  'produce|dairy',
  'dairy|produce',
  'produce|oils',
  'oils|produce',
  'produce|meat',
  'meat|produce',
  'produce|poultry',
  'poultry|produce',
  'produce|bakery',
  'bakery|produce',
  'produce|deli',
  'deli|produce',
  'produce|frozen',
  'frozen|produce',
]);

function brandAppearsInProduct(brand: string, product: Product): boolean {
  const b = normalizeLoose(brand);
  if (b.length < 3) return true;
  const hay = normalizeLoose(
    [product.officialName, ...product.aliases].join(' '),
  );
  if (hay.includes(b)) return true;
  const tokens = significantTokens(brand).filter((t) => t.length >= 3);
  if (!tokens.length) return true;
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length >= Math.max(1, Math.ceil(tokens.length * 0.5));
}

function productBrandInVision(product: Product, extract: VisionExtract): boolean {
  const first = significantTokens(product.officialName)[0];
  if (!first || first.length < 3) return true;
  const hay = normalizeLoose(
    [extract.suggestedName, extract.brand ?? '', ...(extract.aliases ?? [])].join(
      ' ',
    ),
  );
  return hay.includes(first);
}

/**
 * True when vision label/brand/packaging clearly describes a different
 * physical product than the catalog row (e.g. cucumber crate vs mayo tub).
 * Used to reject false EAN / fuzzy “already have” identity.
 */
export function visionContradictsProduct(
  extract: VisionExtract,
  product: Product,
): boolean {
  const brand = extract.brand?.trim() ?? '';
  if (brand.length >= 4) {
    const brandOk = brandAppearsInProduct(brand, product);
    const productBrandOk = productBrandInVision(product, extract);
    if (!brandOk && !productBrandOk) return true;
  }

  if (
    extract.ingredientType &&
    product.ingredientType &&
    INCOMPATIBLE_INGREDIENT_PAIRS.has(
      `${extract.ingredientType}|${product.ingredientType}`,
    )
  ) {
    return true;
  }

  const visionPack = packagingFamily(extract.containerHint, extract.unit);
  const productPack = packagingFamily(null, product.unit);
  if (
    visionPack !== 'other' &&
    productPack !== 'other' &&
    visionPack !== productPack
  ) {
    // Crate of produce vs jar/tub sauce is the classic false identity.
    if (
      (visionPack === 'crate' && productPack === 'tub') ||
      (visionPack === 'tub' && productPack === 'crate')
    ) {
      return true;
    }
  }

  const visionLabel = [extract.suggestedName, extract.brand ?? '']
    .filter(Boolean)
    .join(' ');
  if (
    !isGarbageProductName(extract.suggestedName) &&
    !isGarbageProductName(product.officialName)
  ) {
    const overlap = tokenJaccard(visionLabel, product.officialName);
    const vTokens = significantTokens(visionLabel);
    const pTokens = significantTokens(product.officialName);
    if (vTokens.length >= 2 && pTokens.length >= 2 && overlap < 0.12) {
      // Allow same-brand variants (Valio milk ↔ Valio yogurt) when brand overlaps.
      if (brand.length >= 4 && brandAppearsInProduct(brand, product)) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/** Cap for suggestion-band scores (below “already have” identity). */
const SUGGESTION_SCORE_CAP = IDENTITY_MATCH_MIN - 0.01;

/**
 * Cap when a distinct SKU label is parked on the wrong catalog row —
 * below STRONG_MATCH_MIN so Confirm/Fridge do not auto-select it.
 */
const WRONG_ALIAS_SCORE_CAP = STRONG_MATCH_MIN - 0.15;

/**
 * Labels that name a distinct retail SKU and must never identity-match a
 * different official catalog name (persisted bad seed aliases, etc.).
 */
const DISTINCT_SKU_LABELS = new Set(
  [
    'creme fraiche',
    'crème fraîche',
    'creme fraîche',
    'créme fraiche',
    'cremefraiche',
    'crème fraiche',
  ].flatMap((s) => {
    const loose = normalizeLoose(s);
    return [loose, loose.replace(/\s/g, '')];
  }),
);

function aliasAllowedForIdentity(product: Product, alias: string): boolean {
  const a = normalizeLoose(alias);
  const aCompact = a.replace(/\s/g, '');
  if (!DISTINCT_SKU_LABELS.has(a) && !DISTINCT_SKU_LABELS.has(aCompact)) {
    return true;
  }
  const off = normalizeLoose(product.officialName);
  const offCompact = off.replace(/\s/g, '');
  return (
    DISTINCT_SKU_LABELS.has(off) ||
    DISTINCT_SKU_LABELS.has(offCompact) ||
    offCompact.includes('cremefraiche') ||
    off.includes('creme fraiche')
  );
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

/** Force-demote a match (unlike consider, may lower the stored score). */
function demote(
  map: Map<string, ProductMatch>,
  productId: string,
  maxScore: number,
) {
  const existing = map.get(productId);
  if (!existing || existing.score <= maxScore) return;
  map.set(productId, { ...existing, score: maxScore });
}

/**
 * Strip identity-band scores from distinct-SKU aliases parked on the wrong
 * product (e.g. persisted "crème fraîche" on Smetana) and from branded labels
 * that only share a short category word.
 */
function sanitizeIdentityScores(
  map: Map<string, ProductMatch>,
  primaryQuery?: string,
) {
  for (const [id, m] of map) {
    if (m.score < IDENTITY_MATCH_MIN) continue;
    if (m.matchedOn === 'ean') continue;
    if (m.matchedOn === 'brand_pack' && m.score >= 0.95) continue;

    if (
      m.matchedOn === 'alias' &&
      !aliasAllowedForIdentity(m.product, m.matchedTerm)
    ) {
      demote(map, id, WRONG_ALIAS_SCORE_CAP);
      continue;
    }

    const q = primaryQuery?.trim() || m.matchedTerm;
    if (
      (m.matchedOn === 'alias' ||
        m.matchedOn === 'official' ||
        m.matchedOn === 'vision') &&
      !namesIdentityCompatible(q, m.matchedTerm) &&
      !namesIdentityCompatible(q, m.product.officialName)
    ) {
      // Keep as weak suggestion — never auto-select / “already have”
      demote(map, id, Math.min(SUGGESTION_SCORE_CAP, STRONG_MATCH_MIN - 0.01));
    }
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
  // Never trust a hallucinated / wrong EAN over clear visual contradiction
  // (cucumber crate + mayo EAN → reject identity).
  if (
    eanQ &&
    eanP &&
    eanQ === eanP &&
    !visionContradictsProduct(extract, product)
  ) {
    consider(map, product, 1, 'ean', product.ean!);
  }

  const primaryName = extract.suggestedName?.trim() || '';
  const names = [
    primaryName,
    ...(extract.aliases ?? []),
    extract.brand ?? '',
  ].filter(Boolean);

  for (const name of names) {
    const q = normalizeTerm(name);
    const qLoose = normalizeLoose(name);
    if (!q) continue;

    // Secondary extract aliases may suggest, but must not alone claim identity
    // (AI often adds "Crème Fraîche" while primary is a full branded SKU).
    const isPrimary =
      normalizeTerm(name) === normalizeTerm(primaryName) ||
      (!primaryName && name === names[0]);
    const identityOk = (term: string) =>
      isPrimary && namesIdentityCompatible(name, term);
    const cap = (score: number, term: string) =>
      identityOk(term) ? score : Math.min(score, SUGGESTION_SCORE_CAP);

    if (normalizeTerm(product.officialName) === q) {
      consider(
        map,
        product,
        cap(1, product.officialName),
        'official',
        product.officialName,
      );
    } else if (normalizeLoose(product.officialName) === qLoose) {
      consider(
        map,
        product,
        cap(0.99, product.officialName),
        'official',
        product.officialName,
      );
    }

    for (const alias of product.aliases) {
      const a = normalizeTerm(alias);
      const aLoose = normalizeLoose(alias);
      if (isGarbageProductName(alias) || isGarbageProductName(name)) continue;
      const allowIdentity = aliasAllowedForIdentity(product, alias);
      if (a === q) {
        consider(
          map,
          product,
          allowIdentity ? cap(1, alias) : Math.min(1, WRONG_ALIAS_SCORE_CAP),
          'alias',
          alias,
        );
      } else if (aLoose === qLoose) {
        consider(
          map,
          product,
          allowIdentity
            ? cap(0.99, alias)
            : Math.min(0.99, WRONG_ALIAS_SCORE_CAP),
          'alias',
          alias,
        );
      } else if (
        aLoose.length >= 5 &&
        !isGenericMatchToken(aLoose) &&
        (qLoose.includes(aLoose) || aLoose.includes(qLoose))
      ) {
        // Informal vision name contained in alias (or reverse).
        // Require strong length ratio so "unknown" ≠ "unknown product".
        // Always suggestion-band — containment is never SKU identity.
        const ratio =
          Math.min(aLoose.length, qLoose.length) /
          Math.max(aLoose.length, qLoose.length);
        if (ratio < 0.72) continue;
        consider(
          map,
          product,
          Math.min(0.88, SUGGESTION_SCORE_CAP),
          'alias',
          alias,
        );
      }
    }

    if (isGarbageProductName(name) || isGarbageProductName(product.officialName)) {
      // Placeholders never create official-name identity (Aldi Unknown trap)
    } else {
      const off = normalizeLoose(product.officialName);
      const offTerm = product.officialName;
      if (off.startsWith(qLoose) || qLoose.startsWith(off)) {
        consider(
          map,
          product,
          cap(0.97, offTerm),
          'official',
          offTerm,
        );
      } else if (off.includes(qLoose) && qLoose.length >= 5) {
        consider(
          map,
          product,
          Math.min(0.93, SUGGESTION_SCORE_CAP),
          'official',
          offTerm,
        );
      } else if (qLoose.includes(off) && off.length >= 6) {
        // "… smetana …" inside a longer label is weak — never identity
        consider(
          map,
          product,
          Math.min(0.88, SUGGESTION_SCORE_CAP),
          'official',
          offTerm,
        );
      }
    }

    const j = tokenJaccard(name, product.officialName);
    if (j >= 0.7 && identityOk(product.officialName)) {
      consider(map, product, Math.min(0.98, 0.8 + j * 0.2), 'vision', name);
    } else if (j >= 0.7) {
      consider(
        map,
        product,
        Math.min(0.8 + j * 0.2, SUGGESTION_SCORE_CAP),
        'vision',
        name,
      );
    } else if (j >= 0.45) {
      consider(map, product, 0.75 + j * 0.2, 'vision', name);
    }

    for (const { term, kind } of productTerms(product)) {
      const jAlias = tokenJaccard(name, term);
      if (jAlias < 0.65) continue;
      const raw = Math.min(0.97, 0.82 + jAlias * 0.15);
      const ok =
        identityOk(term) &&
        (kind !== 'alias' || aliasAllowedForIdentity(product, term));
      consider(
        map,
        product,
        ok
          ? raw
          : Math.min(
              raw,
              kind === 'alias' && !aliasAllowedForIdentity(product, term)
                ? WRONG_ALIAS_SCORE_CAP
                : SUGGESTION_SCORE_CAP,
            ),
        kind,
        term,
      );
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
    // Brand alone is suggestion-band, not identity
    consider(map, product, 0.88, 'brand_pack', extract.brand!);
  }

  // High-confidence vision may bump a strong hit — never into identity unless
  // evidence is already EAN / brand+pack / compatible exact name.
  if (extract.confidence >= 0.85) {
    const existing = map.get(product.id);
    if (existing && existing.score >= 0.75 && existing.score < 0.98) {
      const hard =
        existing.matchedOn === 'ean' ||
        existing.matchedOn === 'brand_pack' ||
        ((existing.matchedOn === 'official' || existing.matchedOn === 'alias') &&
          namesIdentityCompatible(primaryName || existing.matchedTerm, existing.matchedTerm));
      const bumped = Math.min(0.99, existing.score + 0.12);
      consider(
        map,
        product,
        hard ? bumped : Math.min(bumped, SUGGESTION_SCORE_CAP),
        existing.matchedOn === 'vision' ? 'vision' : existing.matchedOn,
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

  sanitizeIdentityScores(bestByProduct, extract.suggestedName);

  // Hard demote catalog rows that contradict visible brand / category / pack.
  for (const [id, m] of bestByProduct) {
    if (visionContradictsProduct(extract, m.product)) {
      demote(bestByProduct, id, 0.2);
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
  if (visionContradictsProduct(extract, results[0].product)) return null;
  return results[0];
}

export function isStrongCatalogMatch(
  match: ProductMatch | null,
  extract?: VisionExtract | null,
): boolean {
  if (!match || match.score < STRONG_MATCH_MIN) return false;
  if (extract && visionContradictsProduct(extract, match.product)) return false;
  return true;
}

/**
 * ≥90% “already have” only for EAN, strong brand+pack, or exact/near-exact
 * official/alias scores — not vision/fuzzy dairy word overlap.
 * Optional extract: brand/category contradictions never count as identity.
 */
export function isIdentityCatalogMatch(
  match: ProductMatch | null,
  extract?: VisionExtract | null,
): boolean {
  if (!match || match.score < IDENTITY_MATCH_MIN) return false;
  if (extract && visionContradictsProduct(extract, match.product)) return false;
  // Exact official/alias hits are identity even when informal speech differs
  // from the POS title (e.g. “vegan mayo” ↔ Majoneesi L) — do not require
  // Jaccard overlap with officialName.
  if (match.matchedOn === 'ean') return true;
  if (match.matchedOn === 'brand_pack') return match.score >= 0.95;
  if (match.matchedOn === 'official' || match.matchedOn === 'alias') {
    if (
      extract &&
      !namesIdentityCompatible(extract.suggestedName, match.matchedTerm) &&
      !namesIdentityCompatible(extract.suggestedName, match.product.officialName)
    ) {
      // Fuzzy high score on a loosely related term — not “already have”
      const overlap = visionCatalogTokenOverlap(extract, match.product);
      if (overlap < 0.2) return false;
    }
    return true;
  }
  if (extract) {
    const overlap = visionCatalogTokenOverlap(extract, match.product);
    if (
      overlap < 0.2 &&
      !(extract.brand && brandAppearsInProduct(extract.brand, match.product))
    ) {
      return false;
    }
  }
  if (match.matchedOn === 'vision') return false;
  return false;
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
    let score = 1 - (hit.score ?? 1);
    if (kind === 'alias' && !aliasAllowedForIdentity(product, term)) {
      score = Math.min(score, WRONG_ALIAS_SCORE_CAP);
    } else if (!namesIdentityCompatible(q, term) && score >= IDENTITY_MATCH_MIN) {
      score = Math.min(score, SUGGESTION_SCORE_CAP);
    }
    consider(bestByProduct, product, score, kind, term);
  }

      // Boost exact / prefix / containment hits (staff informal names)
  const lower = normalizeTerm(q);
  const loose = normalizeLoose(q);
  for (const product of products) {
    for (const { term, kind } of productTerms(product)) {
      if (kind === 'alias' && !aliasAllowedForIdentity(product, term)) {
        // Distinct SKU label parked on the wrong product — suggestion only
        const tl = normalizeLoose(term);
        if (tl === loose || loose.includes(tl) || tl.includes(loose)) {
          consider(bestByProduct, product, WRONG_ALIAS_SCORE_CAP, kind, term);
        }
        continue;
      }
      const t = normalizeTerm(term);
      const tl = normalizeLoose(term);
      let boost = 0;
      if (t === lower || tl === loose) {
        boost = namesIdentityCompatible(q, term) ? 1 : SUGGESTION_SCORE_CAP;
      } else if (t.startsWith(lower) || lower.startsWith(t)) {
        boost = namesIdentityCompatible(q, term) ? 0.95 : SUGGESTION_SCORE_CAP;
      } else if (tl.startsWith(loose) || loose.startsWith(tl)) {
        boost = namesIdentityCompatible(q, term) ? 0.94 : SUGGESTION_SCORE_CAP;
      } else if (t.includes(lower) && lower.length >= 3) {
        boost = SUGGESTION_SCORE_CAP;
      } else if (tl.includes(loose) && loose.length >= 3) {
        boost = SUGGESTION_SCORE_CAP;
      } else if (lower.includes(t) && t.length >= 3) {
        boost = SUGGESTION_SCORE_CAP;
      } else if (loose.includes(tl) && tl.length >= 3) {
        boost = SUGGESTION_SCORE_CAP;
      } else {
        const j = tokenJaccard(q, term);
        if (j >= 0.7) {
          boost = namesIdentityCompatible(q, term) ? 0.92 : SUGGESTION_SCORE_CAP;
        } else if (j >= 0.5) boost = 0.8;
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

  sanitizeIdentityScores(bestByProduct, q);

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
