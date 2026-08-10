import type {
  InventoryLine,
  InventoryPeriodSnapshot,
  InventorySession,
  Product,
  Recipe,
  StockMovement,
} from '../../data/types';
import { openingQtyForLine } from '../../data/periodSnapshot';
import { lineTotal, sessionTotals } from '../../data/store';
import type { Messages } from '../../i18n/en';
import {
  computeRestolutionMetrics,
  productCodeForLine,
} from './restolutionMetrics';

/** Preset column sets for inventory export / on-screen spreadsheet */
export type ExportProfileId =
  | 'amounts'
  | 'withPrice'
  | 'nameQty'
  | 'restolution';

export type ExportColumnId =
  | 'name'
  | 'unit'
  | 'qty'
  | 'price'
  | 'total'
  | 'date'
  | 'productCode'
  | 'storage'
  | 'openingStock'
  | 'purchases'
  | 'closingStock'
  | 'usage'
  | 'need'
  | 'variance'
  | 'turnover';

export type ExportProfile = {
  id: ExportProfileId;
  columns: ExportColumnId[];
  /** Session qty + value footer (only when price columns present) */
  includeTotals: boolean;
  /**
   * When true, file exports and on-screen view use bilingual Restolution
   * headers (FI / EN) for import compatibility — see RESTOLUTION_FI_HEADERS.
   */
  finnishExportHeaders?: boolean;
};

/** Optional context for movement / code columns */
export type ExportCellContext = {
  session: InventorySession;
  movements?: StockMovement[];
  products?: Product[];
  recipes?: Recipe[];
  /** Month opening stock for Restolution Alkuvarasto / usage math */
  periodSnapshot?: InventoryPeriodSnapshot | null;
};

export const EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'restolution',
    /**
     * Exact Restolution import column order (bilingual headers in files).
     * Matches: Tuotekoodi → … → Varastonkiertonopeus / Inventory Turnover
     */
    columns: [
      'productCode',
      'name',
      'openingStock',
      'purchases',
      'closingStock',
      'usage',
      'need',
      'variance',
      'turnover',
    ],
    includeTotals: false,
    finnishExportHeaders: true,
  },
  {
    id: 'amounts',
    columns: ['name', 'unit', 'qty'],
    includeTotals: false,
  },
  {
    id: 'withPrice',
    columns: ['name', 'unit', 'qty', 'price', 'total'],
    includeTotals: true,
  },
  {
    id: 'nameQty',
    columns: ['name', 'qty'],
    includeTotals: false,
  },
];

/** Primary purpose of the app: Restolution-readable inventory sheets. */
export const DEFAULT_EXPORT_PROFILE: ExportProfileId = 'restolution';

/**
 * Restolution sheet headers — bilingual FI / EN as Restolution templates use.
 * Used in Excel/PDF/Word and on-screen Restolution view.
 */
export const RESTOLUTION_FI_HEADERS: Partial<Record<ExportColumnId, string>> = {
  productCode: 'Tuotekoodi / Product Code',
  name: 'Tuote / Product Name',
  openingStock: 'Alkuvarasto / Beginning Inventory',
  purchases: 'Ostot / Purchases',
  closingStock: 'Loppuvarasto / Ending Inventory',
  usage: 'Ainekäyttö / Actual Usage',
  need: 'Tarve / Theoretical Need',
  variance: 'Ero / Variance',
  turnover: 'Varastonkiertonopeus / Inventory Turnover',
};

export function getExportProfile(id: ExportProfileId): ExportProfile {
  return EXPORT_PROFILES.find((p) => p.id === id) ?? EXPORT_PROFILES[0];
}

export function isNumericColumn(column: ExportColumnId): boolean {
  return (
    column === 'qty' ||
    column === 'price' ||
    column === 'total' ||
    column === 'openingStock' ||
    column === 'purchases' ||
    column === 'closingStock' ||
    column === 'usage' ||
    column === 'need' ||
    column === 'variance' ||
    column === 'turnover'
  );
}

export function columnHeader(
  column: ExportColumnId,
  labels: Messages,
  options?: { finnishRestolution?: boolean },
): string {
  if (options?.finnishRestolution && RESTOLUTION_FI_HEADERS[column]) {
    return RESTOLUTION_FI_HEADERS[column]!;
  }
  switch (column) {
    case 'name':
      return labels.name;
    case 'unit':
      return labels.unit;
    case 'qty':
      return labels.qty;
    case 'price':
      return labels.priceExclVat;
    case 'total':
      return labels.total;
    case 'date':
      return labels.colDate;
    case 'productCode':
      return labels.colProductCode;
    case 'storage':
      return labels.colStorage;
    case 'openingStock':
      return labels.colOpeningStock;
    case 'purchases':
      return labels.colPurchases;
    case 'closingStock':
      return labels.colClosingStock;
    case 'usage':
      return labels.colUsage;
    case 'need':
      return labels.colNeed;
    case 'variance':
      return labels.colVariance;
    case 'turnover':
      return labels.colTurnover;
  }
}

