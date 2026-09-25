import {
  ITEM_CATEGORY_IDS,
  type SimplifiedCountItem,
  type SimplifiedItemCategoryId,
} from '../data/simplifiedCountingSeed';
import type {
  InventorySession,
  Product,
  IngredientType,
} from '../data/types';

function emptyItemCategories(): Record<
  SimplifiedItemCategoryId,
  SimplifiedCountItem[]
> {
  const out = {} as Record<SimplifiedItemCategoryId, SimplifiedCountItem[]>;
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = [];
  }
  return out;
}

/** Map main-catalog ingredient type → Mini Invis category tab. */
export function ingredientTypeToSimpCategory(
  type: IngredientType | undefined,
): SimplifiedItemCategoryId {
  switch (type) {
    case 'dairy':
      return 'dairy';
    case 'produce':
      return 'vegetables';
    case 'frozen':
      return 'frozen';
    case 'meat':
    case 'poultry':
    case 'deli':
      return 'meat';
    case 'dry_goods':
    case 'oils':
    case 'sauces':
    case 'canned':
    case 'bakery':
    case 'nuts_seeds':
      return 'dry_goods';
    default:
      return 'other';
  }
}

export function productTotalQuantity(
  session: InventorySession,
  productId: string,
): number {
  let sum = 0;
  for (const line of session.lines) {
    if (line.productId !== productId) continue;
    if (line.quantity == null) continue;
    sum += line.quantity;
  }
  return Math.round(sum * 1000) / 1000;
}

/** Prefer a place that already holds stock for this product. */
export function preferredPlaceForProduct(
  session: InventorySession,
  productId: string,
  fallbackPlaceId: string,
): string {
  const withQty = session.lines.find(
    (l) =>
      l.productId === productId &&
      l.quantity != null &&
      l.quantity !== 0,
  );
  if (withQty) return withQty.placeId;
  const any = session.lines.find((l) => l.productId === productId);
  return any?.placeId ?? fallbackPlaceId;
}

/**
 * Build Mini Invis category lists from the user's main inventory.
 * Only products with a recorded quantity (incl. 0) are included —
 * empty kitchens stay empty (no Lönkka / Daily Dose demo sheet).
 */
export function buildSimpCategoriesFromInventory(
  products: Product[],
  session: InventorySession,
): Record<SimplifiedItemCategoryId, SimplifiedCountItem[]> {
  const out = emptyItemCategories();
  const byId = new Map(products.map((p) => [p.id, p]));
  const seen = new Set<string>();

  for (const line of session.lines) {
    if (line.quantity == null) continue;
    if (seen.has(line.productId)) continue;
    seen.add(line.productId);
    const product = byId.get(line.productId);
    if (!product) continue;
    const qty = productTotalQuantity(session, product.id);
    const category = ingredientTypeToSimpCategory(product.ingredientType);
    const item: SimplifiedCountItem = {
      id: product.id,
      nameEn: product.officialName,
      nameFi: product.officialName,
      quantity: qty,
      unit: product.unit,
      unitPriceAlv0: product.unitPriceAlv0,
      aliases: product.aliases?.length ? [...product.aliases] : undefined,
    };
    out[category] = [...(out[category] ?? []), item];
  }

  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = (out[cid] ?? []).sort((a, b) =>
      a.nameEn.localeCompare(b.nameEn, undefined, { sensitivity: 'base' }),
    );
  }
  return out;
}
