import {
  flattenAllItems,
  findItemCategory,
  itemMatchesQuery,
  type SimplifiedCategoryId,
  type SimplifiedCountItem,
  type SimplifiedItemCategoryId,
} from '../data/simplifiedCountingSeed';
import type { Place, Product, UnitCode } from '../data/types';
import { generateProductAliases } from './productAliases';
import { bestMatch } from './fuzzyMatch';

export type SimpProductSuggestion = {
  nameEn: string;
  nameFi: string;
  categoryId: SimplifiedItemCategoryId;
  unit: UnitCode;
  unitPriceAlv0: number | null;
  aliases: string[];
  /** Existing Simple invis row if this looks like a duplicate */
  existingItemId: string | null;
  /** Category of the existing duplicate, when known */
  existingCategoryId: SimplifiedItemCategoryId | null;
  /** Catalog product id when matched */
  catalogProductId: string | null;
  /** Suggested kitchen place id when known */
  placeId: string | null;
  placeLabel: string | null;
  confidence: number;
  reason: string;
};

const CATEGORY_HINTS: {
  id: SimplifiedItemCategoryId;
  unit?: UnitCode;
  patterns: RegExp[];
}[] = [
  {
    id: 'dairy',
    unit: 'L',
    patterns: [
      /\b(milk|maito|kerma|cream|voi|butter|juusto|cheese|jogurtti|yogurt|rahka|mozzarella|feta|halloumi|parmesan|gouda|brie|ricotta|smetana|tofu|oat\s*milk|kauramaito|majoneesi|mayo)\b/i,
    ],
  },
  {
    id: 'meat',
    unit: 'KG',
    patterns: [
      /\b(liha|meat|nauta|beef|possu|pork|kana|chicken|broiler|karitsa|lamb|entrecote|entrecôte|ulkofile|sisäfile|t[-\s]?bone|tluu|flank|brisket|pihvi|steak|chorizo|pekoni|bacon|nduja|jamon|kassler|jauheliha|ground\s*beef)\b/i,
    ],
  },
  {
    id: 'seafood',
    unit: 'KG',
    patterns: [
      /\b(kala|fish|lohi|salmon|kirjolohi|trout|kuha|siika|scampi|shrimp|katkarapu|simpukka|mussel|scallop|kampasimpukka|mäti|roe|pulpo|octopus|silakka|muikku|anjovis|anchov)\b/i,
    ],
  },
  {
    id: 'vegetables',
    unit: 'KG',
    patterns: [
      /\b(vihannes|vegetable|sipuli|onion|peruna|potato|tomaatti|tomato|salaatti|lettuce|kurkku|cucumber|paprika|porkkana|carrot|basilika|minttu|tilli|lime|sitruuna|lemon|parsakaali|broccoli|kukkakaali|fenkoli|pinaatti|spinach|viikuna|fig)\b/i,
    ],
  },
  {
    id: 'frozen',
    unit: 'KG',
    patterns: [
      /\b(pakaste|frozen|jäätelö|ice\s*cream|ranskalaiset|fries|edamame|taikina|pastry|lihapulla|meatball)\b/i,
    ],
  },
  {
    id: 'dry_goods',
    unit: 'KG',
    patterns: [
      /\b(jauho|flour|sokeri|sugar|suola|salt|öljy|oil|etikka|vinegar|ketsuppi|sinappi|mustard|soija|miso|kaakao|suklaa|chocolate|hiiva|yeast|maizena|panko|hunaja|honey|tabasco|kapris|caper)\b/i,
    ],
  },
  {
    id: 'kitchen_alcohol',
    unit: 'L',
    patterns: [
      /\b(punkku|valkkari|viini|wine|alkoholi|alcohol|konjakki|cognac|rommi|rum|vodka|viski|whisky)\b/i,
    ],
  },
  {
    id: 'waste',
    unit: 'KG',
    patterns: [/\b(hävikki|waste|spoil|biojäte)\b/i],
  },
];