function metricsFor(
  line: InventoryLine,
  ctx?: ExportCellContext,
) {
  const periodOpening = openingQtyForLine(
    ctx?.periodSnapshot,
    line.productId,
    line.placeId,
  );
  return computeRestolutionMetrics(line, ctx?.movements ?? [], {
    recipes: ctx?.recipes,
    periodOpening,
  });
}

export function cellValue(
  column: ExportColumnId,
  line: InventoryLine,
  ctx?: ExportCellContext,
): string | number {
  switch (column) {
    case 'name':
      return line.officialName;
    case 'unit':
      return line.unit;
    case 'qty':
      return line.quantity ?? '';
    case 'price':
      return line.unitPriceAlv0;
    case 'total':
      return line.quantity == null ? '' : lineTotal(line);
    case 'date': {
      const iso = ctx?.session.date ?? '';
      if (!iso) return '';
      // Restolution / FI sheets use DD.MM.YYYY
      const parts = iso.split('-');
      return parts.length === 3
        ? `${parts[2]}.${parts[1]}.${parts[0]}`
        : iso;
    }
    case 'productCode':
      return productCodeForLine(line, ctx?.products ?? []);
    case 'storage':
      // Place storage type is resolved on InventaarioScreen (needs places).
      return '';
    case 'openingStock':
      return metricsFor(line, ctx).alkuvarasto;
    case 'purchases':
      return metricsFor(line, ctx).ostot;
    case 'closingStock':
      return line.quantity ?? '';
    case 'usage': {
      const v = metricsFor(line, ctx).ainekaytto;
      return v == null ? '' : v;
    }
    case 'need':
      return metricsFor(line, ctx).tarve;
    case 'variance': {
      const v = metricsFor(line, ctx).ero;
      return v == null ? '' : v;
    }
    case 'turnover': {
      const v = metricsFor(line, ctx).varastonkiertonopeus;
      return v == null ? '' : v;
    }
  }
}

export function cellDisplay(
  column: ExportColumnId,
  line: InventoryLine,
  ctx?: ExportCellContext,
): string {
  const raw = cellValue(column, line, ctx);
  if (raw === '') {
    if (
      column === 'turnover' ||
      column === 'usage' ||
      column === 'variance' ||
      column === 'closingStock' ||
      column === 'qty'
    ) {
      return '—';
    }
    return '';
  }
  if (typeof raw === 'number') {
    if (column === 'price' || column === 'total') {
      return raw.toFixed(2).replace('.', ',');
    }
    // Restolution sheets show turnover with two decimals (e.g. 3.18)
    if (column === 'turnover') {
      return raw.toFixed(2).replace('.', ',');
    }
    return String(raw).replace('.', ',');
  }
  return raw;
}

export function buildExportRows(
  session: InventorySession,
  profile: ExportProfile,
  labels: Messages,
  ctx?: Omit<ExportCellContext, 'session'>,
): Record<string, string | number>[] {
  const fullCtx: ExportCellContext = { session, ...ctx };
  const fiHeaders = Boolean(profile.finnishExportHeaders);
  return session.lines.map((line) => {
    const row: Record<string, string | number> = {};
    for (const col of profile.columns) {
      const header = columnHeader(col, labels, {
        finnishRestolution: fiHeaders,
      });
      row[header] = cellValue(col, line, fullCtx);
    }
    return row;
  });
}

export function totalsFooterCells(
  session: InventorySession,
  profile: ExportProfile,
  labels: Messages,
): string[] | null {
  if (!profile.includeTotals) return null;
  const totals = sessionTotals(session);
  return profile.columns.map((col) => {
    switch (col) {
      case 'name':
        return labels.foodTotal;
      case 'qty':
        return String(totals.quantity).replace('.', ',');
      case 'total':
        return totals.value.toFixed(2).replace('.', ',');
      default:
        return '';
    }
  });
}

export type ExportProfileTitleKey =
  | 'exportProfileAmounts'
  | 'exportProfileWithPrice'
  | 'exportProfileNameQty'
  | 'exportProfileRestolution';

export type ExportProfileHintKey =
  | 'exportProfileAmountsHint'
  | 'exportProfileWithPriceHint'
  | 'exportProfileNameQtyHint'
  | 'exportProfileRestolutionHint';

export function profileTitleKey(id: ExportProfileId): ExportProfileTitleKey {
  switch (id) {
    case 'amounts':
      return 'exportProfileAmounts';
    case 'withPrice':
      return 'exportProfileWithPrice';
    case 'nameQty':
      return 'exportProfileNameQty';
    case 'restolution':
      return 'exportProfileRestolution';
  }
}

export function profileHintKey(id: ExportProfileId): ExportProfileHintKey {
  switch (id) {
    case 'amounts':
      return 'exportProfileAmountsHint';
    case 'withPrice':
      return 'exportProfileWithPriceHint';
    case 'nameQty':
      return 'exportProfileNameQtyHint';
    case 'restolution':
      return 'exportProfileRestolutionHint';
  }
}
