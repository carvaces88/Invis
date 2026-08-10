/**
 * Vercel serverless background cleanup for catalog pack photos.
 * POST /api/remove-bg
 * Body: { image: { mimeType, base64 }, model? }
 * → { mimeType, base64 }  (JPEG preferred, solid white background)
 *
 * Uses a Gemini image model (default gemini-2.5-flash-image) with GEMINI_API_KEY.
 */
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

const PROMPT = `You are editing a kitchen/restaurant product photo for a catalog thumbnail.

Task: isolate the main product pack (carton, jar, bottle, tub, bag, or box) and place it on a solid pure white (#FFFFFF) background.

Rules:
- Keep the product label, branding, shape, and proportions exactly as in the photo.
- Remove fridge shelves, other products, hands, clutter, shadows on the backdrop, and any non-product background.
- Do not invent a different product or rewrite text on the label.
- Center the product; leave a small white margin.
- Output a single clean product photo suitable for a catalog thumbnail.
- Background must be solid white (not transparent, not gray).`;

function extractImagePart(geminiJson) {
  const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (!inline?.data) continue;
    const mimeType = String(
      inline.mimeType || inline.mime_type || 'image/jpeg',
    ).trim();
    const data = String(inline.data).replace(/\s/g, '');
    if (data.length > 100) {
      return { mimeType, base64: data };
    }
  }
  return null;
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

  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    res.status(503).json({
      error:
        'Remove-bg API not configured. Set GEMINI_API_KEY on the server (Vercel env).',
    });
    return;
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const image = body.image || {};
    const mimeType = String(image.mimeType || 'image/jpeg').trim();
    const base64 = String(image.base64 || '').replace(/\s/g, '');
    const model = (
      body.model ||
      process.env.GEMINI_IMAGE_MODEL ||
      process.env.EXPO_PUBLIC_GEMINI_IMAGE_MODEL ||
      DEFAULT_IMAGE_MODEL
    ).trim();

    if (base64.length < 100) {
      res.status(400).json({ error: 'No image to process' });
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.2,
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
          ? `${raw} Fix: allow Generative Language API for this key (same as /api/vision).`
          : raw,
      });
      return;
    }

    const out = extractImagePart(geminiJson);
    if (!out) {
      res.status(502).json({
        error: 'Gemini returned no cleaned image — try a closer product photo',
      });
      return;
    }

    res.status(200).json({
      mimeType: out.mimeType.startsWith('image/')
        ? out.mimeType
        : 'image/jpeg',
      base64: out.base64,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Remove-bg proxy failed',
    });
  }
};
