/**
 * Stub S-Kaupat lookup proxy.
 * Live S-Kaupat GraphQL needs persisted query hashes + store session.
 * Returns empty products so the client falls back to offline seed + deep links.
 *
 * GET /api/skaupat-lookup?q=kapris&ean=&limit=5
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const q = String(req.query?.q || '').trim();
  const ean = String(req.query?.ean || '').replace(/\D/g, '');
  const limit = Math.min(Number(req.query?.limit) || 5, 20);

  // Placeholder for a future GraphQL / Playwright-backed lookup.
  res.status(200).json({
    products: [],
    source: 'skaupat-stub',
    query: q || undefined,
    ean: ean || undefined,
    limit,
    note:
      'S-Kaupat live API not wired — use client seed fallback and deep links.',
  });
};
