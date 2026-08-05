import type {
  InventorySession,
  Product,
  Recipe,
} from '../data/types';
import { getStockQty } from '../data/store';

export type RecipeYield = {
  recipe: Recipe;
  idealPortions: number;
  withErrorPortions: number;
  portionErrorPercent: number;
  bottleneckProductId: string | null;
  bottleneckName: string | null;
  lines: {
    productId: string;
    name: string;
    stock: number;
    needIdeal: number;
    needWithError: number;
    maxIdeal: number;
    maxWithError: number;
  }[];
};

export function computeRecipeYield(
  recipe: Recipe,
  session: InventorySession,
  products: Product[],
  defaultPortionErrorPercent: number,
): RecipeYield {
  const err =
    recipe.portionErrorPercent > 0
      ? recipe.portionErrorPercent
      : defaultPortionErrorPercent;
  const factor = 1 + err;

  const lines = recipe.ingredients.map((ing) => {
    const product = products.find((p) => p.id === ing.productId);
    const stock = getStockQty(session, ing.productId);
    const needIdeal = ing.qtyPerPortion;
    const needWithError = ing.qtyPerPortion * factor;
    const maxIdeal =
      needIdeal > 0 ? Math.floor(stock / needIdeal + 1e-9) : 0;
    const maxWithError =
      needWithError > 0 ? Math.floor(stock / needWithError + 1e-9) : 0;
    return {
      productId: ing.productId,
      name: product?.officialName ?? ing.productId,
      stock,
      needIdeal,
      needWithError,
      maxIdeal,
      maxWithError,
    };
  });

  const idealPortions = lines.length
    ? Math.min(...lines.map((l) => l.maxIdeal))
    : 0;
  const withErrorPortions = lines.length
    ? Math.min(...lines.map((l) => l.maxWithError))
    : 0;

  const bottleneck =
    lines.find((l) => l.maxWithError === withErrorPortions) ?? null;

  return {
    recipe,
    idealPortions,
    withErrorPortions,
    portionErrorPercent: err,
    bottleneckProductId: bottleneck?.productId ?? null,
    bottleneckName: bottleneck?.name ?? null,
    lines,
  };
}

export function findRecipes(
  recipes: Recipe[],
  query: string,
): Recipe[] {
  const q = query.trim().toLowerCase();
  if (!q) return recipes;
  return recipes.filter((r) => {
    if (r.name.toLowerCase().includes(q)) return true;
    return r.aliases.some((a) => a.toLowerCase().includes(q));
  });
}
