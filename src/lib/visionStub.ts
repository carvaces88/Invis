/**
 * DEV / offline vision stubs — used only when EXPO_PUBLIC_GEMINI_API_KEY is unset.
 * Live path: `src/lib/vision.ts` → `geminiVision.ts` (reads real image pixels).
 */
import {
  DEMO_FRIDGE_FRESH,
  DEMO_FRIDGE_PANORAMA,
  DEMO_HAVIKKI_A,
  DEMO_HAVIKKI_B,
  DEMO_KUORMA_A,
  DEMO_KUORMA_B,
} from '../data/seedDocuments';
import type { DocumentExtract, UnitCode, VisionExtract } from '../data/types';
import { extractEanFromText } from './packaging';

const HEURISTICS: {
  match: RegExp;
  name: string;
  unit?: UnitCode;
  qty?: number;
  packSize?: string;
  brand?: string;
  containerHint?: string;
  unitPriceAlv0?: number;
  ean?: string;
  aliases?: string[];
  ingredientType?: VisionExtract['ingredientType'];
}[] = [
  {
    match: /6408430492312|tuuti\s*2|tuuti2|vieroitusvalmiste/i,
    name: 'Valio Tuuti2 vieroitusvalmiste 1l 6-12kk',
    unit: 'KPL',
    qty: 1,
    packSize: '1 L',
    brand: 'Valio',
    containerHint: 'Tetra Pak / kartonki (carton)',
    unitPriceAlv0: 2.32,
    ean: '6408430492312',
    ingredientType: 'dairy',
    aliases: [
      'valio tuuti2',
      'tuuti 2',
      'tuuti2',
      'vieroitusvalmiste',
      'follow-on formula',
      'baby formula',
      '6408430492312',
    ],
  },
  {
    match: /caper|kapris|figaro/i,
    name: 'capers',
    unit: 'PRK',
    qty: 1,
    packSize: '935g/600g',
    brand: 'Figaro',
    containerHint: 'Purkki (can / jar)',
    unitPriceAlv0: 4.2,
  },
  {
    match: /herkkumaa|täysmajoneesi|taysmajoneesi|mayo|majoneesi/i,
    name: 'Herkkumaa täysmajoneesi',
    unit: 'PRK',
    qty: 1,
    packSize: '5 kg',
    brand: 'Herkkumaa',
    containerHint: 'Purkki (can / jar)',
    unitPriceAlv0: 18.5,
  },
  {
    match: /cilantro|coriander|korianteri/i,
    name: 'cilantro',
    unit: 'KPL',
    qty: 1,
    containerHint: 'Kappale (bunch / piece)',
  },
  {
    match: /yogurt|yoghurt|jogurtti/i,
    name: 'yogurt',
    unit: 'KG',
    qty: 1,
    containerHint: 'Kilogramma (weight)',
  },
  {
    match: /parsley|persilja/i,
    name: 'parsley',
    unit: 'KPL',
    qty: 1,
  },
  {
    match: /basil|basilika/i,
    name: 'basil',
    unit: 'KPL',
    qty: 1,
  },
  { match: /\bmilk\b|\bmaito\b(?!pohj)/i, name: 'milk', unit: 'L', qty: 1 },
  { match: /cream|kerma|ruokakerma/i, name: 'cream', unit: 'L', qty: 1 },
  {
    match: /\beggs?\b|kananmun/i,
    name: 'eggs',
    unit: 'KPL',
    qty: 12,
  },
  { match: /butter|\bvoi\b|voita/i, name: 'butter', unit: 'KG', qty: 1 },
  {
    match: /olive|oliivi/i,
    name: 'olive oil',
    unit: 'L',
    qty: 1,
    containerHint: 'Pullo (bottle)',
  },
  { match: /chickpea|kikherne/i, name: 'chickpeas', unit: 'PRK', qty: 2 },
  { match: /maple|vaahtera/i, name: 'maple syrup', unit: 'KPL', qty: 1 },
  { match: /pineapple|ananas/i, name: 'pineapple', unit: 'KG', qty: 2 },
  { match: /basmati/i, name: 'basmati rice', unit: 'KG', qty: 5 },
  { match: /pecan|pekaani/i, name: 'pecans', unit: 'PSS', qty: 1 },
];

function extractFromHeuristics(
  text: string,
  notes: string,
): VisionExtract | null {
  // Bare EAN in hint / URI (barcode-only path)
  const eanOnly = extractEanFromText(text);
  if (eanOnly === '6408430492312' && !/tuuti|vieroitus/i.test(text)) {
    const hit = HEURISTICS[0];
    return {
      suggestedName: hit.name,
      unit: hit.unit ?? null,
      quantity: hit.qty ?? 1,
      unitPriceAlv0: hit.unitPriceAlv0 ?? null,
      expiryDate: null,
      confidence: 0.92,
      rawNotes: `${notes} · EAN ${eanOnly}`,
      packSize: hit.packSize ?? null,
      brand: hit.brand ?? null,
      containerHint: hit.containerHint ?? null,
      ean: eanOnly,
      aliases: hit.aliases ?? [hit.name],
      ingredientType: hit.ingredientType ?? null,
    };
  }

  for (const h of HEURISTICS) {
    if (h.match.test(text)) {
      return {
        suggestedName: h.name,
        unit: h.unit ?? null,
        quantity: h.qty ?? 1,
        unitPriceAlv0: h.unitPriceAlv0 ?? null,
        expiryDate: null,
        confidence: 0.86,
        rawNotes: notes,
        packSize: h.packSize ?? null,
        brand: h.brand ?? null,
        containerHint: h.containerHint ?? null,
        ean: h.ean ?? extractEanFromText(text),
        aliases: h.aliases ?? [h.name],
        ingredientType: h.ingredientType ?? null,
      };
    }
  }
  return null;
}

