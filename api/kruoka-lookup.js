/**
 * Vercel serverless proxy for K-Ruoka product search.
 * Direct datacenter calls often hit Cloudflare; when blocked we fall back to
 * Open Food Facts + Keskofiles image URLs so the app still gets full EAN/name hits.
 *
 * GET /api/kruoka-lookup?q=atria+kaakao&limit=8&storeId=N106
 */
const FOOD_ALV = 0.14;
const DEFAULT_STORE = 'N106';

function shelfToAlv0(shelf) {
  if (!Number.isFinite(shelf) || shelf <= 0) return undefined;
  return Math.round((shelf / (1 + FOOD_ALV)) * 100) / 100;
}

function formatPackSize(size, unit) {
  if (size == null || !Number.isFinite(size)) return undefined;
  const u = String(unit || '').toLowerCase();
  if (u === 'kg') {
    if (size < 1) return `${Math.round(size * 1000)} g`;
    return `${String(size).replace('.', ',')} kg`;
  }
  if (u === 'g') return `${size} g`;
  if (u === 'l') {
    if (size < 1) return `${Math.round(size * 1000)} ml`;
    return `${String(size).replace('.', ',')} l`;
  }
  return `${size} ${unit || ''}`.trim();
}

function mapKruoka(raw, source) {
  const ean = String(raw.ean || raw.id || '').replace(/\D/g, '') || undefined;
  const name =
    raw.localizedName?.finnish ||
    raw.localizedName?.english ||
    raw.localizedName?.swedish;
  if (!name) return null;
  const brand = raw.brand?.name;
  const m = raw.productAttributes?.measurements;
  const shelf = raw.mobilescan?.pricing?.normal?.price;
  const slug = raw.productAttributes?.urlSlug;
  const sourceUrl = slug
    ? `https://www.k-ruoka.fi/kauppa/tuote/${slug}`
    : `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(ean || name)}`;
  const imageUrl =
    raw.productAttributes?.image?.url ||
    raw.images?.[0] ||
    (ean ? `https://public.keskofiles.com/f/k-ruoka/product/${ean}` : undefined);

  return {
    ean,
    officialName: name,
    brand,
    packSize: formatPackSize(m?.contentSize, m?.contentUnit),
    unit: 'KPL',
    unitPriceAlv0: shelfToAlv0(shelf),
    imageUrl,
    sourceUrl,
    aliases: [name.toLowerCase(), brand?.toLowerCase(), ean].filter(Boolean),
    source,
  };
}

async function searchKruoka(query, storeId, limit) {
  const url =
    `https://www.k-ruoka.fi/kr-api/v2/product-search/${encodeURIComponent(query)}` +
    `?storeId=${encodeURIComponent(storeId)}&offset=0&limit=${limit}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'x-k-build-number': '30858',
    },
    body: '{}',
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok || !ct.includes('json')) {
    return { ok: false, status: res.status, products: [] };
  }
  const json = await res.json();
  const products = (json.result || [])
    .map((row) => mapKruoka(row.product || row, 'kruoka-proxy'))
    .filter(Boolean);
  return { ok: true, status: res.status, products };
}

async function searchOff(query, limit) {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=code,product_name,product_name_fi,brands,quantity,image_url,image_front_url`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.products || [])
    .map((p) => {
      const ean = String(p.code || '').replace(/\D/g, '') || undefined;
      const name = (p.product_name_fi || p.product_name || '').trim();
      if (!name) return null;
      const brand = (p.brands || '').split(',')[0]?.trim();
      const q = ean || name;
      return {
        ean,
        officialName: brand ? `${brand} ${name}` : name,
        brand,
        packSize: p.quantity || undefined,
        unit: 'KPL',
        imageUrl:
          (ean
            ? `https://public.keskofiles.com/f/k-ruoka/product/${ean}`
            : null) ||
          p.image_front_url ||
          p.image_url,
        sourceUrl: `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(q)}`,
        aliases: [name.toLowerCase(), brand?.toLowerCase(), ean].filter(
          Boolean,
        ),
        source: 'openfoodfacts',
      };
    })
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || 8, 25);
  const storeId = String(req.query.storeId || DEFAULT_STORE).trim() || DEFAULT_STORE;
  if (!q) {
    res.status(400).json({ error: 'Missing q', products: [] });
    return;
  }

  try {
    const live = await searchKruoka(q, storeId, limit);
    if (live.products.length) {
      res.status(200).json({
        products: live.products,
        source: 'kruoka-live',
        storeId,
      });
      return;
    }

    // EAN-style query → OFF product endpoint
    let products = [];
    if (/^\d{8,14}$/.test(q)) {
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${q}.json`,
        { headers: { accept: 'application/json' } },
      );
      if (offRes.ok) {
        const body = await offRes.json();
        if (body.status === 1 && body.product) {
          products = await searchOff(q, 1);
          // Prefer exact barcode product
          const ean = q;
          const name = (
            body.product.product_name_fi ||
            body.product.product_name ||
            ''
          ).trim();
          if (name) {
            const brand = (body.product.brands || '')
              .split(',')[0]
              ?.trim();
            products = [
              {
                ean,
                officialName: brand ? `${brand} ${name}` : name,
                brand,
                packSize: body.product.quantity || undefined,
                unit: 'KPL',
                imageUrl: `https://public.keskofiles.com/f/k-ruoka/product/${ean}`,
                sourceUrl: `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(ean)}`,
                aliases: [name.toLowerCase(), brand?.toLowerCase(), ean].filter(
                  Boolean,
                ),
                source: 'openfoodfacts',
              },
            ];
          }
        }
      }
    }
    if (!products.length) {
      products = await searchOff(q, limit);
    }

    res.status(200).json({
      products,
      source: products.length ? 'openfoodfacts' : 'empty',
      storeId,
      kruokaStatus: live.status,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'lookup failed',
      products: [],
    });
  }
};
