import type { ExportColumnId } from './profiles';

/** Apply a saved order onto the profile’s visible columns (drop unknown, append new). */
export function applyColumnOrder(
  baseColumns: ExportColumnId[],
  customOrder: ExportColumnId[] | null | undefined,
): ExportColumnId[] {
  if (!customOrder?.length) return baseColumns;
  const baseSet = new Set(baseColumns);
  const ordered = customOrder.filter((c) => baseSet.has(c));
  const seen = new Set(ordered);
  for (const c of baseColumns) {
    if (!seen.has(c)) ordered.push(c);
  }
  return ordered;
}

/** Move `from` so it sits at the index of `to` (before `to` after removal). */
export function moveColumnTo(
  columns: ExportColumnId[],
  from: ExportColumnId,
  to: ExportColumnId,
): ExportColumnId[] {
  if (from === to) return columns;
  const fromIdx = columns.indexOf(from);
  const toIdx = columns.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return columns;
  const next = columns.slice();
  next.splice(fromIdx, 1);
  const insertAt = next.indexOf(to);
  if (insertAt < 0) return columns;
  next.splice(insertAt, 0, from);
  return next;
}

/** Nudge a column one step left (−1) or right (+1). */
export function moveColumnBy(
  columns: ExportColumnId[],
  col: ExportColumnId,
  delta: -1 | 1,
): ExportColumnId[] {
  const i = columns.indexOf(col);
  if (i < 0) return columns;
  const j = i + delta;
  if (j < 0 || j >= columns.length) return columns;
  const next = columns.slice();
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}

export function columnOrdersEqual(
  a: ExportColumnId[],
  b: ExportColumnId[],
): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}