export async function analyzeInventoryImage(
  imageUri: string,
  hint?: string,
): Promise<VisionExtract> {
  await delay(700);
  // Real phone photos must never fake the Figaro/capers demo — that belongs to
  // explicit offline demos only (no URI / demo URI).
  if (isRealPhotoUri(imageUri)) {
    return {
      suggestedName: hint?.trim() || 'Unknown product',
      unit: 'KPL',
      quantity: 1,
      unitPriceAlv0: null,
      expiryDate: null,
      confidence: hint?.trim() ? 0.35 : 0.15,
      packSize: null,
      brand: null,
      containerHint: null,
      ean: null,
      aliases: hint?.trim() ? [hint.trim().toLowerCase()] : [],
      unrecognized: true,
      rawNotes:
        'Photo received, but live label reading is not configured. Match an inventory product or add this as new.',
    };
  }
  const text = `${hint?.trim() || ''} ${imageUri}`;
  const hit = extractFromHeuristics(
    text,
    'Stub vision matched from hint/filename heuristics',
  );
  if (hit) return hit;
  return {
    suggestedName: 'capers',
    unit: 'PRK',
    quantity: 2,
    unitPriceAlv0: 4.2,
    expiryDate: null,
    confidence: 0.78,
    packSize: '935g/600g',
    brand: 'Figaro',
    containerHint: 'Purkki (can / jar)',
    aliases: ['capers', 'kapris'],
    rawNotes:
      'Offline demo stub: informal name "capers" — set EXPO_PUBLIC_GEMINI_API_KEY (or GEMINI_API_KEY on /api/vision) for live photo reading',
  };
}

function isRealPhotoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const u = uri.trim();
  if (!u || u === 'demo' || u.startsWith('demo-')) return false;
  return (
    u.startsWith('file:') ||
    u.startsWith('content:') ||
    u.startsWith('ph:') ||
    u.startsWith('blob:') ||
    u.startsWith('data:') ||
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.includes('/')
  );
}

/**
 * Series of close-up label / pack / barcode photos for Add Product enrichment.
 * Stub: joins URI + filename cues; real vision would OCR each frame.
 */
export async function analyzeProductCloseups(
  imageUris: string[],
  hint?: string,
): Promise<VisionExtract> {
  await delay(900);
  const hasReal = imageUris.some(isRealPhotoUri);
  if (hasReal) {
    // Do not invent catalog hits from filename noise — same path as single photo
    return analyzeInventoryImage(imageUris[0] ?? 'demo', hint);
  }
  const combined = [hint ?? '', ...imageUris].join(' ');
  const hit = extractFromHeuristics(
    combined,
    `Stub multi-photo analysis (${imageUris.length || 0} close-ups)`,
  );
  if (hit) {
    return {
      ...hit,
      confidence: Math.min(0.94, hit.confidence + 0.06),
      rawNotes: `${hit.rawNotes} · ${imageUris.length} close-up(s)`,
    };
  }
  return analyzeInventoryImage(imageUris[0] ?? 'demo', hint);
}

/**
 * Wide fridge / walk-in / shelf panorama — many products in one photo.
 * Returns a document for FridgeReview (confirm each line before write).
 * Stub: mayo shelf demo by default; fresh herbs/dairy when URI/hint says so.
 */
export async function analyzeFridgePanoramaImage(
  imageUri: string,
): Promise<DocumentExtract> {
  await delay(1100);
  const hint = imageUri.toLowerCase();
  const useFreshDemo =
    hint.includes('demo-fresh') ||
    hint.includes('fresh') ||
    hint.includes('cilantro') ||
    hint.includes('herb') ||
    hint.includes('yogurt') ||
    hint.includes('jogurtti');
  const doc = useFreshDemo ? DEMO_FRIDGE_FRESH : DEMO_FRIDGE_PANORAMA;
  return {
    ...doc,
    lines: doc.lines.map((l) => ({
      ...l,
      crop: l.crop ? { ...l.crop } : undefined,
    })),
  };
}

export async function analyzeKuormaImage(
  _imageUri: string,
  demoVariant: 'A' | 'B' = 'A',
): Promise<DocumentExtract> {
  await delay(800);
  const doc = demoVariant === 'B' ? DEMO_KUORMA_B : DEMO_KUORMA_A;
  return { ...doc, lines: doc.lines.map((l) => ({ ...l })) };
}

export async function analyzeHavikkiImage(
  _imageUri: string,
  demoVariant: 'A' | 'B' = 'A',
): Promise<DocumentExtract> {
  await delay(800);
  const doc = demoVariant === 'B' ? DEMO_HAVIKKI_B : DEMO_HAVIKKI_A;
  return { ...doc, lines: doc.lines.map((l) => ({ ...l })) };
}

/** Paid live-camera / video — not free/trial */
export function isVideoAnalysisEnabled() {
  return false;
}

/** Paid cloud vision for documents — stub path until Pro */
export function isPaidDocumentVisionEnabled() {
  return false;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
