/**
 * Vercel serverless vision proxy — keeps GEMINI_API_KEY off the client bundle.
 * POST /api/vision
 * Body: { images: [{ mimeType, base64 }], hint?, model?, mode?: 'product' | 'fridge' | 'sheet' }
 * mode product (default) → VisionExtract JSON
 * mode fridge → DocumentExtract-shaped JSON { kind:'fridge', lines, confidence, title? }
 * mode sheet → DocumentExtract { kind:'sheet', … } for inventaariopohja clipboard OCR
 */
const DEFAULT_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Ground on WHAT IS IN THE PHOTO — OCR the visible label and name the physical product. Return JSON only.

CRITICAL GROUNDING:
- Identify the product type you see (fresh cucumbers in a crate, mayo tub, milk carton, etc.).
- Transcribe brand/producer + Finnish/Swedish title actually printed (e.g. SUOMALAISIA KURKKUJA / FINSKA GURKOR, producer Korsnäs Grönsaker).
- brand, suggestedName, containerHint, ingredientType must describe THE SAME item.
- Produce crates are NOT mayonnaise — never invent an unrelated SKU.
- If barcode unreadable or absent → ean null. NEVER guess a catalog EAN.

PRIORITY when multiple photos:
1) Barcode close-ups: read EAN-13 digits under the bars (digits only in "ean").
2) Front / crate label: brand + product line + FI/SV title + pack weight (e.g. 5 kg).
3) Packaging cues: laatikko/crate, purkki, kartonki, pullo, pussi → containerHint + POS unit.

YKSIKKÖ: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
Wholesale produce crate → LTK (or KG by weight), containerHint "Laatikko (crate / box)", packSize "5 kg".
Tetra Pak / kartonki sold per carton → unit KPL, packSize like "1 L".
ingredientType: produce for fresh veg crates; sauces for mayo; dairy for milk/yogurt.
Prices at 0% ALV (Finnish food shelf € ÷ 1.14).
suggestedName: official-ish from label (e.g. "Suomalaisia kurkkuja 5 kg").
aliases: kurkku, kurkkuja, Finska gurkor, Finnish cucumber, brand short names, …
rawNotes: class, storage °C, origin, Puhtaasti Kotimainen, piece size if printed.
If unsure, unrecognized true — still best-guess suggestedName from visible text.`;

const FRIDGE_SYSTEM_PROMPT = `You are Inventaario kitchen inventory vision for Finnish restaurants.
Analyze a WIDE fridge / walk-in / shelf panorama photo. Return JSON only.

List EVERY distinct product visible (do not merge different brands/sizes).
Ground each line on what that crop shows — cucumber crate = produce (kurkku), not mayo.
For each product estimate quantity by counting cans, bottles, jars, packs, bags, or crates.
YKSIKKÖ: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT (RSA ≠ RAS).
Crates → LTK; never invent EAN when barcode unreadable.
crop: normalized 0–1 {x,y,width,height} when you can locate the product.
Prices at 0% ALV if shelf tag visible (€ ÷ 1.14).
If unreadable: unrecognized true + best-guess suggestedName + aiDescription.
rawNotes: class, storage, origin when printed.`;

const SHEET_SYSTEM_PROMPT = `You are Inventaario OCR for Finnish kitchen inventory CLIPBOARD sheets (INVENTAARIOPOHJA RR and similar).
Return JSON only. Ground EVERY row on the printed/handwritten text in the photo.

Sheet columns (left → right):
1) NIMIKE — product name (printed; sometimes handwritten extras at the bottom)
2) YKSIKKÖ — unit code (pkt, PSS, L, PRK, LTK, KPL, kg, rsa, RAS, plo, …)
3) MÄÄRÄ — quantity. Often HANDWRITTEN in blue ink. Use European decimals (0,5 → 0.5). If blank → quantity null.
4) HINTA — unit price printed on the form. European decimals (2,29 → 2.29). These kitchen sheet prices are already 0% ALV — do NOT divide by 1.14.
5) Yht — ignore (totals usually empty).

Rules:
- Read as many product rows as you can see (typically 40–80). Do not invent products that are not on the sheet.
- Include rows with empty MÄÄRÄ (quantity null) so the catalog list is complete.
- Also parse handwritten extras below the table (e.g. "Kond. Maito 8 prk") as extra lines.
- Normalize unit to: L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT.
- suggestedName = NIMIKE text as printed.
- unitPriceAlv0 = HINTA number (or null if blank).
- quantity = MÄÄRÄ number (or null if blank).
- rawNotes: section headers, "handwritten extra" for footer notes.
- title: sheet title + PVM date when visible.
- confidence: overall OCR confidence 0–1.`;

const PRIOR_LIST_SYSTEM_PROMPT = `You are Inventaario OCR for PRIOR STOCK LISTS: handwritten notes, phone photos of printed pages, or last-month inventory sheets.
Return JSON only. Ground EVERY line on visible text in the photo(s). Do not invent products.