const FI_EN_PAIRS: [RegExp, string, string][] = [
  [/\bmaito\b/i, 'Milk', 'Maito'],
  [/\bmilk\b/i, 'Milk', 'Maito'],
  [/\bt[-\s]?bone\b/i, 'T-bone steak', 'T-luu pihvi'],
  [/\btluu\b/i, 'T-bone steak', 'T-luu pihvi'],
  [/\bpunkku\b/i, 'Red wine (kitchen)', 'Punkku'],
  [/\bvalkkari\b/i, 'White wine (kitchen)', 'Valkkari'],
  [/\bkana\b/i, 'Chicken', 'Kana'],
  [/\bchicken\b/i, 'Chicken', 'Kana'],
  [/\blohi\b/i, 'Salmon', 'Lohi'],
  [/\bsalmon\b/i, 'Salmon', 'Lohi'],
];

function titleCaseWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) =>
      w.length <= 2
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

function inferCategory(text: string): {
  id: SimplifiedItemCategoryId;
  unit: UnitCode;
  confidence: number;
} {
  for (const hint of CATEGORY_HINTS) {
    if (hint.patterns.some((p) => p.test(text))) {
      return {
        id: hint.id,
        unit: hint.unit ?? 'KPL',
        confidence: 0.82,
      };
    }
  }
  return { id: 'other', unit: 'KPL', confidence: 0.35 };
}

function bilingualNames(raw: string): { nameEn: string; nameFi: string } {
  const trimmed = raw.trim();
  for (const [re, en, fi] of FI_EN_PAIRS) {
    if (re.test(trimmed)) {
      const rest = trimmed.replace(re, '').trim();
      if (!rest) return { nameEn: en, nameFi: fi };
      return {
        nameEn: `${en} ${titleCaseWords(rest)}`.trim(),
        nameFi: `${fi} ${rest}`.trim(),
      };
    }
  }
  const titled = titleCaseWords(trimmed);
  return { nameEn: titled, nameFi: titled };
}

function nearestListItem(
  query: string,
  items: SimplifiedCountItem[],
): SimplifiedCountItem | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const hits = items.filter((row) => itemMatchesQuery(row, q));
  if (!hits.length) return null;
  const exact = hits.find(
    (h) =>
      h.nameEn.toLowerCase() === q ||
      h.nameFi.toLowerCase() === q ||
      (h.aliases ?? []).some((a) => a.toLowerCase() === q),
  );
  return exact ?? hits[0] ?? null;
}

function suggestPlace(
  categoryId: SimplifiedItemCategoryId,
  places: Place[] | undefined,
): { placeId: string | null; placeLabel: string | null } {
  if (!places?.length) return { placeId: null, placeLabel: null };
  const want =
    categoryId === 'frozen'
      ? 'freezer'
      : categoryId === 'dry_goods' || categoryId === 'kitchen_alcohol'
        ? 'dry_storage'
        : categoryId === 'dairy' ||
            categoryId === 'meat' ||
            categoryId === 'seafood' ||
            categoryId === 'vegetables'
          ? 'prep_fridge'
          : null;
  const byType = want
    ? places.find((p) => p.storageType === want)
    : undefined;
  const hit =
    byType ??
    places.find((p) =>
      categoryId === 'frozen'
        ? /freez|pakast/i.test(p.name)
        : categoryId === 'dry_goods' || categoryId === 'kitchen_alcohol'
          ? /dry|kuiva|upstairs|varasto/i.test(p.name)
          : /cold|cool|kylmä|fridge|jääkaap|prep|downstairs/i.test(p.name),
    ) ??
    places[0];
  return hit
    ? { placeId: hit.id, placeLabel: hit.name }
    : { placeId: null, placeLabel: null };
}

