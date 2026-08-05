import type { Product, UnitCode } from '../data/types';
import {
  ALL_FRIENDLY_UNIT_OPTIONS,
  type FriendlyUnitOption,
} from '../data/units';

/** Friendly / POS units that mean a pack / outer container */
export const PACK_UNIT_CODES: ReadonlySet<UnitCode> = new Set([
  'LTK',
  'RSA',
  'PSS',
  'RAS',
  'PKT',
]);

/** Inner / loose units — counting these as packs is ambiguous */
export const LOOSE_UNIT_CODES: ReadonlySet<UnitCode> = new Set([
  'KPL',
  'KG',
  'L',
  'PL',
  'PLO',
  'PRK',
]);

export function isPackUnit(code: UnitCode | string): boolean {
  return PACK_UNIT_CODES.has(code as UnitCode);
}

export function isLooseUnit(code: UnitCode | string): boolean {
  return LOOSE_UNIT_CODES.has(code as UnitCode);
}

/**
 * Parse pack multipliers from strings like "6x500ml", "6 x 1L", "12 kpl".
 * Returns undefined when no clear integer pack count is found.
 */
export function parseUnitsPerPackFromPackSize(
  packSize?: string,
): number | undefined {
  if (!packSize) return undefined;
  const s = packSize.trim();
  const xMatch = s.match(/(?:^|[^\d.])(\d{1,3})\s*[x×]/i);
  if (xMatch) {
    const n = Number(xMatch[1]);
    if (n > 1 && n <= 99) return n;
  }
  const countMatch = s.match(
    /(\d{1,3})\s*(?:kpl|pcs|bottles?|pulloa?|pullot?)/i,
  );
  if (countMatch) {
    const n = Number(countMatch[1]);
    if (n > 1 && n <= 99) return n;
  }
  return undefined;
}

export function resolveUnitsPerPack(product: Product): number | undefined {
  if (product.unitsPerPack != null && product.unitsPerPack > 1) {
    return product.unitsPerPack;
  }
  return parseUnitsPerPackFromPackSize(product.packSize);
}

/** Inner unit for pack ↔ piece conversion (bottle / piece). */
export function resolvePackBaseUnit(product: Product): UnitCode {
  if (product.packBaseUnit) return product.packBaseUnit;
  if (product.unit === 'PL' || product.unit === 'PLO') return product.unit;
  if (!isPackUnit(product.unit)) return product.unit;
  return 'KPL';
}

/** Prefer “bunches” wording for herbs / nippu products. */
export function prefersBunchLabel(product: Product): boolean {
  const base = resolvePackBaseUnit(product);
  if (base !== 'KPL' && product.unit !== 'KPL') return false;
  const hay = `${product.officialName} ${product.aliases.join(' ')}`.toLowerCase();
  return /nippu|bunch|herb|korianteri|cilantro|coriander|persilja|parsley|basilika|basil|minttu|\bmint\b|tilli|\bdill\b|ruohosipuli|chive/.test(
    hay,
  );
}

export function friendlyOptionForBaseUnit(
  code: UnitCode,
): FriendlyUnitOption | undefined {
  if (code === 'PL' || code === 'PLO') {
    return ALL_FRIENDLY_UNIT_OPTIONS.find((o) => o.code === code);
  }
  if (code === 'KPL') {
    return ALL_FRIENDLY_UNIT_OPTIONS.find((o) => o.id === 'piece');
  }
  return ALL_FRIENDLY_UNIT_OPTIONS.find((o) => o.code === code);
}

export function baseUnitLabelEn(
  code: UnitCode,
  preferBunch?: boolean,
): string {
  if (code === 'PL' || code === 'PLO') return 'bottles';
  if (code === 'KPL') return preferBunch ? 'bunches' : 'pieces';
  if (code === 'PRK') return 'jars';
  if (code === 'KG') return 'kilos';
  if (code === 'L') return 'liters';
  return code;
}

export function baseUnitLabelFi(
  code: UnitCode,
  preferBunch?: boolean,
): string {
  if (code === 'PL' || code === 'PLO') return 'pulloa';
  if (code === 'KPL') return preferBunch ? 'nippua' : 'kpl';
  if (code === 'PRK') return 'purkkia';
  if (code === 'KG') return 'kg';
  if (code === 'L') return 'litraa';
  return code;
}

export function packUnitLabelEn(code: UnitCode): string {
  if (code === 'LTK') return 'boxes';
  if (code === 'PSS') return 'bags';
  if (code === 'RSA' || code === 'RAS') return 'trays';
  if (code === 'PKT') return 'packets';
  return 'packs';
}

export function packUnitLabelFi(code: UnitCode): string {
  if (code === 'LTK') return 'laatikkoa';
  if (code === 'PSS') return 'pussia';
  if (code === 'RSA' || code === 'RAS') return 'rasiaa';
  if (code === 'PKT') return 'pakettia';
  return 'pakkausta';
}

export function packUnitSingularEn(code: UnitCode): string {
  if (code === 'LTK') return 'box';
  if (code === 'PSS') return 'bag';
  if (code === 'RSA' || code === 'RAS') return 'tray';
  if (code === 'PKT') return 'packet';
  return 'pack';
}

export function packUnitSingularFi(code: UnitCode): string {
  if (code === 'LTK') return 'laatikko';
  if (code === 'PSS') return 'pussi';
  if (code === 'RSA' || code === 'RAS') return 'rasia';
  if (code === 'PKT') return 'paketti';
  return 'pakkaus';
}

export type PackCheckInfo = {
  /** null when unknown — modal asks for clarification */
  unitsPerPack: number | null;
  packUnit: UnitCode;
  baseUnit: UnitCode;
  packQty: number;
  /** null when unitsPerPack unknown */
  pieceQty: number | null;
  needsUnitsPerPack: boolean;
  preferBunchLabel: boolean;
};

export type PackCheckResolve = {
  /** When set (>1), persist on the product for future confirms */
  unitsPerPack?: number;
  packBaseUnit: UnitCode;
};

/** Whether save should show the pack confusion confirm. */
export function shouldShowPackCheck(
  product: Product,
  selectedUnit: UnitCode,
  qty: number,
): PackCheckInfo | null {
  if (!isPackUnit(selectedUnit)) return null;
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const resolved = resolveUnitsPerPack(product);
  const known = resolved != null && resolved > 1;
  const looseDefault = isLooseUnit(product.unit);
  const packDiffersFromDefault = selectedUnit !== product.unit;

  // Known multiplier → always confirm when counting in a pack unit.
  // Unknown → confirm when default is loose (herbs/kg/…) or pack ≠ catalog unit.
  if (!known && !looseDefault && !packDiffersFromDefault) return null;

  const baseUnit = resolvePackBaseUnit(product);
  const unitsPerPack = known ? resolved! : null;
  return {
    unitsPerPack,
    packUnit: selectedUnit,
    baseUnit,
    packQty: qty,
    pieceQty:
      unitsPerPack != null
        ? Math.round(qty * unitsPerPack * 1000) / 1000
        : null,
    needsUnitsPerPack: !known,
    preferBunchLabel: prefersBunchLabel(product),
  };
}
