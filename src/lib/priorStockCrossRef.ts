/**
 * Cross-reference spoken/typed counts like "2 buckets of mayo"
 * against an imported prior stock list, then the catalog.
 */
import type {
  PriorStockListLine,
  PriorStockListSnapshot,
  Product,
  ProductMatch,
  UnitCode,
  VisionExtract,
} from '../data/types';
import {
  bestExtractMatch,
  isStrongCatalogMatch,
  searchProducts,
} from './fuzzyMatch';
import { parseDictationSegment } from './parseDictationTranscript';

export type CrossRefSource = 'prior_list' | 'catalog';

export type CrossRefHit = {
  extract: VisionExtract;
  /** Catalog product when resolved */
  match: ProductMatch | null;
  source: CrossRefSource;
  /** Prior-list line name when that corpus won */
  priorLineName?: string;
};

function normalizeKey(s: string): string {
  return s
    .toLocaleLowerCase('fi-FI')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scorePriorLine(query: string, line: PriorStockListLine): number {
  const q = normalizeKey(query);
  if (!q) return 0;
  const names = [line.name, ...(line.aliases ?? [])].map(normalizeKey);
  let best = 0;
  for (const n of names) {
    if (!n) continue;
    if (n === q) best = Math.max(best, 1);
    else if (n.includes(q) || q.includes(n)) best = Math.max(best, 0.92);
    else {
      const qTokens = new Set(q.split(' ').filter((t) => t.length >= 2));
      const nTokens = n.split(' ').filter((t) => t.length >= 2);
      if (!qTokens.size || !nTokens.length) continue;
      let hit = 0;
      for (const t of nTokens) if (qTokens.has(t)) hit += 1;
      const ratio = hit / Math.max(qTokens.size, nTokens.length);
      if (ratio >= 0.5) best = Math.max(best, 0.55 + ratio * 0.35);
    }
  }
  return best;
}

function bestPriorLine(
  lines: PriorStockListLine[],
  name: string,
): { line: PriorStockListLine; score: number } | null {
  let best: { line: PriorStockListLine; score: number } | null = null;
  for (const line of lines) {
    const score = scorePriorLine(name, line);
    if (score < 0.55) continue;
    if (!best || score > best.score) best = { line, score };
  }
  return best;
}

/**
 * Parse a count phrase and match prior-list first, then catalog.
 * Returns null when the text is too short / not a product phrase.
 */
export function resolveCountPhrase(
  text: string,
  priorList: PriorStockListSnapshot | null | undefined,
  products: Product[],
): CrossRefHit | null {
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;

  const extract = parseDictationSegment(trimmed);
  if (!extract) return null;

  const name = extract.suggestedName.trim();
  if (!name) return null;

  // (a) Prior list — prefer strong hit
  if (priorList?.lines?.length) {
    const priorHit = bestPriorLine(priorList.lines, name);
    if (priorHit && priorHit.score >= 0.72) {
      const line = priorHit.line;
      const unit = (extract.unit ?? line.unit) as UnitCode | null;
      const qty =
        extract.quantity != null
          ? extract.quantity
          : line.quantity != null
            ? line.quantity
            : 1;

      let match: ProductMatch | null = null;
      if (line.matchedProductId) {
        const product = products.find((p) => p.id === line.matchedProductId);
        if (product) {
          match = {
            product,
            score: Math.min(1, priorHit.score),
            matchedOn: 'alias',
            matchedTerm: line.name,
          };
        }
      }
      if (!match) {
        const enriched: VisionExtract = {
          ...extract,
          suggestedName: line.name,
          unit,
          quantity: qty,
          aliases: [
            ...(extract.aliases ?? []),
            line.name,
            ...(line.aliases ?? []),
          ],
        };
        match = bestExtractMatch(products, enriched);
        if (match && !isStrongCatalogMatch(match, enriched) && match.score < 0.7) {
          // Keep weak catalog suggestion but still flag prior source
          const soft = searchProducts(products, line.name, 1)[0] ?? match;
          match = soft.score >= 0.45 ? soft : match;
        }
      }

      return {
        extract: {
          ...extract,
          suggestedName: match?.product.officialName ?? line.name,
          unit: unit ?? match?.product.unit ?? extract.unit,
          quantity: qty,
          confidence: Math.max(extract.confidence, priorHit.score),
          rawNotes: [
            extract.rawNotes,
            `Prior list: “${line.name}”`,
          ]
            .filter(Boolean)
            .join(' · '),
        },
        match,
        source: 'prior_list',
        priorLineName: line.name,
      };
    }
  }

  // (b) Catalog
  const match = bestExtractMatch(products, extract);
  if (!match || match.score < 0.45) {
    return {
      extract,
      match: null,
      source: 'catalog',
    };
  }

  return {
    extract: {
      ...extract,
      suggestedName: match.product.officialName,
      unit: extract.unit ?? match.product.unit,
    },
    match,
    source: 'catalog',
  };
}
