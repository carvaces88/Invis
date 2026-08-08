/**
 * Vercel serverless vision proxy — keeps GEMINI_API_KEY off the client bundle.
 * POST /api/vision
 * Body: { images: [{ mimeType, base64 }], hint?, model?, mode?: 'product' | 'fridge' }
 * mode product (default) → VisionExtract JSON
 * mode fridge → DocumentExtract-shaped JSON { kind:'fridge', lines, confidence, title? }
 */
const DEFAULT_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Read product label / pack / barcode photos carefully (OCR). Return JSON only.

PRIORITY when multiple photos:
1) Barcode close-ups: read EAN-13 digits under the bars (digits only in "ean").
2) Front label: brand + product line + Finnish title + size (e.g. Valio Tuuti2 / TUUTI 2, 1 L).
3) Packaging cues: Tetra Pak logo, kartonki, pullo, purkki → containerHint + POS unit.

YKSIKKÖ: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
Tetra Pak / kartonki sold per carton → unit KPL, packSize like "1 L".
Prices at 0% ALV (Finnish food shelf € ÷ 1.14).
If unsure, unrecognized true — still best-guess suggestedName.`;

const FRIDGE_SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Analyze a WIDE fridge / walk-in / shelf panorama photo. Return JSON only.

List EVERY distinct product visible (do not merge different brands/sizes).
For each product estimate quantity by counting cans, bottles, jars, packs, bags, or crates.
YKSIKKÖ: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT (RSA ≠ RAS).
crop: normalized 0–1 {x,y,width,height} when you can locate the product.
Prices at 0% ALV if shelf tag visible (€ ÷ 1.14).
If unreadable: unrecognized true + best-guess suggestedName + aiDescription.`;

const VISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestedName: { type: 'STRING' },
    brand: { type: 'STRING', nullable: true },
    unit: { type: 'STRING', nullable: true },
    packSize: { type: 'STRING', nullable: true },
    containerHint: { type: 'STRING', nullable: true },
    quantity: { type: 'NUMBER', nullable: true },
    unitPriceAlv0: { type: 'NUMBER', nullable: true },
    ean: { type: 'STRING', nullable: true },
    aliases: { type: 'ARRAY', items: { type: 'STRING' } },
    ingredientType: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    unrecognized: { type: 'BOOLEAN', nullable: true },
    rawNotes: { type: 'STRING', nullable: true },
  },
  required: ['suggestedName', 'confidence'],
};

const FRIDGE_LINE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestedName: { type: 'STRING' },
    brand: { type: 'STRING', nullable: true },
    unit: { type: 'STRING', nullable: true },
    packSize: { type: 'STRING', nullable: true },
    containerHint: { type: 'STRING', nullable: true },
    quantity: { type: 'NUMBER', nullable: true },
    unitPriceAlv0: { type: 'NUMBER', nullable: true },
    ean: { type: 'STRING', nullable: true },
    aliases: { type: 'ARRAY', items: { type: 'STRING' } },
    ingredientType: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    unrecognized: { type: 'BOOLEAN', nullable: true },
    rawNotes: { type: 'STRING', nullable: true },
    aiDescription: { type: 'STRING', nullable: true },
    crop: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        x: { type: 'NUMBER' },
        y: { type: 'NUMBER' },
        width: { type: 'NUMBER' },
        height: { type: 'NUMBER' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
  required: ['suggestedName', 'confidence'],
};

const FRIDGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    rawNotes: { type: 'STRING', nullable: true },
    lines: { type: 'ARRAY', items: FRIDGE_LINE_SCHEMA },
  },
  required: ['lines', 'confidence'],
};

