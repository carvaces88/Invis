import type { UnitCode } from './types';

/**
 * Finnish inventaario YKSIKKÖ codes (authoritative kitchen POS list).
 *
 * | Code    | Finnish     | English                         |
 * |---------|-------------|---------------------------------|
 * | L       | Litra       | Liter(s)                        |
 * | KPL     | Kappale     | Piece(s) / Item(s)              |
 * | PRK     | Purkki      | Can(s) / Jar(s)                 |
 * | RSA     | Rasia       | Box(es) / Container(s)          |
 * | PSS     | Pussi       | Bag(s) / Pouch(es)              |
 * | PL/PLO  | Pullo       | Bottle(s)                       |
 * | LTK     | Laatikko    | Box / Crate                     |
 * | KG      | Kilogramma  | Kilogram(s)                     |
 * | RAS     | Rasia       | Box / Container                 |
 * | PKT     | Paketti     | Packet / Package                |
 */
export const UNIT_LABELS: Record<UnitCode, string> = {
  L: 'L · Litra / Liter(s)',
  KPL: 'KPL · Kappale / Piece(s)',
  PRK: 'PRK · Purkki / Can·Jar',
  RSA: 'RSA · Rasia / Box·Container',
  PSS: 'PSS · Pussi / Bag·Pouch',
  PL: 'PL · Pullo / Bottle',
  PLO: 'PLO · Pullo / Bottle',
  LTK: 'LTK · Laatikko / Box·Crate',
  KG: 'KG · Kilogramma / Kilogram(s)',
  RAS: 'RAS · Rasia / Box·Container',
  PKT: 'PKT · Paketti / Packet',
};

export const UNIT_CODES = Object.keys(UNIT_LABELS) as UnitCode[];

/**
 * Friendly kitchen labels → Finnish POS / inventaariopohja UnitCode.
 *
 * | Friendly | POS  | Notes                                      |
 * |----------|------|--------------------------------------------|
 * | box      | LTK  | Laatikko — box/crate                       |
 * | bunch    | KPL  | no dedicated POS code; count as pieces     |
 * | piece    | KPL  | Kappale                                    |
 * | liter    | L    | Litra                                      |
 * | kg       | KG   | Kilogramma                                 |
 * | bag      | PSS  | Pussi — bag/pouch                          |
 * | bottle   | PL   | Pullo; PLO is alternate bottle code        |
 * | jar      | PRK  | Purkki — can/jar                           |
 * | packet   | PKT  | Paketti                                    |
 * | tray     | RSA  | Rasia — box/container (sheet code RSA)     |
 * | tub      | RAS  | Rasia — box/container (sheet code RAS)     |
 * | bottle2  | PLO  | Pullo alternate                            |
 */
export type FriendlyUnitId =
  | 'box'
  | 'bunch'
  | 'piece'
  | 'liter'
  | 'kg'
  | 'bag'
  | 'bottle'
  | 'jar'
  | 'packet'
  | 'tray'
  | 'tub'
  | 'bottlePlo';

export type FriendlyUnitOption = {
  id: FriendlyUnitId;
  code: UnitCode;
  /** i18n key for the chip / more-list label */
  labelKey:
    | 'unitChipBox'
    | 'unitChipBunch'
    | 'unitChipPiece'
    | 'unitChipLiter'
    | 'unitChipKg'
    | 'unitChipBag'
    | 'unitChipBottle'
    | 'unitChipJar'
    | 'unitChipPacket'
    | 'unitChipTray'
    | 'unitChipTub'
    | 'unitChipBottlePlo';
};

/** Chips shown by default on Record inventory */
export const COMMON_UNIT_OPTIONS: FriendlyUnitOption[] = [
  { id: 'liter', code: 'L', labelKey: 'unitChipLiter' },
  { id: 'piece', code: 'KPL', labelKey: 'unitChipPiece' },
  { id: 'jar', code: 'PRK', labelKey: 'unitChipJar' },
  { id: 'bag', code: 'PSS', labelKey: 'unitChipBag' },
  { id: 'bottle', code: 'PL', labelKey: 'unitChipBottle' },
  { id: 'box', code: 'LTK', labelKey: 'unitChipBox' },
  { id: 'kg', code: 'KG', labelKey: 'unitChipKg' },
];

/** Remaining POS units behind “More units” */
export const MORE_UNIT_OPTIONS: FriendlyUnitOption[] = [
  { id: 'bunch', code: 'KPL', labelKey: 'unitChipBunch' },
  { id: 'tray', code: 'RSA', labelKey: 'unitChipTray' },
  { id: 'tub', code: 'RAS', labelKey: 'unitChipTub' },
  { id: 'packet', code: 'PKT', labelKey: 'unitChipPacket' },
  { id: 'bottlePlo', code: 'PLO', labelKey: 'unitChipBottlePlo' },
];

