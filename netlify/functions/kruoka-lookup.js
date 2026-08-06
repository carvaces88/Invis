/**
 * Netlify function — same contract as /api/kruoka-lookup (Vercel).
 * GET /.netlify/functions/kruoka-lookup?q=...&limit=8&storeId=N106
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
  return {
    ean,
    officialName: name,
    brand,
    packSize: formatPackSize(m?.contentSize, m?.contentUnit),
    unit: 'KPL',
    unitPriceAlv0: shelfToAlv0(shelf),
    imageUrl:
      raw.productAttributes?.image?.url ||
      raw.images?.[0] ||
      (ean ? `https://public.keskofiles.com/f/k-ruoka/product/${ean}` : undefined),
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
    return { status: res.status, products: [] };
  }
  const json = await res.json();
  return {
    status: res.status,
    products: (json.result || [])
      .map((row) => mapKruoka(row.product || row, 'kruoka-proxy'))
      .filter(Boolean),
  };
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
        sourceUrl: `https://www.k-ruoka.fi/haku?q=${encodeURIComponent(ean || name)}`,
        aliases: [name.toLowerCase(), brand?.toLowerCase(), ean].filter(Boolean),
        source: 'openfoodfacts',
      };
    })
    .filter(Boolean);
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const q = String(params.q || '').trim();
  const limit = Math.min(Number(params.limit) || 8, 25);
  const storeId = String(params.storeId || DEFAULT_STORE).trim() || DEFAULT_STORE;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (!q) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing q', products: [] }),
    };
  }

  try {
    const live = await searchKruoka(q, storeId, limit);
    if (live.products.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: live.products,
          source: 'kruoka-live',
          storeId,
        }),
      };
    }

    let products = [];
    if (/^\d{8,14}$/.test(q)) {
      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${q}.json`,
        { headers: { accept: 'application/json' } },
      );
      if (offRes.ok) {
        const body = await offRes.json();
        if (body.status === 1 && body.product) {
          const ean = q;
          const name = (
            body.product.product_name_fi ||
            body.product.product_name ||
            ''
          ).trim();
          if (name) {
            const brand = (body.product.brands || '').split(',')[0]?.trim();
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
    if (!products.length) products = await searchOff(q, limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products,
        source: products.length ? 'openfoodfacts' : 'empty',
        storeId,
        kruokaStatus: live.status,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'lookup failed',
        products: [],
      }),
    };
  }
};
