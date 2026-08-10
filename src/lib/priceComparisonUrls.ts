/**
 * Deep-link / search URL builders for Price comparison competitors.
 */

/** K-Ruoka public search */
export function kruokaSearchUrl(query: string, ean?: string | null): string {
  const q = (ean?.replace(/\D/g, '') || query).trim();
  return `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(q)}`;
}

/** S-Kaupat product listing search */
export function skaupatSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return 'https://www.s-kaupat.fi/tuotteet';
  return `https://www.s-kaupat.fi/tuotteet?searchString=${encodeURIComponent(q)}`;
}

/**
 * Valio Aimo Pikatukku (Aimo / Heinon Tukku wholesale).
 * Official catalog: https://pikatukku.valioaimo.fi/fi
 * No public product search API — best-effort search path, else home.
 */
export const AIMO_PIKATUKKU_HOME = 'https://pikatukku.valioaimo.fi/fi';

export function aimoPikatukkuSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return AIMO_PIKATUKKU_HOME;
  return `${AIMO_PIKATUKKU_HOME}/search/?text=${encodeURIComponent(q)}`;
}

/** Vihannespörssi — no public product search; open catalog home */
export const VIHANNESPORSSI_HOME = 'https://vegeporssi.fi/';

export function vihannesporssiUrl(_query?: string): string {
  return VIHANNESPORSSI_HOME;
}

/**
 * Lidl Suomi — food & drink category (no public price API).
 * Category home: https://www.lidl.fi/c/ruoka-ja-juoma/
 * Best-effort site search when a query is available.
 */
export const LIDL_FOOD_HOME = 'https://www.lidl.fi/c/ruoka-ja-juoma/';

export function lidlSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return LIDL_FOOD_HOME;
  return `https://www.lidl.fi/q/search?q=${encodeURIComponent(q)}`;
}