Extract each product line as:
- suggestedName: product / ingredient name (keep Finnish when printed; brand + title when both visible)
- quantity: number when written (European decimals 0,5 → 0.5); null if only a name with no count
- unit: POS code when written or clearly implied — L, KPL, PRK, RSA, PSS, PL, PLO, LTK, KG, RAS, PKT
  Map words: jar/can/purkki → PRK; bag/pussi → PSS; bottle/pullo → PL; box/crate/bucket/laatikko → LTK; packet → PKT; tray/rasia → RSA; piece → KPL; kilo → KG; liter → L
- unitPriceAlv0: only if a price is clearly printed and already 0% ALV; otherwise null (do NOT invent K-Ruoka prices)
- aliases: optional short nicknames visible on the note
- sourcePage: 1-based photo index (photo 1 = first image, photo 2 = second, …) when multiple photos
- crossedOut: true ONLY when the line is visibly struck through / scribbled out on the sheet
- rawNotes: "handwritten" / "printed page" / section header when helpful

Rules:
- Multiple photos may be pages of the same list — merge duplicate product rows into one line for \`lines\`, but report cross-page issues in \`insights\`.
- Skip headers, totals, signatures, and blank lines.
- title: e.g. "Prior stock · March" or visible date/header.
- confidence: overall OCR confidence 0–1.

Cross-page insights (\`insights\` array — ONLY when you clearly see the issue; confidence ≥ 0.55):
- duplicate: same product name appears on two+ pages (before merge). itemName, pages [1,2,…], confidence.
- crossed_off: line struck through on a page. itemName, page (1-based), confidence.
- qty_mismatch: same product with different handwritten quantities on different pages. itemName, quantityA, quantityB, pageA, pageB, confidence.
- Leave \`insights\` empty when single photo, no cross-page issues, or unsure — do NOT guess.`;

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

const PRIOR_LIST_LINE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ...FRIDGE_LINE_SCHEMA.properties,
    sourcePage: { type: 'INTEGER', nullable: true },
    crossedOut: { type: 'BOOLEAN', nullable: true },
  },
  required: FRIDGE_LINE_SCHEMA.required,
};

const SHEET_INSIGHT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: {
      type: 'STRING',
      enum: ['duplicate', 'crossed_off', 'qty_mismatch'],
    },
    itemName: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    pages: { type: 'ARRAY', items: { type: 'INTEGER' }, nullable: true },
    page: { type: 'INTEGER', nullable: true },
    quantityA: { type: 'NUMBER', nullable: true },
    quantityB: { type: 'NUMBER', nullable: true },
    pageA: { type: 'INTEGER', nullable: true },
    pageB: { type: 'INTEGER', nullable: true },
  },
  required: ['kind', 'itemName', 'confidence'],
};

const PRIOR_LIST_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', nullable: true },
    confidence: { type: 'NUMBER' },
    rawNotes: { type: 'STRING', nullable: true },
    lines: { type: 'ARRAY', items: PRIOR_LIST_LINE_SCHEMA },
    insights: { type: 'ARRAY', items: SHEET_INSIGHT_SCHEMA },
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
    sourcePage:
      typeof raw.sourcePage === 'number' && Number.isFinite(raw.sourcePage)
        ? Math.max(1, Math.round(raw.sourcePage))
        : undefined,
    crossedOut: raw.crossedOut === true ? true : undefined,
  };
}

const INSIGHT_KINDS = new Set(['duplicate', 'crossed_off', 'qty_mismatch']);
const MIN_INSIGHT_CONFIDENCE = 0.55;

