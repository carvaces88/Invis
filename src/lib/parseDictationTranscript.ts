/**
 * Turn fridge walk-through speech into DocumentExtract lines for FridgeReview.
 * Local heuristic parser — no extra API call after STT.
 */
import type { DocumentExtract, UnitCode, VisionExtract } from '../data/types';
import { UNIT_CODES } from '../data/units';

const UNIT_SET = new Set<string>(UNIT_CODES);

const NUMBER_WORDS: Record<string, number> = {
  // EN
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  // FI
  yksi: 1,
  kaks: 2,
  kaksi: 2,
  kolme: 3,
  nelja: 4,
  neljä: 4,
  viisi: 5,
  kuusi: 6,
  seitseman: 7,
  seitsemän: 7,
  kahdeksan: 8,
  yhdeksan: 9,
  yhdeksän: 9,
  kymmenen: 10,
  puoli: 0.5,
};

/** Spoken / POS unit phrases → UnitCode (longer phrases first). */
const UNIT_PHRASES: { re: RegExp; code: UnitCode }[] = [
  { re: /\b(liters?|litres?|litraa?|litran)\b/gi, code: 'L' },
  { re: /\b(kilograms?|kilos?|kiloa|kilogrammaa?)\b/gi, code: 'KG' },
  { re: /\b(pieces?|items?|kappale(?:tta|et)?)\b/gi, code: 'KPL' },
  { re: /\b(jars?|cans?|purkke?j?a?|purkin)\b/gi, code: 'PRK' },
  { re: /\b(buckets?|ämpäreitä|ämpärin|ampareita)\b/gi, code: 'LTK' },
  { re: /\b(bags?|pouches?|pusseja?|pussin)\b/gi, code: 'PSS' },
  { re: /\b(bottles?|pulloja?|pullon)\b/gi, code: 'PL' },
  { re: /\b(crates?|boxes|box|laatikko(?:a|ja)?|laatikon)\b/gi, code: 'LTK' },
  { re: /\b(packets?|packages?|pakette?j?a?|paketin)\b/gi, code: 'PKT' },
  { re: /\b(trays?|rasioita|rasian)\b/gi, code: 'RSA' },
  { re: /\b(tubs?)\b/gi, code: 'PRK' },
  // POS abbreviations (word boundaries)
  { re: /\bplo\b/gi, code: 'PLO' },
  { re: /\bpl\b/gi, code: 'PL' },
  { re: /\bprk\b/gi, code: 'PRK' },
  { re: /\bpss\b/gi, code: 'PSS' },
  { re: /\bltk\b/gi, code: 'LTK' },
  { re: /\bpkt\b/gi, code: 'PKT' },
  { re: /\brsa\b/gi, code: 'RSA' },
  { re: /\bras\b/gi, code: 'RAS' },
  { re: /\bkpl\b/gi, code: 'KPL' },
  { re: /\bkg\b/gi, code: 'KG' },
  { re: /\bl\b/gi, code: 'L' },
];

const FILLER_RE =
  /\b(about|approximately|roughly|maybe|like|noin|suunnilleen|ehkä|jotain|of|of\s+the)\b/gi;

