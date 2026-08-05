import Fuse from 'fuse.js';
import type { Product, ProductMatch } from '../data/types';

type SearchRow = {
  product: Product;
  term: string;
  kind: 'official' | 'alias';
};

/** Kitchen synonyms Fuse alone often misses (cilantro ↔ coriander). */
const SYNONYM_GROUPS: string[][] = [
  ['cilantro', 'coriander', 'korianteri', 'koriander'],
  ['parsley', 'persilja'],
  ['yogurt', 'yoghurt', 'jogurtti', 'jugurtti'],
  ['capers', 'kapris'],
];

/** Minimum score to treat as a “strong similar” merge candidate. */
export const SIMILAR_MATCH_MIN = 0.35;

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
  }
  return rows;
}

function productTerms(product: Product): { term: string; kind: 'official' | 'alias' }[] {
  return [
    { term: product.officialName, kind: 'official' },
    ...product.aliases.map((a) => ({ term: a, kind: 'alias' as const })),
  ];
}

function normalizeTerm(s: string): string {
  return s.trim().toLowerCase();
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
  const lower = normalizeTerm(query);
  if (!lower) return [];
  const peers = new Set<string>();
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some(
      (g) => g === lower || lower.includes(g) || g.includes(lower),
    );
    if (!hit) continue;
    for (const g of group) {
      if (g !== lower) peers.add(g);
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
      const t = normalizeTerm(term);
      const peer = peers.find(
        (p) => t === p || t.includes(p) || p.includes(t),
      );
      if (!peer) continue;
      const boost = 0.88;
      const existing = bestByProduct.get(product.id);
      if (!existing || boost > existing.score) {
        bestByProduct.set(product.id, {
          product,
          score: boost,
          matchedOn: kind,
          matchedTerm: term,
        });
      }
    }
  }
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
    const score = 1 - (hit.score ?? 1);
    const existing = bestByProduct.get(product.id);
    if (!existing || score > existing.score) {
      bestByProduct.set(product.id, {
        product,
        score,
        matchedOn: kind,
        matchedTerm: term,
      });
    }
  }

  // Boost exact / prefix alias hits (staff informal names)
  const lower = q.toLowerCase();
  for (const product of products) {
    for (const { term, kind } of productTerms(product)) {
      const t = term.toLowerCase();
      let boost = 0;
      if (t === lower) boost = 1;
      else if (t.startsWith(lower) || lower.startsWith(t)) boost = 0.95;
      else if (t.includes(lower)) boost = 0.85;
      if (boost === 0) continue;
      const existing = bestByProduct.get(product.id);
      if (!existing || boost > existing.score) {
        bestByProduct.set(product.id, {
          product,
          score: boost,
          matchedOn: kind,
          matchedTerm: term,
        });
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
