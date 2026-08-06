/**
 * Search aliases for Add Product / catalog match from brand, line name,
 * pack size, EAN, and common FI/EN kitchen wording variants.
 */

export type AliasSeed = {
  officialName: string;
  brand?: string | null;
  packSize?: string | null;
  ean?: string | null;
  containerHint?: string | null;
  extra?: string[];
};

function pushUnique(out: string[], seen: Set<string>, raw: string) {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length < 2) return;
  const key = t.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(t);
}

/** Collapse spaced product-line numerals: "Tuuti 2" ↔ "Tuuti2". */
function spacedNumVariants(s: string): string[] {
  const out: string[] = [];
  const collapsed = s.replace(/(\p{L})\s+(\d)\b/gu, '$1$2');
  const expanded = s.replace(/(\p{L})(\d)\b/gu, '$1 $2');
  if (collapsed !== s) out.push(collapsed);
  if (expanded !== s) out.push(expanded);
  return out;
}

/**
 * Build informal FI/EN aliases staff might type when searching inventory.
 * Always includes officialName; never invents unrelated brands.
 */
export function generateProductAliases(seed: AliasSeed): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const name = seed.officialName.trim();
  pushUnique(out, seen, name);
  pushUnique(out, seen, name.toLowerCase());

  for (const v of spacedNumVariants(name)) {
    pushUnique(out, seen, v);
    pushUnique(out, seen, v.toLowerCase());
  }

  const brand = seed.brand?.trim();
  if (brand) {
    pushUnique(out, seen, brand);
    pushUnique(out, seen, brand.toLowerCase());
  }

  // Drop size/age suffixes for shorter search keys
  const withoutSize = name
    .replace(/\b\d+([.,]\d+)?\s*(kg|g|l|ml|cl|dl)\b/gi, '')
    .replace(/\b\d+\s*[-–]?\s*\d*\s*kk\b/gi, '')
    .replace(/\b\d+\+\s*kk\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (withoutSize && withoutSize.toLowerCase() !== name.toLowerCase()) {
    pushUnique(out, seen, withoutSize);
    pushUnique(out, seen, withoutSize.toLowerCase());
    for (const v of spacedNumVariants(withoutSize)) {
      pushUnique(out, seen, v.toLowerCase());
    }
  }

  if (brand && withoutSize) {
    const rest = withoutSize
      .replace(new RegExp(`^${brand}\\s*`, 'i'), '')
      .trim();
    if (rest.length >= 3) {
      pushUnique(out, seen, rest);
      pushUnique(out, seen, rest.toLowerCase());
      pushUnique(out, seen, `${brand} ${rest}`.toLowerCase());
      for (const v of spacedNumVariants(rest)) {
        pushUnique(out, seen, v.toLowerCase());
        pushUnique(out, seen, `${brand} ${v}`.toLowerCase());
      }
    }
  }

  if (seed.packSize?.trim()) {
    const ps = seed.packSize.trim();
    pushUnique(out, seen, ps);
    if (brand) pushUnique(out, seen, `${brand} ${ps}`.toLowerCase());
    if (withoutSize) {
      pushUnique(out, seen, `${withoutSize} ${ps}`.toLowerCase());
    }
  }

  const ean = seed.ean?.replace(/\D/g, '');
  if (ean && ean.length >= 8) pushUnique(out, seen, ean);

  const lower = name.toLowerCase();
  // Finnish baby / follow-on formula wording (Valio Tuuti family)
  if (/tuuti|vieroitus|korvike|äidinmaidon|aidinmaidon/i.test(lower)) {
    for (const a of [
      'tuuti',
      'tuuti 2',
      'tuuti2',
      'valio tuuti',
      'valio tuuti 2',
      'valio tuuti2',
      'vieroitusvalmiste',
      'käyttövalmis vieroitusvalmiste',
      'kayttovalmis vieroitusvalmiste',
      'maitopohjainen vieroitusvalmiste',
      'follow-on formula',
      'follow on formula',
      'baby formula',
      'infant formula',
      'ready to feed formula',
      'valmis korvike',
    ]) {
      pushUnique(out, seen, a);
    }
  }

  if (seed.containerHint) {
    const c = seed.containerHint.toLowerCase();
    if (/tetra|kartonk/.test(c)) {
      pushUnique(out, seen, 'tetra pak');
      pushUnique(out, seen, 'kartonki');
    }
  }

  for (const a of seed.extra ?? []) {
    pushUnique(out, seen, a);
  }

  return out;
}

/** Merge alias lists, preserving first-seen casing. */
export function mergeAliasLists(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const a of list ?? []) {
      pushUnique(out, seen, a);
    }
  }
  return out;
}
