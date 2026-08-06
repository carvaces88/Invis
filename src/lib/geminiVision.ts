/**
 * Gemini vision → VisionExtract (structured JSON).
 * Reads actual image pixels (base64); not filename/hint heuristics.
 */
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import type {
  IngredientType,
  UnitCode,
  VisionExtract,
} from '../data/types';
import { UNIT_CODES } from '../data/units';
import { getGeminiApiKey, getGeminiModel } from './visionConfig';

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
      description: 'Purkki / Pullo / Pussi etc.',
    },
    quantity: { type: 'number', nullable: true },
    unitPriceAlv0: {
      type: 'number',
      nullable: true,
      description:
        'Estimated unit price excl. VAT (0% ALV). If shelf price includes 14% food VAT, convert to ALV0.',
    },
    ean: { type: 'string', nullable: true },
    aliases: {
      type: 'array',
      items: { type: 'string' },
      description: 'Informal EN/FI nicknames staff might type',
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

export async function imageUriToPayload(uri: string): Promise<ImagePayload> {
  if (uri.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(uri);
    if (!match) throw new Error('Invalid data URI for vision');
    return { mimeType: match[1], base64: match[2].replace(/\s/g, '') };
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
    return { mimeType: mime, base64 };
  }

  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
  return { mimeType: mimeFromUri(uri), base64 };
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
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
    : [];
  if (!aliases.includes(suggestedName)) aliases.unshift(suggestedName);

  const confidence =
    typeof raw.confidence === 'number'
      ? Math.min(1, Math.max(0, raw.confidence))
      : 0.7;

  return {
    suggestedName,
    unit: parseUnit(raw.unit),
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
    packSize:
      typeof raw.packSize === 'string' && raw.packSize.trim()
        ? raw.packSize.trim()
        : null,
    brand:
      typeof raw.brand === 'string' && raw.brand.trim()
        ? raw.brand.trim()
        : null,
    containerHint:
      typeof raw.containerHint === 'string' && raw.containerHint.trim()
        ? raw.containerHint.trim()
        : null,
    ean:
      typeof raw.ean === 'string' && raw.ean.trim()
        ? raw.ean.replace(/\s/g, '')
        : null,
    aliases,
    ingredientType: parseIngredient(raw.ingredientType),
    unrecognized: Boolean(raw.unrecognized),
  };
}

const SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Read product label / pack photos carefully (OCR). Return JSON only.
Use Finnish POS unit codes (YKSIKKÖ): L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
Prices must be estimated at 0% ALV (excl. VAT). Finnish food shelf prices usually include 14% VAT — convert shelf€ / 1.14 when estimating.
Prefer official-looking product names from the label; also give informal aliases staff might type (EN + FI).
If barcode/EAN is visible, include digits only.
If unsure, set unrecognized true and explain in rawNotes — still guess best suggestedName.`;

export async function analyzeImagesWithGemini(
  imageUris: string[],
  hint?: string,
): Promise<VisionExtract> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');
  }

  const realUris = imageUris.filter(isRealImageUri);
  if (!realUris.length) {
    throw new Error('No product photo to analyze');
  }

  // Cap payload size — first 4 close-ups are enough for label + barcode
  const payloads: ImagePayload[] = [];
  for (const uri of realUris.slice(0, 4)) {
    payloads.push(await imageUriToPayload(uri));
  }

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
        `Analyze ${payloads.length} close-up photo(s) of one product.`,
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