function splitSegments(transcript: string): string[] {
  return transcript
    .replace(/\r\n/g, '\n')
    .split(/[\n;]+|(?:,\s*)+|(?:\s+and\s+)|(?:\s+ja\s+)|(?:\s+plus\s+)|(?:\s+sekä\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseNumberToken(token: string): number | null {
  const t = token.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  if (NUMBER_WORDS[t] != null) return NUMBER_WORDS[t]!;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractUnit(text: string): { unit: UnitCode | null; rest: string } {
  let rest = text;
  let unit: UnitCode | null = null;
  for (const { re, code } of UNIT_PHRASES) {
    re.lastIndex = 0;
    if (re.test(rest)) {
      unit = code;
      rest = rest.replace(re, ' ');
      break;
    }
  }
  // Bare POS code leftover after cleanup
  if (!unit) {
    const bare = rest.match(/\b([A-Za-z]{1,3})\b/);
    if (bare) {
      const u = bare[1]!.toUpperCase();
      if (UNIT_SET.has(u)) {
        unit = u as UnitCode;
        rest = rest.replace(bare[0], ' ');
      }
    }
  }
  return { unit, rest: rest.replace(/\s+/g, ' ').trim() };
}

function stripFillers(text: string): string {
  return text.replace(FILLER_RE, ' ').replace(/\s+/g, ' ').trim();
}

function pullLeadingQty(text: string): { qty: number | null; rest: string } {
  const lead = text.match(/^(\d+(?:[.,]\d+)?|[A-Za-zÄÖäöÅå]+)\s+(.+)$/u);
  if (!lead) return { qty: null, rest: text };
  const n = parseNumberToken(lead[1]!);
  if (n == null) return { qty: null, rest: text };
  return { qty: n, rest: lead[2]! };
}

function pullTrailingQty(text: string): { qty: number | null; rest: string } {
  const trail = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)$/u);
  if (!trail) return { qty: null, rest: text };
  const n = parseNumberToken(trail[2]!);
  if (n == null) return { qty: null, rest: text };
  return { qty: n, rest: trail[1]! };
}

/**
 * Parse one spoken segment into a VisionExtract.
 * Examples: "two mayo", "3 jars of capers", "kapris 2 prk", "oliiviöljy litra"
 */
export function parseDictationSegment(segment: string): VisionExtract | null {
  let text = stripFillers(segment.replace(/^[-•*]+\s*/, ''));
  if (!text) return null;

  let quantity: number | null = null;

  // Leading qty: "2 mayo", "two jars of milk"
  const lead = pullLeadingQty(text);
  if (lead.qty != null) {
    quantity = lead.qty;
    text = lead.rest;
  }

  // Pull unit anywhere: "jars of capers", "kapris 2 prk"
  const unitHit = extractUnit(text);
  const unit = unitHit.unit;
  text = unitHit.rest;

  // Trailing qty after unit strip: "kapris 2"
  if (quantity == null) {
    const trail = pullTrailingQty(text);
    if (trail.qty != null) {
      quantity = trail.qty;
      text = trail.rest;
    }
  }

  // "of X" leftover → name is X
  text = text.replace(/^(of|the)\s+/i, '').trim();
  const name = text.replace(/\s+/g, ' ').trim();
  if (!name || name.length < 2) return null;

  // If only a unit word was spoken with a number ("two liters") — skip as product
  if (UNIT_SET.has(name.toUpperCase()) || /^(liters?|kilos?)$/i.test(name)) {
    return null;
  }

  return {
    suggestedName: name,
    unit,
    quantity: quantity ?? 1,
    confidence: quantity != null || unit != null ? 0.72 : 0.55,
    rawNotes: `Voice: “${segment.trim()}”`,
  };
}

/**
 * Full transcript → fridge DocumentExtract for FridgeReview.
 */
export function transcriptToFridgeDocument(
  transcript: string,
  options?: { title?: string },
): DocumentExtract | null {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const segments = splitSegments(cleaned);
  const lines: VisionExtract[] = [];
  for (const seg of segments) {
    const line = parseDictationSegment(seg);
    if (line) lines.push(line);
  }

  // Single blob with no separators — still try whole string
  if (lines.length === 0) {
    const one = parseDictationSegment(cleaned);
    if (one) lines.push(one);
  }

  if (lines.length === 0) return null;

  const avg =
    lines.reduce((s, l) => s + (l.confidence ?? 0.6), 0) / lines.length;

  return {
    kind: 'fridge',
    title: options?.title ?? 'Voice walk-through',
    confidence: Math.min(0.9, avg),
    rawNotes: `Dictated: ${cleaned}`,
    lines,
  };
}

/** How many inventory lines the transcript likely yields. */
export function countDictationLines(transcript: string): number {
  return transcriptToFridgeDocument(transcript)?.lines.length ?? 0;
}
