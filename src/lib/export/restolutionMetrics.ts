import type {
  InventoryLine,
  Product,
  Recipe,
  StockMovement,
} from '../../data/types';

/**
 * Restolution movement-row metrics for one inventory line.
 *
 * Formulas (classic stock identity):
 *   ainekäyttö = alkuvarasto + ostot − loppuvarasto
 *   ero = ainekäyttö − tarve
 *     (Restolution-typical: positive ero = used more than planned need)
 *   varastonkiertonopeus = ainekäyttö / ((alku + loppu) / 2)
 *     when average stock > 0; otherwise unavailable (“—”).
 *
 * Data sources when history is thin:
 *   - loppuvarasto = current on-hand (line.quantity)
 *   - ostot = sum of kuorma_in quantityDelta for this product
 *   - alkuvarasto = previous inventory_count when available; else 0
 *   - tarve = 0 until a meal plan / covers input exists
 */
export type RestolutionMetrics = {
  /** Opening stock */
  alkuvarasto: number;
  /** Purchases / deliveries in */
  ostot: number;
  /** Closing / ending stock (on-hand) */
  loppuvarasto: number | null;
  /** Usage / consumption */
  ainekaytto: number | null;
  /** Planned need / requirement */
  tarve: number;
  /** Variance: usage − need */
  ero: number | null;
  /** Inventory turnover rate, or null when undefined */
  varastonkiertonopeus: number | null;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Sum planned need for a product from recipes × guest covers.
 * Without a covers/plan input this stays 0 (recipes are per-portion only).
 */
export function plannedNeedForProduct(
  _productId: string,
  _recipes: Recipe[],
  covers: number | null | undefined,
): number {
  if (covers == null || covers <= 0) return 0;
  // Reserved for future meal-plan wiring; keep 0 until covers are provided.
  return 0;
}

/** Opening stock from prior inventory counts when the movement log has them. */
function resolveOpeningStock(movements: StockMovement[]): number {
  const counts = movements
    .filter((m) => m.type === 'inventory_count' && m.quantityAfter != null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (counts.length >= 2) {
    // Previous completed count = opening for the current period.
    return counts[counts.length - 2].quantityAfter ?? 0;
  }

  if (counts.length === 1) {
    const first = counts[0];
    const hasLaterDeliveries = movements.some(
      (m) =>
        m.type === 'kuorma_in' && m.createdAt.localeCompare(first.createdAt) > 0,
    );
    // Count then deliveries → that count is the period opening.
    if (hasLaterDeliveries) return first.quantityAfter ?? 0;
  }

  // No prior opening tracked.
  return 0;
}

export function computeRestolutionMetrics(
  line: InventoryLine,
  movements: StockMovement[],
  options?: {
    recipes?: Recipe[];
    covers?: number | null;
  },
): RestolutionMetrics {
  const productMovements = movements.filter(
    (m) => m.productId === line.productId,
  );

  const ostot = round3(
    productMovements
      .filter((m) => m.type === 'kuorma_in')
      .reduce((sum, m) => sum + Math.max(0, m.quantityDelta), 0),
  );

  const alkuvarasto = round3(resolveOpeningStock(productMovements));
  const loppuvarasto = line.quantity;
  const tarve = plannedNeedForProduct(
    line.productId,
    options?.recipes ?? [],
    options?.covers,
  );

  let ainekaytto: number | null = null;
  let ero: number | null = null;
  let varastonkiertonopeus: number | null = null;

  if (loppuvarasto != null) {
    ainekaytto = round3(alkuvarasto + ostot - loppuvarasto);
    // ero = actual usage − planned need (positive ⇒ over-consumed vs plan)
    ero = round3(ainekaytto - tarve);
    const avgStock = (alkuvarasto + loppuvarasto) / 2;
    if (avgStock > 0) {
      varastonkiertonopeus = round3(ainekaytto / avgStock);
    }
  }

  return {
    alkuvarasto,
    ostot,
    loppuvarasto,
    ainekaytto,
    tarve,
    ero,
    varastonkiertonopeus,
  };
}

export function productCodeForLine(
  line: InventoryLine,
  products: Product[],
): string {
  const product = products.find((p) => p.id === line.productId);
  return product?.ean?.trim() || '';
}