function parseSheetImportInsights(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const kind = row.kind;
    if (typeof kind !== 'string' || !INSIGHT_KINDS.has(kind)) continue;
    const itemName =
      (typeof row.itemName === 'string' && row.itemName.trim()) ||
      (typeof row.suggestedName === 'string' && row.suggestedName.trim()) ||
      '';
    if (!itemName) continue;
    const confidence =
      typeof row.confidence === 'number' && Number.isFinite(row.confidence)
        ? Math.max(0, Math.min(1, row.confidence))
        : 0;
    if (confidence < MIN_INSIGHT_CONFIDENCE) continue;
    const pages = Array.isArray(row.pages)
      ? row.pages
          .filter((p) => typeof p === 'number' && Number.isFinite(p))
          .map((p) => Math.max(1, Math.round(p)))
      : undefined;
    out.push({
      kind,
      itemName,
      confidence,
      pages: pages && pages.length ? pages : undefined,
      page:
        typeof row.page === 'number' && Number.isFinite(row.page)
          ? Math.max(1, Math.round(row.page))
          : undefined,
      quantityA:
        typeof row.quantityA === 'number' && Number.isFinite(row.quantityA)
          ? row.quantityA
          : undefined,
      quantityB:
        typeof row.quantityB === 'number' && Number.isFinite(row.quantityB)
          ? row.quantityB
          : undefined,
      pageA:
        typeof row.pageA === 'number' && Number.isFinite(row.pageA)
          ? Math.max(1, Math.round(row.pageA))
          : undefined,
      pageB:
        typeof row.pageB === 'number' && Number.isFinite(row.pageB)
          ? Math.max(1, Math.round(row.pageB))
          : undefined,
    });
  }
  return out;
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

function mapSheetDocument(raw, model, photoCount, kind) {
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  const lines = linesRaw.map((row) => {
    const extract = mapExtract(row);
    // Blank MÄÄRÄ must stay null (mapExtract defaults quantity to 1)
    if (
      row == null ||
      typeof row.quantity !== 'number' ||
      !Number.isFinite(row.quantity)
    ) {
      extract.quantity = null;
    }
    return extract;
  });
  const confidence =
    typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : lines.length
        ? lines.reduce((s, l) => s + l.confidence, 0) / lines.length
        : 0.5;
  const docKind = kind === 'prior_list' ? 'prior_list' : 'sheet';
  const insights =
    docKind === 'prior_list' ? parseSheetImportInsights(raw.insights) : [];
  return {
    kind: docKind,
    title: raw.title
      ? String(raw.title).trim()
      : docKind === 'prior_list'
        ? 'Prior stock list'
        : 'Inventaariopohja',
    lines,
    confidence,
    rawNotes: [
      raw.rawNotes ? String(raw.rawNotes) : null,
      `Live Gemini ${docKind} proxy (${model}) · ${photoCount} photo(s)`,
    ]
      .filter(Boolean)
      .join(' · '),
    ...(insights.length ? { insights } : {}),
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
    const mode =
      body.mode === 'fridge'
        ? 'fridge'
        : body.mode === 'sheet'
          ? 'sheet'
          : body.mode === 'prior_list'
            ? 'prior_list'
            : 'product';

    const payloads = images
      .slice(0, mode === 'product' ? 4 : mode === 'prior_list' ? 8 : 2)
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
    const isSheet = mode === 'sheet';
    const isPriorList = mode === 'prior_list';
    const isDocList = isSheet || isPriorList;
    const parts = [
      ...payloads.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.data },
      })),
      {
        text: isPriorList
          ? [
              PRIOR_LIST_SYSTEM_PROMPT,
              hint ? `Optional staff notes (may be wrong): ${hint}` : null,
              `OCR ${payloads.length} photo(s) of a prior stock list / handwritten note / printed page. Extract every product line with name, quantity when present, and unit. When ${payloads.length > 1 ? 'multiple photos' : 'one photo'}, fill insights only for clear cross-page issues.`,
            ]
              .filter(Boolean)
              .join('\n')
          : isSheet
            ? [
                SHEET_SYSTEM_PROMPT,
                hint ? `Optional staff notes (may be wrong): ${hint}` : null,
                'OCR this inventaariopohja clipboard photo. Extract every NIMIKE row with YKSIKKÖ, MÄÄRÄ (handwritten), HINTA.',
              ]
                .filter(Boolean)
                .join('\n')
            : isFridge
              ? [
                  FRIDGE_SYSTEM_PROMPT,
                  hint ? `Optional staff notes (may be wrong): ${hint}` : null,
                  'Analyze this fridge/shelf panorama. List every distinct product with estimated count.',
                ]
                  .filter(Boolean)
                  .join('\n')
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
          temperature: isDocList ? 0.1 : 0.2,
          responseMimeType: 'application/json',
          responseSchema: isPriorList
            ? PRIOR_LIST_SCHEMA
            : isFridge || isSheet
              ? FRIDGE_SCHEMA
              : VISION_SCHEMA,
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

    if (isDocList) {
      res
        .status(200)
        .json(mapSheetDocument(parsed, model, payloads.length, mode));
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