function mapExtract(raw) {
  const suggestedName = String(raw.suggestedName || '').trim() || 'Unknown product';
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5;
  return {
    suggestedName,
    brand: raw.brand ? String(raw.brand).trim() : null,
    unit: raw.unit ? String(raw.unit).trim().toUpperCase() : 'KPL',
    packSize: raw.packSize ? String(raw.packSize).trim() : null,
    containerHint: raw.containerHint ? String(raw.containerHint).trim() : null,
    quantity:
      typeof raw.quantity === 'number' && Number.isFinite(raw.quantity)
        ? raw.quantity
        : 1,
    unitPriceAlv0:
      typeof raw.unitPriceAlv0 === 'number' && Number.isFinite(raw.unitPriceAlv0)
        ? Math.round(raw.unitPriceAlv0 * 100) / 100
        : null,
    ean: raw.ean ? String(raw.ean).replace(/\D/g, '') || null : null,
    aliases: Array.isArray(raw.aliases)
      ? raw.aliases.map((a) => String(a).trim()).filter(Boolean)
      : [],
    ingredientType: raw.ingredientType || null,
    confidence,
    unrecognized: Boolean(raw.unrecognized),
    expiryDate: null,
    rawNotes: raw.rawNotes
      ? String(raw.rawNotes)
      : `Live Gemini (proxy) · ${suggestedName}`,
    aiDescription: raw.aiDescription
      ? String(raw.aiDescription).trim()
      : undefined,
    crop:
      raw.crop &&
      typeof raw.crop === 'object' &&
      typeof raw.crop.x === 'number' &&
      typeof raw.crop.y === 'number' &&
      typeof raw.crop.width === 'number' &&
      typeof raw.crop.height === 'number'
        ? {
            x: Math.max(0, Math.min(1, raw.crop.x)),
            y: Math.max(0, Math.min(1, raw.crop.y)),
            width: Math.max(0, Math.min(1, raw.crop.width)),
            height: Math.max(0, Math.min(1, raw.crop.height)),
          }
        : undefined,
  };
}

function mapFridgeDocument(raw, model, photoCount) {
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw.map(mapExtract);
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : lines.length
        ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length
        : 0.5;
  return {
    kind: 'fridge',
    title: raw.title ? String(raw.title).trim() : 'Fridge / shelf',
    lines,
    confidence,
    rawNotes: [
      raw.rawNotes ? String(raw.rawNotes) : null,
      `Live Gemini fridge proxy (${model}) · ${photoCount} photo(s)`,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

function parseGeminiJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({
      error:
        'Vision API not configured. Set GEMINI_API_KEY on the server (Vercel env).',
    });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const images = Array.isArray(body.images) ? body.images : [];
    const hint = typeof body.hint === 'string' ? body.hint.trim() : '';
    const model = (body.model || process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const mode = body.mode === 'fridge' ? 'fridge' : 'product';

    const payloads = images
      .slice(0, mode === 'fridge' ? 2 : 4)
      .map((img) => ({
        mimeType: String(img.mimeType || 'image/jpeg'),
        data: String(img.base64 || '').replace(/\s/g, ''),
      }))
      .filter((p) => p.data.length > 100);

    if (!payloads.length) {
      res.status(400).json({ error: 'No images to analyze' });
      return;
    }

    const isFridge = mode === 'fridge';
    const parts = [
      ...payloads.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),
      {
        text: isFridge
          ? [
              FRIDGE_SYSTEM_PROMPT,
              'Analyze this fridge/shelf panorama. List every distinct product with estimated count.',
            ].join('\n')
          : [
              SYSTEM_PROMPT,
              hint ? `Optional staff hint (may be wrong): ${hint}` : null,
              `Analyze ${payloads.length} close-up photo(s) of one product.`,
            ]
              .filter(Boolean)
              .join('\n'),
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: isFridge ? FRIDGE_SCHEMA : VISION_SCHEMA,
        },
      }),
    });

    const geminiJson = await geminiRes.json();
    if (!geminiRes.ok) {
      const raw =
        geminiJson?.error?.message || `Gemini failed (${geminiRes.status})`;
      const blocked =
        /are blocked|has not been used|is disabled|API key not valid|PERMISSION_DENIED/i.test(
          raw,
        );
      res.status(geminiRes.status).json({
        error: blocked
          ? `${raw} Fix: Google Cloud Console → APIs & Services → Credentials → edit this API key → Application restrictions: None (Vercel serverless) → API restrictions: allow Generative Language API (or Don't restrict key). Project API must also be Enabled. Wait 1–5 min, then retry.`
          : raw,
      });
      return;
    }

    const text = (geminiJson.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned empty result' });
      return;
    }

    let parsed;
    try {
      parsed = parseGeminiJson(text);
    } catch {
      res.status(502).json({ error: 'Gemini returned non-JSON' });
      return;
    }

    if (isFridge) {
      res.status(200).json(mapFridgeDocument(parsed, model, payloads.length));
      return;
    }

    const extract = mapExtract(parsed);
    extract.rawNotes = [
      extract.rawNotes,
      `Live Gemini proxy (${model}) · ${payloads.length} photo(s)`,
    ]
      .filter(Boolean)
      .join(' · ');

    res.status(200).json(extract);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Vision proxy failed',
    });
  }
};