export const ALL_FRIENDLY_UNIT_OPTIONS: FriendlyUnitOption[] = [
  ...COMMON_UNIT_OPTIONS,
  ...MORE_UNIT_OPTIONS,
];

/** Guide for More → Units: POS code + Finnish + English (inventaario sheet) */
export type UnitGuideRow = {
  id: string;
  code: UnitCode;
  enName: string;
  fiName: string;
  enMeaning: string;
  fiMeaning: string;
};

/** Ordered like a typical inventaariopohja YKSIKKÖ column */
export const UNIT_GUIDE: UnitGuideRow[] = [
  {
    id: 'L',
    code: 'L',
    enName: 'Liter(s)',
    fiName: 'Litra',
    enMeaning: 'Liter(s)',
    fiMeaning: 'Litra',
  },
  {
    id: 'KPL',
    code: 'KPL',
    enName: 'Piece(s) / Item(s)',
    fiName: 'Kappale',
    enMeaning: 'Piece(s) / Item(s)',
    fiMeaning: 'Kappale',
  },
  {
    id: 'PRK',
    code: 'PRK',
    enName: 'Can(s) / Jar(s)',
    fiName: 'Purkki',
    enMeaning: 'Can(s) / Jar(s)',
    fiMeaning: 'Purkki',
  },
  {
    id: 'RSA',
    code: 'RSA',
    enName: 'Box(es) / Container(s)',
    fiName: 'Rasia',
    enMeaning: 'Box(es) / Container(s)',
    fiMeaning: 'Rasia',
  },
  {
    id: 'PSS',
    code: 'PSS',
    enName: 'Bag(s) / Pouch(es)',
    fiName: 'Pussi',
    enMeaning: 'Bag(s) / Pouch(es)',
    fiMeaning: 'Pussi',
  },
  {
    id: 'PL',
    code: 'PL',
    enName: 'Bottle(s)',
    fiName: 'Pullo',
    enMeaning: 'Bottle(s)',
    fiMeaning: 'Pullo',
  },
  {
    id: 'PLO',
    code: 'PLO',
    enName: 'Bottle(s)',
    fiName: 'Pullo',
    enMeaning: 'Bottle(s) — alternate POS code PLO',
    fiMeaning: 'Pullo — vaihtoehtoinen koodi PLO',
  },
  {
    id: 'LTK',
    code: 'LTK',
    enName: 'Box / Crate',
    fiName: 'Laatikko',
    enMeaning: 'Box / Crate',
    fiMeaning: 'Laatikko',
  },
  {
    id: 'KG',
    code: 'KG',
    enName: 'Kilogram(s)',
    fiName: 'Kilogramma',
    enMeaning: 'Kilogram(s)',
    fiMeaning: 'Kilogramma',
  },
  {
    id: 'RAS',
    code: 'RAS',
    enName: 'Box / Container',
    fiName: 'Rasia',
    enMeaning: 'Box / Container',
    fiMeaning: 'Rasia',
  },
  {
    id: 'PKT',
    code: 'PKT',
    enName: 'Packet / Package',
    fiName: 'Paketti',
    enMeaning: 'Packet / Package',
    fiMeaning: 'Paketti',
  },
];

/** Look up inventaario YKSIKKÖ meaning for a POS code */
export function explainUnitCode(code: string): UnitGuideRow | undefined {
  return UNIT_GUIDE.find((row) => row.code === code);
}

/** Prefer the first friendly option that maps to a given POS code. */
export function friendlyOptionForCode(
  code: UnitCode,
): FriendlyUnitOption | undefined {
  // piece and bunch both map to KPL — prefer piece for catalog sync
  if (code === 'KPL') {
    return ALL_FRIENDLY_UNIT_OPTIONS.find((o) => o.id === 'piece');
  }
  return ALL_FRIENDLY_UNIT_OPTIONS.find((o) => o.code === code);
}

export const INGREDIENT_TYPE_LABELS: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  oils: 'Oils & fats',
  dry_goods: 'Dry goods',
  sauces: 'Sauces & condiments',
  nuts_seeds: 'Nuts & seeds',
  canned: 'Canned & jarred',
  bakery: 'Bakery',
  frozen: 'Frozen',
  meat: 'Meat',
  poultry: 'Poultry',
  deli: 'Cold cuts & deli',
  other: 'Other',
};