export function suggestSimpCountProduct(opts: {
  query: string;
  existingItems: SimplifiedCountItem[];
  byCategory?: Record<SimplifiedCategoryId, SimplifiedCountItem[]>;
  catalog?: Product[];
  places?: Place[];
  fallbackCategory?: SimplifiedItemCategoryId;
}): SimpProductSuggestion | null {
  const query = opts.query.trim();
  if (query.length < 2) return null;

  const existing = nearestListItem(query, opts.existingItems);
  const existingCategoryId =
    existing && opts.byCategory
      ? findItemCategory(opts.byCategory, existing.id)
      : null;

  const catalogHit =
    opts.catalog && opts.catalog.length
      ? bestMatch(opts.catalog, query)
      : null;

  const inferred = inferCategory(
    [
      query,
      catalogHit?.product.officialName,
      ...(catalogHit?.product.aliases ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );

  let categoryId = existingCategoryId ?? inferred.id;
  let unit: UnitCode = existing?.unit ?? inferred.unit;
  let unitPriceAlv0: number | null = existing?.unitPriceAlv0 ?? null;
  let nameEn: string;
  let nameFi: string;
  let aliases: string[] = existing?.aliases ? [...existing.aliases] : [];
  let confidence = inferred.confidence;
  let reason = 'name hints';
  let catalogProductId: string | null = null;

  if (existing) {
    nameEn = existing.nameEn;
    nameFi = existing.nameFi;
    confidence = 0.92;
    reason = 'already on list';
  } else if (catalogHit && catalogHit.score >= 0.55) {
    const p = catalogHit.product;
    catalogProductId = p.id;
    nameEn = p.officialName;
    nameFi = p.officialName;
    unit = p.unit;
    unitPriceAlv0 = p.unitPriceAlv0 ?? null;
    aliases = [...(p.aliases ?? [])];
    confidence = Math.max(confidence, catalogHit.score);
    reason = 'catalog match';
    const it = p.ingredientType;
    if (it === 'dairy') categoryId = 'dairy';
    else if (it === 'meat' || it === 'poultry' || it === 'deli')
      categoryId = 'meat';
    else if (it === 'produce') categoryId = 'vegetables';
    else if (it === 'frozen') categoryId = 'frozen';
    else if (it === 'dry_goods' || it === 'oils' || it === 'sauces')
      categoryId = 'dry_goods';
  } else {
    const bi = bilingualNames(query);
    nameEn = bi.nameEn;
    nameFi = bi.nameFi;
  }

  const generated = generateProductAliases({
    officialName: nameFi || nameEn,
    extra: [nameEn, nameFi, query, ...aliases],
  });
  aliases = [...new Set([...aliases, ...generated])]
    .filter(
      (a) =>
        a.toLowerCase() !== nameEn.toLowerCase() &&
        a.toLowerCase() !== nameFi.toLowerCase(),
    )
    .slice(0, 12);

  if (unitPriceAlv0 == null || unitPriceAlv0 <= 0) {
    const peers = opts.existingItems.filter((row) =>
      itemMatchesQuery(row, nameEn.split(/\s+/)[0] ?? nameEn),
    );
    const priced = peers.find((p) => p.unitPriceAlv0 > 0);
    if (priced) unitPriceAlv0 = priced.unitPriceAlv0;
  }

  if (
    opts.fallbackCategory &&
    categoryId === 'other' &&
    opts.fallbackCategory !== 'other'
  ) {
    categoryId = opts.fallbackCategory;
    confidence = Math.min(confidence, 0.5);
    reason = 'current category';
  }

  const place = suggestPlace(categoryId, opts.places);

  return {
    nameEn,
    nameFi,
    categoryId,
    unit,
    unitPriceAlv0,
    aliases,
    existingItemId: existing?.id ?? null,
    existingCategoryId,
    catalogProductId,
    placeId: place.placeId,
    placeLabel: place.placeLabel,
    confidence,
    reason,
  };
}

export function flatItemsForSuggest(
  byCategory: Record<string, SimplifiedCountItem[]>,
): SimplifiedCountItem[] {
  return flattenAllItems(
    byCategory as Parameters<typeof flattenAllItems>[0],
  );
}
