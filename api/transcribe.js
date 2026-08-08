/**
 * Vercel serverless audio transcription proxy — reuses GEMINI_API_KEY.
 * POST /api/transcribe
 * Body: { audio: { mimeType, base64 }, language?: 'en'|'fi', model? }
 * → { transcript: string }
 */
const DEFAULT_MODEL = 'gemini-3.6-flash';

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
        'Transcription API not configured. Set GEMINI_API_KEY on the server (Vercel env).',
    });
    return;
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const audio = body.audio || {};
    const mimeType = String(audio.mimeType || 'audio/webm').trim();
    const base64 = String(audio.base64 || '').replace(/\s/g, '');
    const language = body.language === 'fi' ? 'fi' : 'en';
    const model = (
      body.model ||
      process.env.GEMINI_MODEL ||
      DEFAULT_MODEL
    ).trim();

    if (base64.length < 100) {
      res.status(400).json({ error: 'No audio to transcribe' });
      return;
    }

    const langHint =
      language === 'fi'
        ? 'The speaker is usually Finnish (kitchen/restaurant). Prefer Finnish product names when unclear.'
        : 'The speaker may mix English and Finnish kitchen terms.';

    const parts = [
      {
        inlineData: { mimeType, data: base64 },
      },
      {
        text: [
          'You are Inventaario kitchen inventory speech-to-text.',
          'Transcribe the staff fridge/walk-in dictation accurately.',
          'Return ONLY the spoken words as plain text (no JSON, no markdown).',
          'Keep product names, quantities, and units (KPL, L, KG, PRK, etc.).',
          'Do not invent products that were not spoken.',
          langHint,
        ].join('\n'),
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    });

    const geminiJson = await geminiRes.json();
    if (!geminiRes.ok) {
      const raw =
        geminiJson?.error?.message || `Gemini failed (${geminiRes.status})`;
      res.status(geminiRes.status).json({ error: raw });
      return;
    }

    const transcript = (geminiJson.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    if (!transcript) {
      res.status(502).json({ error: 'Gemini returned empty transcript' });
      return;
    }

    res.status(200).json({ transcript });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Transcription failed',
    });
  }
};
