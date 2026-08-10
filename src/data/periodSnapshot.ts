import type { InventoryLine, InventoryPeriodSnapshot } from './types';

export function monthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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
