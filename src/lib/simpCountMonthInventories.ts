import {
  ITEM_CATEGORY_IDS,
  PLACEHOLDER_BY_CATEGORY,
  categoryTotal,
  type SimplifiedCountItem,
  type SimplifiedItemCategoryId,
} from '../data/simplifiedCountingSeed';

/** September (index 8) holds the real sheet seed; Jul/Aug use stable demo variance. */
export const SIMP_COUNT_LIVE_MONTH_INDEX = 8; // September

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneItems(
  rows: SimplifiedCountItem[],
): SimplifiedCountItem[] {
  return rows.map((row) => ({
    ...row,
    aliases: row.aliases ? [...row.aliases] : undefined,
  }));
}

function cloneBase(): Record<SimplifiedItemCategoryId, SimplifiedCountItem[]> {
  const out = {} as Record<SimplifiedItemCategoryId, SimplifiedCountItem[]>;
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = cloneItems(PLACEHOLDER_BY_CATEGORY[cid] ?? []);
  }
  return out;
}

/** Deterministic demo quantities so month switching always looks different. */
function varyQuantities(
  base: Record<SimplifiedItemCategoryId, SimplifiedCountItem[]>,
  seed: number,
): Record<SimplifiedItemCategoryId, SimplifiedCountItem[]> {
  const rand = mulberry32(seed);
  const out = {} as Record<SimplifiedItemCategoryId, SimplifiedCountItem[]>;
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = (base[cid] ?? []).map((row) => {
      const roll = rand();
      let quantity: number;
      if (roll < 0.22) {
        quantity = 0;
      } else if (row.quantity > 0) {
        const factor = 0.35 + rand() * 1.35;
        const raw = row.quantity * factor;
        quantity =
          row.quantity % 1 !== 0
            ? Math.round(raw * 10) / 10
            : Math.max(0, Math.round(raw));
      } else {
        // Zero on the live sheet → sometimes stocked in prior months
        quantity = roll > 0.72 ? Math.round(1 + rand() * 8) : 0;
        if (row.unit === 'KG' && quantity > 0 && rand() > 0.5) {
          quantity = Math.round((quantity + rand() * 4) * 10) / 10;
        }
      }
      return { ...row, quantity };
    });
  }
  return out;
}

/**
 * Inventory lines for a calendar month index (0=Jan … 11=Dec).
 * September = sheet seed; July/August = stable random samples; other months vary lightly.
 */
export function inventoryForMonthIndex(
  monthIndex: number,
): Record<SimplifiedItemCategoryId, SimplifiedCountItem[]> {
  const base = cloneBase();
  const m = ((monthIndex % 12) + 12) % 12;
  if (m === SIMP_COUNT_LIVE_MONTH_INDEX) return base;
  if (m === 7) return varyQuantities(base, 0xA462081); // August sample
  if (m === 6) return varyQuantities(base, 0xA462071); // July sample
  return varyQuantities(base, 0xA460000 + m);
}

export function categoryTotalsForMonth(
  monthIndex: number,
): Record<SimplifiedItemCategoryId, number> {
  const inv = inventoryForMonthIndex(monthIndex);
  const out = {} as Record<SimplifiedItemCategoryId, number>;
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = categoryTotal(inv[cid] ?? []);
  }
  return out;
}
