import type { InventoryLine, InventoryPeriodSnapshot } from './types';

export function monthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Next calendar month as YYYY-MM (e.g. 2026-08 → 2026-09). */
export function nextMonthKey(ym: string): string {
  const [yRaw, mRaw] = ym.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return monthKey();
  }
  const d = new Date(y, m, 1); // month is 0-based; `m` advances one month
  return monthKey(d);
}

export type FinalizeInventoryMonthResult =
  | {
      ok: true;
      closedMonth: string;
      nextMonth: string;
    }
  | {
      ok: false;
      reason: 'already';
      closedMonth: string;
      nextMonth: string;
    };

/**
 * Explicit end-of-month wrap-up: current line quantities become opening for the
 * next month. Blocks an immediate second finalize of the brand-new period.
 */
export function finalizePeriodSnapshot(
  existing: InventoryPeriodSnapshot | null,
  lines: InventoryLine[],
  now = new Date(),
): { snapshot: InventoryPeriodSnapshot; result: FinalizeInventoryMonthResult } {
  const openMonth = existing?.currentMonth ?? monthKey(now);
  const nextMonth = nextMonthKey(openMonth);

  const justWrapped =
    existing != null &&
    existing.lastFinalizedMonth != null &&
    nextMonthKey(existing.lastFinalizedMonth) === openMonth &&
    existing.lastFinalizedAt != null &&
    now.getTime() - Date.parse(existing.lastFinalizedAt) < 5 * 60 * 1000;

  if (justWrapped && existing?.lastFinalizedMonth) {
    return {
      snapshot: existing,
      result: {
        ok: false,
        reason: 'already',
        closedMonth: existing.lastFinalizedMonth,
        nextMonth: openMonth,
      },
    };
  }

  const capturedAt = now.toISOString();
  const snapshot: InventoryPeriodSnapshot = {
    currentMonth: nextMonth,
    capturedAt,
    openingQuantities: quantitiesFromLines(lines),
    lastFinalizedMonth: openMonth,
    lastFinalizedAt: capturedAt,
  };
  return {
    snapshot,
    result: { ok: true, closedMonth: openMonth, nextMonth },
  };
}

export function linePeriodKey(productId: string, placeId: string): string {
  return `${productId}::${placeId}`;
}

export function quantitiesFromLines(
  lines: InventoryLine[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const line of lines) {
    out[linePeriodKey(line.productId, line.placeId)] = line.quantity;
  }
  return out;
}

export function isPeriodSnapshot(v: unknown): v is InventoryPeriodSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as InventoryPeriodSnapshot;
  return (
    typeof s.currentMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(s.currentMonth) &&
    typeof s.capturedAt === 'string' &&
    s.openingQuantities != null &&
    typeof s.openingQuantities === 'object'
  );
}

/**
 * Ensure snapshot matches the calendar month.
 * On month change, current line quantities become the new opening.
 */
export function ensurePeriodSnapshot(
  existing: InventoryPeriodSnapshot | null,
  lines: InventoryLine[],
  now = new Date(),
): InventoryPeriodSnapshot {
  const nowMonth = monthKey(now);
  if (!existing) {
    return {
      currentMonth: nowMonth,
      capturedAt: now.toISOString(),
      openingQuantities: quantitiesFromLines(lines),
    };
  }
  if (existing.currentMonth >= nowMonth) {
    return existing;
  }
  return {
    currentMonth: nowMonth,
    capturedAt: now.toISOString(),
    openingQuantities: quantitiesFromLines(lines),
    lastFinalizedMonth: existing.lastFinalizedMonth,
    lastFinalizedAt: existing.lastFinalizedAt,
  };
}

export function openingQtyForLine(
  snapshot: InventoryPeriodSnapshot | null | undefined,
  productId: string,
  placeId: string,
): number | null | undefined {
  if (!snapshot) return undefined;
  const key = linePeriodKey(productId, placeId);
  if (!(key in snapshot.openingQuantities)) return undefined;
  return snapshot.openingQuantities[key] ?? null;
}
