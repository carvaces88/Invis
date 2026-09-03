import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitCode } from '../data/types';

const STORAGE_KEY = 'invis.supplierPriceHistory.v1';

export type SupplierPriceObservation = {
  id: string;
  /** Catalog product id when matched; else a stable name key */
  productKey: string;
  productId?: string;
  name: string;
  unit: UnitCode;
  unitPriceAlv0: number;
  /** YYYY-MM — selected counting month when the photo was saved */
  monthKey: string;
  observedAt: string;
  source: 'supplier_order';
  supplierHint?: string;
  imageUri?: string;
  /** True when user also wrote inventory from this row */
  appliedToInventory: boolean;
};

export type MonthPriceRow = {
  productKey: string;
  name: string;
  unit: UnitCode;
  /** Latest observation in the selected month */
  current: SupplierPriceObservation;
  /** Latest observation in the previous calendar month */
  previous: SupplierPriceObservation | null;
};

function monthKeyFromDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthKeyFromIndex(monthIndex: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const m = String(Math.min(11, Math.max(0, monthIndex)) + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function previousMonthKey(monthKey: string): string {
  const [ys, ms] = monthKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function nameProductKey(name: string): string {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export async function loadSupplierPriceHistory(): Promise<
  SupplierPriceObservation[]
> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is SupplierPriceObservation =>
        !!row &&
        typeof row === 'object' &&
        typeof (row as SupplierPriceObservation).id === 'string' &&
        typeof (row as SupplierPriceObservation).name === 'string' &&
        typeof (row as SupplierPriceObservation).unitPriceAlv0 === 'number' &&
        typeof (row as SupplierPriceObservation).monthKey === 'string',
    );
  } catch {
    return [];
  }
}

export async function saveSupplierPriceHistory(
  rows: SupplierPriceObservation[],
): Promise<void> {
  // Keep full history across months (capped) for later export/print.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 4000)));
}

export async function appendSupplierPriceObservations(
  additions: Omit<SupplierPriceObservation, 'id' | 'observedAt'>[],
): Promise<SupplierPriceObservation[]> {
  const prev = await loadSupplierPriceHistory();
  const now = new Date().toISOString();
  const stamped: SupplierPriceObservation[] = additions.map((row, i) => ({
    ...row,
    id: `spo-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    observedAt: now,
  }));
  const next = [...stamped, ...prev];
  await saveSupplierPriceHistory(next);
  return stamped;
}

export function filterObservationsByMonth(
  rows: SupplierPriceObservation[],
  monthKey: string,
): SupplierPriceObservation[] {
  return rows.filter((r) => r.monthKey === monthKey);
}

function latestByProduct(
  rows: SupplierPriceObservation[],
): Map<string, SupplierPriceObservation> {
  const map = new Map<string, SupplierPriceObservation>();
  const sorted = [...rows].sort((a, b) =>
    b.observedAt.localeCompare(a.observedAt),
  );
  for (const row of sorted) {
    if (!map.has(row.productKey)) map.set(row.productKey, row);
  }
  return map;
}

/**
 * Only products that have at least one record in `monthKey`.
 * Previous month prices are attached for comparison; products without a
 * selected-month record are not shown.
 */
export function monthPriceRows(
  all: SupplierPriceObservation[],
  monthKey: string,
): MonthPriceRow[] {
  const monthRows = filterObservationsByMonth(all, monthKey);
  if (!monthRows.length) return [];
  const currentMap = latestByProduct(monthRows);
  const prevMap = latestByProduct(
    filterObservationsByMonth(all, previousMonthKey(monthKey)),
  );
  return [...currentMap.entries()]
    .map(([productKey, current]) => ({
      productKey,
      name: current.name,
      unit: current.unit,
      current,
      previous: prevMap.get(productKey) ?? null,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
}

/** Archive grouping across all months (export helper). */
export function groupPriceHistoryByProduct(
  rows: SupplierPriceObservation[],
): {
  productKey: string;
  name: string;
  latest: SupplierPriceObservation;
  history: SupplierPriceObservation[];
}[] {
  const map = new Map<string, SupplierPriceObservation[]>();
  for (const row of rows) {
    const list = map.get(row.productKey) ?? [];
    list.push(row);
    map.set(row.productKey, list);
  }
  return [...map.entries()]
    .map(([productKey, history]) => {
      const sorted = [...history].sort((a, b) =>
        b.observedAt.localeCompare(a.observedAt),
      );
      return {
        productKey,
        name: sorted[0]?.name ?? productKey,
        latest: sorted[0]!,
        history: sorted,
      };
    })
    .sort((a, b) => b.latest.observedAt.localeCompare(a.latest.observedAt));
}

export function buildPriceHistoryExportHtml(args: {
  title: string;
  monthLabel: string;
  monthKey: string;
  rows: MonthPriceRow[];
  emptyNote: string;
}): string {
  const body =
    args.rows.length === 0
      ? `<p>${escapeHtml(args.emptyNote)}</p>`
      : `<table>
<thead><tr><th>Product</th><th>Unit</th><th>${escapeHtml(args.monthKey)}</th><th>Prev month</th><th>Δ</th></tr></thead>
<tbody>
${args.rows
  .map((r) => {
    const cur = r.current.unitPriceAlv0.toFixed(2);
    const prev =
      r.previous != null ? r.previous.unitPriceAlv0.toFixed(2) : '—';
    const delta =
      r.previous != null
        ? (r.current.unitPriceAlv0 - r.previous.unitPriceAlv0).toFixed(2)
        : '—';
    return `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.unit)}</td><td>${cur}</td><td>${prev}</td><td>${delta}</td></tr>`;
  })
  .join('\n')}
</tbody></table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(args.title)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;color:#0B1F33;padding:24px}
h1{font-size:20px;margin:0 0 4px}p.sub{color:#5A6B7D;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #E4EBF2;padding:8px 6px;text-align:left}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5A6B7D}
</style></head><body>
<h1>${escapeHtml(args.title)}</h1>
<p class="sub">${escapeHtml(args.monthLabel)} · ${escapeHtml(args.monthKey)}</p>
${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { monthKeyFromDate };
