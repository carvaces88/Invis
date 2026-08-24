/**
 * Gemini vision → VisionExtract (structured JSON).
 * Reads actual image pixels (base64); not filename/hint heuristics.
 */
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import type {
  DocumentExtract,
  IngredientType,
  UnitCode,
  VisionCropRegion,
  VisionExtract,
} from '../data/types';
import { UNIT_CODES } from '../data/units';
import { getProxyAuthHeaders } from './auth/sessionBridge';
import { normalizeEanDigits } from './packaging';
import { generateProductAliases, mergeAliasLists } from './productAliases';
import { getGeminiApiKey, getGeminiModel, getVisionProxyUrl } from './visionConfig';

/** Prefer authenticated proxy when signed in so per-venue Gemini quotas apply. */
function preferVisionProxy(): boolean {
  const headers = getProxyAuthHeaders();
  return Boolean(headers.Authorization && headers['X-Venue-Id']);
}

const UNIT_SET = new Set<string>(UNIT_CODES);

const INGREDIENT_TYPES: IngredientType[] = [
  'produce',
  'dairy',
  'oils',
  'dry_goods',
  'sauces',
  'nuts_seeds',
  'canned',
  'bakery',
  'frozen',
  'meat',
  'poultry',
  'deli',
  'other',
];

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

export type ImagePayload = { mimeType: string; base64: string };

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    suggestedName: {
      type: 'string',
      description:
        'Best product name as staff would say it; prefer Finnish retail/POS style when readable on label',
    },
    brand: { type: 'string', nullable: true },
    unit: {
      type: 'string',
      nullable: true,
      description:
        'Finnish POS YKSIKKÖ: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT',
    },
    packSize: {
      type: 'string',
      nullable: true,
      description: 'e.g. 935g/600g or 5 kg',
    },
    containerHint: {
      type: 'string',
      nullable: true,
      description:
        'Packaging style from label/logo: e.g. "Tetra Pak / kartonki", Purkki, Pullo, Pussi, Rasia, Laatikko. Read Tetra Pak marks, C/PAP, kartonki recycling cues.',
    },
    quantity: { type: 'number', nullable: true },
    unitPriceAlv0: {
      type: 'number',
      nullable: true,
      description:
        'Estimated unit price excl. VAT (0% ALV). If shelf price includes 14% food VAT, convert to ALV0.',
    },
    ean: {
      type: 'string',
      nullable: true,
      description:
        'EAN/GTIN digits only (8–14). CRITICAL: if a barcode is visible (bars + human-readable digits under it), read those digits carefully even when glare or crop is tight. Prefer the printed number under the bars.',
    },
    aliases: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Informal EN/FI search nicknames: brand, product line (Tuuti 2 / Tuuti2), category words (vieroitusvalmiste, follow-on formula), OCR variants without spaces/hyphens',
    },
    ingredientType: {
      type: 'string',
      nullable: true,
      description: INGREDIENT_TYPES.join(', '),
    },
    confidence: { type: 'number' },
    rawNotes: { type: 'string', nullable: true },
    unrecognized: { type: 'boolean', nullable: true },
  },
  required: ['suggestedName', 'confidence'],
} as const;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  // Metro / RN without btoa — encode manually
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triplet =
      b === undefined
        ? a << 16
        : c === undefined
          ? (a << 16) | (b << 8)
          : (a << 16) | (b << 8) | c;
    out += alphabet[(triplet >> 18) & 63];
    out += alphabet[(triplet >> 12) & 63];
    out += b === undefined ? '=' : alphabet[(triplet >> 6) & 63];
    out += c === undefined || b === undefined ? '=' : alphabet[triplet & 63];
  }
  return out;
}

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function isRealImageUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const u = uri.trim();
  if (!u || u === 'demo' || u.startsWith('demo-')) return false;
  return (
    u.startsWith('file:') ||
    u.startsWith('content:') ||
    u.startsWith('ph:') ||
    u.startsWith('assets-library:') ||
    u.startsWith('data:') ||
    u.startsWith('blob:') ||
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.includes('/') // local path / ImagePicker uri
  );
}

