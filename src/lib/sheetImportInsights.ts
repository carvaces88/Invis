import type { DocumentExtract, SheetImportInsight, SheetImportInsightKind } from '../data/types';
import type { MessageKey } from '../i18n/en';

const MIN_CONFIDENCE = 0.55;

const VALID_KINDS = new Set<SheetImportInsightKind>([
  'duplicate',
  'crossed_off',
  'qty_mismatch',
]);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function positiveInt(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const n = Math.round(raw);
  return n >= 1 ? n : undefined;
}

function finiteNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return raw;
}

/** Parse Gemini `insights` array — drops invalid / low-confidence rows. */
export function parseSheetImportInsights(raw: unknown): SheetImportInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetImportInsight[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const kind = r.kind;
    if (typeof kind !== 'string' || !VALID_KINDS.has(kind as SheetImportInsightKind)) {
      continue;
    }
    const itemName =
      (typeof r.itemName === 'string' && r.itemName.trim()) ||
      (typeof r.suggestedName === 'string' && r.suggestedName.trim()) ||
      '';
    if (!itemName) continue;
    const confidence = clamp01(
      typeof r.confidence === 'number' ? r.confidence : 0,
    );
    if (confidence < MIN_CONFIDENCE) continue;

    const pages = Array.isArray(r.pages)
      ? r.pages.map(positiveInt).filter((p): p is number => p != null)
      : undefined;

    out.push({
      kind: kind as SheetImportInsightKind,
      itemName,
      confidence,
      pages: pages?.length ? pages : undefined,
      page: positiveInt(r.page),
      quantityA: finiteNumber(r.quantityA),
      quantityB: finiteNumber(r.quantityB),
      pageA: positiveInt(r.pageA),
      pageB: positiveInt(r.pageB),
    });
  }
  return out;
}

/** Keep insights relevant to the import (multi-page rules, confidence already applied). */
export function filterSheetImportInsights(
  insights: SheetImportInsight[] | undefined,
  pageCount: number,
): SheetImportInsight[] {
  if (!insights?.length) return [];
  return insights.filter((insight) => {
    if (insight.confidence < MIN_CONFIDENCE) return false;
    if (insight.kind === 'duplicate' || insight.kind === 'qty_mismatch') {
      return pageCount >= 2;
    }
    return true;
  });
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

function formatPageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length <= 1) return sorted.map(String).join('');
  if (sorted.length === 2) return `${sorted[0]} & ${sorted[1]}`;
  return `${sorted.slice(0, -1).join(', ')} & ${sorted[sorted.length - 1]}`;
}

/** Merge structured insights with line-level crossedOut flags (vision-backed only). */
export function collectSheetImportInsights(
  document: Pick<DocumentExtract, 'insights' | 'lines'>,
  pageCount: number,
): SheetImportInsight[] {
  const out = filterSheetImportInsights(document.insights, pageCount);
  const crossedNames = new Set(
    out
      .filter((i) => i.kind === 'crossed_off')
      .map((i) => i.itemName.toLocaleLowerCase('fi-FI')),
  );
  for (const line of document.lines) {
    if (!line.crossedOut || line.confidence < MIN_CONFIDENCE) continue;
    const name = line.suggestedName.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('fi-FI');
    if (crossedNames.has(key)) continue;
    crossedNames.add(key);
    out.push({
      kind: 'crossed_off',
      itemName: name,
      confidence: line.confidence,
      page: line.sourcePage ?? undefined,
    });
  }
  return out;
}

type TFn = (key: MessageKey) => string;

/** Localized sous-chef nudge for one insight card. */
export function formatSheetImportInsightMessage(
  t: TFn,
  insight: SheetImportInsight,
): string {
  const item = insight.itemName;
  if (insight.kind === 'duplicate') {
    const pages = insight.pages?.length
      ? formatPageList(insight.pages)
      : '?';
    return t('sheetImportInsightDuplicate').replace('{item}', item).replace('{pages}', pages);
  }
  if (insight.kind === 'crossed_off') {
    const page = insight.page ?? insight.pages?.[0] ?? '?';
    return t('sheetImportInsightCrossedOff')
      .replace('{item}', item)
      .replace('{page}', String(page));
  }
  const qtyA =
    insight.quantityA != null ? formatQty(insight.quantityA) : '?';
  const qtyB =
    insight.quantityB != null ? formatQty(insight.quantityB) : '?';
  const pageA = insight.pageA ?? insight.pages?.[0] ?? '?';
  const pageB = insight.pageB ?? insight.pages?.[1] ?? '?';
  return t('sheetImportInsightQtyMismatch')
    .replace('{item}', item)
    .replace('{qtyA}', qtyA)
    .replace('{qtyB}', qtyB)
    .replace('{pageA}', String(pageA))
    .replace('{pageB}', String(pageB));
}
