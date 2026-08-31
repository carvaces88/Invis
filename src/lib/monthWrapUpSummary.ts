import { openingQtyForLine } from '../data/periodSnapshot';
import type {
  InventoryPeriodSnapshot,
  InventorySession,
  Recipe,
  StockMovement,
} from '../data/types';
import { computeRestolutionMetrics } from './export/restolutionMetrics';

function lineValueAlv0(quantity: number | null, unitPriceAlv0: number): number {
  if (quantity == null) return 0;
  return Math.round(quantity * unitPriceAlv0 * 100) / 100;
}

export type MonthWrapUpSummary = {
  /** Period being closed (YYYY-MM) */
  monthKey: string;
  recordedLines: number;
  unsetLines: number;
  closingValueAlv0: number;
  purchasesQty: number;
  usageQty: number | null;
  linesWithUsage: number;
};

/**
 * Snapshot totals for the end-of-month wrap-up / report screen.
 * Value is inventory at 0% ALV. Usage qty sums Restolution ainekäyttö when known.
 */
export function buildMonthWrapUpSummary(args: {
  session: InventorySession;
  movements: StockMovement[];
  recipes: Recipe[];
  periodSnapshot: InventoryPeriodSnapshot | null;
  /** Override which month label to show (defaults to open period) */
  monthKey?: string;
}): MonthWrapUpSummary {
  const { session, movements, recipes, periodSnapshot } = args;
  const month =
    args.monthKey ?? periodSnapshot?.currentMonth ?? session.date.slice(0, 7);

  let recordedLines = 0;
  let unsetLines = 0;
  let closingValueAlv0 = 0;
  let purchasesQty = 0;
  let usageSum = 0;
  let linesWithUsage = 0;
  let anyUsage = false;

  for (const line of session.lines) {
    if (line.quantity == null) {
      unsetLines += 1;
      continue;
    }
    recordedLines += 1;
    closingValueAlv0 += lineValueAlv0(line.quantity, line.unitPriceAlv0);

    const periodOpening = openingQtyForLine(
      periodSnapshot,
      line.productId,
      line.placeId,
    );
    const m = computeRestolutionMetrics(line, movements, {
      recipes,
      periodOpening,
    });
    purchasesQty += m.ostot;
    if (m.ainekaytto != null) {
      anyUsage = true;
      usageSum += m.ainekaytto;
      linesWithUsage += 1;
    }
  }

  return {
    monthKey: month,
    recordedLines,
    unsetLines,
    closingValueAlv0: Math.round(closingValueAlv0 * 100) / 100,
    purchasesQty: Math.round(purchasesQty * 1000) / 1000,
    usageQty: anyUsage ? Math.round(usageSum * 1000) / 1000 : null,
    linesWithUsage,
  };
}

export function formatMonthLabel(
  ym: string,
  locale: 'en' | 'fi',
): string {
  const [yRaw, mRaw] = ym.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return ym;
  }
}