/** Keep payloads under Vercel/serverless body limits (~4.5MB). */
const MAX_VISION_BASE64_CHARS = 1_800_000;
const MAX_VISION_EDGE_PX = 1280;

async function maybeDownscalePayload(
  mimeType: string,
  base64: string,
): Promise<ImagePayload> {
  if (base64.length <= MAX_VISION_BASE64_CHARS) {
    return { mimeType, base64 };
  }
  // Web: canvas downscale. Native: send as-is (picker quality already ~0.75).
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { mimeType, base64 };
  }
  try {
    const src = `data:${mimeType};base64,${base64}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Vision image decode failed'));
      el.src = src;
    });
    const scale = Math.min(
      1,
      MAX_VISION_EDGE_PX / Math.max(img.width, img.height),
    );
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { mimeType, base64 };
    ctx.drawImage(img, 0, 0, w, h);
    let quality = 0.72;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > MAX_VISION_BASE64_CHARS && quality > 0.4) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    const match = /^data:([^;]+);base64,(.+)$/.exec(out);
    if (!match) return { mimeType, base64 };
    return { mimeType: match[1], base64: match[2] };
  } catch {
    return { mimeType, base64 };
  }
}

export async function imageUriToPayload(uri: string): Promise<ImagePayload> {
  if (uri.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(uri);
    if (!match) throw new Error('Invalid data URI for vision');
    return maybeDownscalePayload(
      match[1],
      match[2].replace(/\s/g, ''),
    );
  }

  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('blob:')
  ) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    const buf = await res.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(buf));
    const mime =
      res.headers.get('content-type')?.split(';')[0]?.trim() ||
      mimeFromUri(uri);
    return maybeDownscalePayload(mime, base64);
  }

  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
  return maybeDownscalePayload(mimeFromUri(uri), base64);
}

function parseUnit(raw: unknown): UnitCode | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  return UNIT_SET.has(u) ? (u as UnitCode) : null;
}

function parseIngredient(raw: unknown): IngredientType | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase() as IngredientType;
  return INGREDIENT_TYPES.includes(v) ? v : null;
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function toVisionExtract(raw: Record<string, unknown>): VisionExtract {
  const suggestedName =
    typeof raw.suggestedName === 'string' && raw.suggestedName.trim()
      ? raw.suggestedName.trim()
      : 'Unknown item';
  const brand =
    typeof raw.brand === 'string' && raw.brand.trim()
      ? raw.brand.trim()
      : null;
  const packSize =
    typeof raw.packSize === 'string' && raw.packSize.trim()
      ? raw.packSize.trim()
      : null;
  const containerHint =
    typeof raw.containerHint === 'string' && raw.containerHint.trim()
      ? raw.containerHint.trim()
      : null;
  const ean =
    typeof raw.ean === 'string' ? normalizeEanDigits(raw.ean) : null;
  const modelAliases = Array.isArray(raw.aliases)
    ? raw.aliases
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
    : [];
  const aliases = mergeAliasLists(
    generateProductAliases({
      officialName: suggestedName,
      brand,
      packSize,
      ean,
      containerHint,
      extra: modelAliases,
    }),
  );

  const confidence =
    typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.7;

  // Liquid cartons (Tetra / kartonki) are usually counted as KPL + packSize volume
  let unit = parseUnit(raw.unit);
  if (
    containerHint &&
    /tetra|kartonk/i.test(containerHint) &&
    (unit === 'L' || unit == null)
  ) {
    unit = 'KPL';
  }

  return {
    suggestedName,
    unit,
    quantity:
      typeof raw.quantity === 'number' && Number.isFinite(raw.quantity)
        ? raw.quantity
        : 1,
    unitPriceAlv0:
      typeof raw.unitPriceAlv0 === 'number' && Number.isFinite(raw.unitPriceAlv0)
        ? Math.round(raw.unitPriceAlv0 * 100) / 100
        : null,
    expiryDate: null,
    confidence,
    rawNotes:
      typeof raw.rawNotes === 'string' && raw.rawNotes.trim()
        ? raw.rawNotes.trim()
        : 'Live Gemini label read',
    packSize,
    brand,
    containerHint,
    ean,
    aliases,
    ingredientType: parseIngredient(raw.ingredientType),
    unrecognized: Boolean(raw.unrecognized),
  };
}

const SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Read product label / pack / barcode photos carefully (OCR). Return JSON only.

PRIORITY when multiple photos:
1) Barcode close-ups: read EAN-13 digits under the bars (digits only in "ean"). Glare is common — still try.
2) Front label: brand + product line + Finnish title + size (e.g. Valio Tuuti2 / TUUTI 2, 1 L).
3) Packaging cues: Tetra Pak logo, "kartonki", C/PAP, pullo, purkki → containerHint + POS unit.

YKSIKKÖ (POS unit): L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
- Ready-to-drink Tetra Pak / kartonki sold per carton → unit KPL, packSize like "1 L" (volume in packSize, not unit L).
- Loose liquids by liter → L; bottles → PL/PLO; cans/jars → PRK.

Prices at 0% ALV. Finnish food shelf € usually includes 14% VAT → shelf€ / 1.14.
suggestedName: prefer official Finnish retail style when readable (brand + product + size/age).
aliases: FI + EN nicknames staff type (Tuuti 2, vieroitusvalmiste, follow-on formula, etc.).
If unsure, unrecognized true + rawNotes — still best-guess suggestedName.`;

export async function analyzeImagesWithGemini(
  imageUris: string[],
  hint?: string,
): Promise<VisionExtract> {
  const realUris = imageUris.filter(isRealImageUri);
  if (!realUris.length) {
    throw new Error('No product photo to analyze');
  }

  // Cap payload size — first 4 close-ups are enough for label + barcode
  const payloads: ImagePayload[] = [];
  for (const uri of realUris.slice(0, 4)) {
    payloads.push(await imageUriToPayload(uri));
  }

  // Prefer proxy when authenticated so shared Gemini key is rate-limited per venue.
  const proxyUrl = getVisionProxyUrl();
  if (proxyUrl && preferVisionProxy()) {
    return callVisionProxy(payloads, hint, proxyUrl);
  }

  const apiKey = getGeminiApiKey();
  if (apiKey) {
    return callGeminiDirect(payloads, hint, apiKey);
  }

  if (proxyUrl) {
    return callVisionProxy(payloads, hint, proxyUrl);
  }

  throw new Error(
    'Live vision is not configured. Set EXPO_PUBLIC_GEMINI_API_KEY or GEMINI_API_KEY on /api/vision.',
  );
}

async function callVisionProxy(
  payloads: ImagePayload[],
  hint: string | undefined,
  proxyUrl: string,
): Promise<VisionExtract> {
  let res: Response;
  try {
    res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        ...getProxyAuthHeaders(),
      },
      body: JSON.stringify({
        images: payloads.map((p) => ({
          mimeType: p.mimeType,
          base64: p.base64,
        })),
        hint: hint?.trim() || undefined,
        model: getGeminiModel(),
        mode: 'product',
      }),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Vision proxy unreachable: ${err.message}`
        : 'Vision proxy unreachable',
    );
  }
  let body: VisionExtract & { error?: string };
  try {
    body = (await res.json()) as VisionExtract & { error?: string };
  } catch {
    throw new Error(
      res.status === 413
        ? 'Photo too large for vision proxy — try a closer crop'
        : `Vision proxy returned non-JSON (${res.status})`,
    );
  }
  if (!res.ok) {
    throw new Error(body.error || `Vision proxy failed (${res.status})`);
  }
  if (!body.suggestedName) {
    throw new Error('Vision proxy returned an empty extract');
  }
  return {
    suggestedName: body.suggestedName,
    unit: (body.unit as VisionExtract['unit']) ?? 'KPL',
    quantity: body.quantity ?? 1,
    unitPriceAlv0: body.unitPriceAlv0 ?? null,
    expiryDate: body.expiryDate ?? null,
    confidence: body.confidence ?? 0.5,
    rawNotes: body.rawNotes ?? 'Live Gemini (proxy)',
    packSize: body.packSize ?? null,
    brand: body.brand ?? null,
    containerHint: body.containerHint ?? null,
    ean: body.ean ?? null,
    aliases: body.aliases ?? [],
    ingredientType: body.ingredientType ?? null,
    unrecognized: body.unrecognized,
  };
}

async function callGeminiDirect(
  payloads: ImagePayload[],
  hint: string | undefined,
  apiKey: string,
): Promise<VisionExtract> {
  const parts: GeminiPart[] = [
    ...payloads.map((p) => ({
      inlineData: { mimeType: p.mimeType, data: p.base64 },
    })),
    {
      text: [
        SYSTEM_PROMPT,
        hint?.trim()
          ? `Optional staff hint (may be wrong): ${hint.trim()}`
          : null,
        `Analyze ${payloads.length} close-up photo(s) of one product (front label and/or barcode).`,
        'If any photo shows a barcode, put EAN digits in "ean". Prefer official Finnish retail name when readable.',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: VISION_SCHEMA,
      },
    }),
  });

  const body = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(
      body.error?.message || `Gemini vision failed (${res.status})`,
    );
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini returned empty vision result');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonText(text)) as Record<string, unknown>;
  } catch {
    throw new Error('Gemini returned non-JSON vision result');
  }

  const extract = toVisionExtract(parsed);
  extract.rawNotes = [
    extract.rawNotes,
    `Live Gemini (${model}) · ${payloads.length} photo(s)`,
  ]
    .filter(Boolean)
    .join(' · ');
  return extract;
}

const FRIDGE_SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Analyze a WIDE fridge / walk-in / shelf panorama photo. Return JSON only.

List EVERY distinct product visible (do not merge different brands/sizes).
For each product estimate quantity by counting cans, bottles, jars, packs, bags, or crates you can see.
YKSIKKÖ (POS unit codes — pick one): L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
- RSA and RAS are both "Rasia" but DIFFERENT codes — prefer RAS for retail tubs/trays, RSA when labeled as rasia pack count.
- Bottles → PL or PLO; cans/jars → PRK; bags → PSS; crates/boxes → LTK; packets → PKT; pieces → KPL; weight → KG; volume bulk → L.

crop: normalized 0–1 box {x,y,width,height} around that product in the photo when you can locate it.
confidence: 0–1 how sure you are of the name.
brand, packSize (e.g. "5 kg", "380 g"), containerHint (purkki, pullo, pussi…), aliases (FI/EN nicknames).
Prices at 0% ALV if you see a shelf tag (€ ÷ 1.14 for 14% food VAT).
If a pack is unreadable, still include a line with unrecognized true + best-guess suggestedName + aiDescription.
suggestedName: Finnish retail style when readable (brand + product).`;

const FRIDGE_LINE_SCHEMA = {
  type: 'object',
  properties: {
    suggestedName: { type: 'string' },
    brand: { type: 'string', nullable: true },
    unit: {
      type: 'string',
      nullable: true,
      description: 'L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT',
    },
    packSize: { type: 'string', nullable: true },
    containerHint: { type: 'string', nullable: true },
    quantity: { type: 'number', nullable: true },
    unitPriceAlv0: { type: 'number', nullable: true },
    ean: { type: 'string', nullable: true },
    aliases: { type: 'array', items: { type: 'string' } },
    ingredientType: { type: 'string', nullable: true },
    confidence: { type: 'number' },
    rawNotes: { type: 'string', nullable: true },
    aiDescription: { type: 'string', nullable: true },
    unrecognized: { type: 'boolean', nullable: true },
    crop: {
      type: 'object',
      nullable: true,
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
  required: ['suggestedName', 'confidence'],
} as const;

const FRIDGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', nullable: true },
    confidence: { type: 'number' },
    rawNotes: { type: 'string', nullable: true },
    lines: {
      type: 'array',
      items: FRIDGE_LINE_SCHEMA,
    },
  },
  required: ['lines', 'confidence'],
} as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseCrop(raw: unknown): VisionCropRegion | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Record<string, unknown>;
  const x = typeof c.x === 'number' ? c.x : NaN;
  const y = typeof c.y === 'number' ? c.y : NaN;
  const width = typeof c.width === 'number' ? c.width : NaN;
  const height = typeof c.height === 'number' ? c.height : NaN;
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return {
    x: clamp01(x),
    y: clamp01(y),
    width: clamp01(width),
    height: clamp01(height),
  };
}

function toFridgeLine(raw: Record<string, unknown>): VisionExtract {
  const base = toVisionExtract(raw);
  const aiDescription =
    typeof raw.aiDescription === 'string' && raw.aiDescription.trim()
      ? raw.aiDescription.trim()
      : undefined;
  const crop = parseCrop(raw.crop);
  return {
    ...base,
    aiDescription,
    crop,
  };
}

function toDocumentExtract(
  raw: Record<string, unknown>,
  noteSuffix: string,
): DocumentExtract {
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map(toFridgeLine);
  const confidence =
    typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : lines.length
        ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length
        : 0.5;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : 'Fridge / shelf';
  const rawNotes = [
    typeof raw.rawNotes === 'string' && raw.rawNotes.trim()
      ? raw.rawNotes.trim()
      : null,
    noteSuffix,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    kind: 'fridge',
    title,
    lines,
    confidence,
    rawNotes,
  };
}

/**
 * Multi-item fridge / shelf panorama → DocumentExtract for FridgeReview.
 */
export async function analyzeFridgeShelfWithGemini(
  imageUri: string,
): Promise<DocumentExtract> {
  if (!isRealImageUri(imageUri)) {
    throw new Error('No fridge photo to analyze');
  }

  const payload = await imageUriToPayload(imageUri);
  const proxyUrl = getVisionProxyUrl();
  if (proxyUrl && preferVisionProxy()) {
    return callVisionFridgeProxy([payload], proxyUrl);
  }

  const apiKey = getGeminiApiKey();
  if (apiKey) {
    return callGeminiFridgeDirect([payload], apiKey);
  }

  if (proxyUrl) {
    return callVisionFridgeProxy([payload], proxyUrl);
  }

  throw new Error(
    'Live vision is not configured. Set EXPO_PUBLIC_GEMINI_API_KEY or GEMINI_API_KEY on /api/vision.',
  );
}

async function callVisionFridgeProxy(
  payloads: ImagePayload[],
  proxyUrl: string,
): Promise<DocumentExtract> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      ...getProxyAuthHeaders(),
    },
    body: JSON.stringify({
      mode: 'fridge',
      images: payloads.map((p) => ({
        mimeType: p.mimeType,
        base64: p.base64,
      })),
      model: getGeminiModel(),
    }),
  });
  const body = (await res.json()) as DocumentExtract & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Vision proxy failed (${res.status})`);
  }
  if (!Array.isArray(body.lines)) {
    throw new Error('Vision proxy returned an empty fridge extract');
  }
  return {
    kind: 'fridge',
    title: body.title ?? 'Fridge / shelf',
    lines: body.lines.map((l) => ({
      ...l,
      unit: (l.unit as VisionExtract['unit']) ?? null,
      quantity: l.quantity ?? 1,
      confidence: l.confidence ?? 0.5,
    })),
    confidence: body.confidence ?? 0.5,
    rawNotes: body.rawNotes ?? 'Live Gemini fridge (proxy)',
  };
}

async function callGeminiFridgeDirect(
  payloads: ImagePayload[],
  apiKey: string,
): Promise<DocumentExtract> {
  const parts: GeminiPart[] = [
    ...payloads.map((p) => ({
      inlineData: { mimeType: p.mimeType, data: p.base64 },
    })),
    {
      text: [
        FRIDGE_SYSTEM_PROMPT,
        'Analyze this fridge/shelf panorama. List every distinct product with estimated count.',
      ].join('\n'),
    },
  ];

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: FRIDGE_SCHEMA,
      },
    }),
  });

  const body = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(
      body.error?.message || `Gemini fridge vision failed (${res.status})`,
    );
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Gemini returned empty fridge vision result');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonText(text)) as Record<string, unknown>;
  } catch {
    throw new Error('Gemini returned non-JSON fridge vision result');
  }

  return toDocumentExtract(
    parsed,
    `Live Gemini fridge (${model}) · ${payloads.length} photo(s)`,
  );
}
