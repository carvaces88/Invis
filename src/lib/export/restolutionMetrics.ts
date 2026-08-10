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
 *     when usage > 0 and average stock > 0; otherwise unavailable (“—”).
 *
 * Data sources when history is thin:
 *   - loppuvarasto = current on-hand (line.quantity)
 *   - ostot = sum of kuorma_in quantityDelta for this product
 *   - alkuvarasto = previous inventory_count when available;
 *     else period-snapshot opening; else unknown (treated as 0 for display,
 *     but usage / variance / turnover stay blank until a period baseline exists)
 *   - tarve = 0 until a meal plan / covers input exists
 *
 * Incomplete period (no known opening and no purchases): do not invent
 * negative usage from ending stock alone — that produced nonsense like
 * turnover −2,00 (= −ending / (ending/2)).
 */
export type RestolutionMetrics = {
  /** Opening stock (0 when unknown — see hasPeriodBaseline) */
  alkuvarasto: number;
  /** Purchases / deliveries in */
  ostot: number;
  /** Closing / ending stock (on-hand) */
  loppuvarasto: number | null;
  /** Usage / consumption — null when period baseline is missing */
  ainekaytto: number | null;
  /** Planned need / requirement */
  tarve: number;
  /** Variance: usage − need — null when usage is unavailable */
  ero: number | null;
  /** Inventory turnover rate, or null when undefined / non-positive usage */
  varastonkiertonopeus: number | null;
  /**
   * True when opening is known and/or purchases exist, so usage math is
   * meaningful. False → show “—” for usage, variance, turnover.
   */
  hasPeriodBaseline: boolean;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Restolution sheets show turnover with two decimals (e.g. 3.18). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

/**
 * Opening stock from prior inventory counts when the movement log has them.
 * Returns null when no reliable period opening exists (do not treat as 0).
 */
function resolveOpeningStockFromMovements(
  movements: StockMovement[],
): number | null {
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

  // No prior opening tracked in movements.
  return null;
}

export type RestolutionMetricsOptions = {
  recipes?: Recipe[];
  covers?: number | null;
  /**
   * Opening from month period snapshot when movements have no prior count.
   * `undefined` = not provided; `null` = snapshot knows the line but qty unset.
   */
  periodOpening?: number | null;
};

export function computeRestolutionMetrics(
  line: InventoryLine,
  movements: StockMovement[],
  options?: RestolutionMetricsOptions,
): RestolutionMetrics {
  const productMovements = movements.filter(
    (m) => m.productId === line.productId,
  );

  const ostot = round3(
    productMovements
      .filter((m) => m.type === 'kuorma_in')
      .reduce((sum, m) => sum + Math.max(0, m.quantityDelta), 0),
  );

  const fromMovements = resolveOpeningStockFromMovements(productMovements);
  const periodOpening = options?.periodOpening;
  const openingKnown =
    fromMovements != null ||
    (periodOpening !== undefined && periodOpening != null);

  const alkuvarasto = round3(
    fromMovements != null
      ? fromMovements
      : periodOpening != null
        ? periodOpening
        : 0,
  );

  const loppuvarasto = line.quantity;
  const tarve = plannedNeedForProduct(
    line.productId,
    options?.recipes ?? [],
    options?.covers,
  );

  // Purchases alone establish a period (opening may be legitimately 0).
  const hasPeriodBaseline = openingKnown || ostot > 0;

  let ainekaytto: number | null = null;
  let ero: number | null = null;
  let varastonkiertonopeus: number | null = null;

  if (loppuvarasto != null && hasPeriodBaseline) {
    ainekaytto = round3(alkuvarasto + ostot - loppuvarasto);
    // ero = actual usage − planned need (positive ⇒ over-consumed vs plan)
    ero = round3(ainekaytto - tarve);
    const avgStock = (alkuvarasto + loppuvarasto) / 2;
    // Turnover is a rate of consumption — only defined for positive usage.
    if (ainekaytto > 0 && avgStock > 0) {
      varastonkiertonopeus = round2(ainekaytto / avgStock);
    } else if (ainekaytto === 0 && avgStock > 0) {
      varastonkiertonopeus = 0;
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
    hasPeriodBaseline,
  };
}

/**
 * Restolution Tuotekoodi: prefer POS / Restolution product code (e.g. M1001),
 * then EAN when no code is set.
 */
export function productCodeForLine(
  line: InventoryLine,
  products: Product[],
): string {
  const product = products.find((p) => p.id === line.productId);
  const code = product?.productCode?.trim();
  if (code) return code;
  return product?.ean?.trim() || '';
}
