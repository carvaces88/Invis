/**
 * Shared auth + per-venue quota for expensive serverless APIs (vision, lookup).
 *
 * When SUPABASE_URL + SUPABASE_ANON_KEY are set on the server, requests MUST
 * send Authorization: Bearer <supabase access token> and X-Venue-Id.
 * Without Supabase env (local demo), auth is skipped so guest mode still works.
 *
 * Quota is enforced via RPC check_and_increment_api_usage so 50 venues
 * onboarding with photo scans cannot melt one shared Gemini key.
 */

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_LIMITS = {
  vision: 100,
  'kruoka-lookup': 500,
  transcribe: 50,
};

function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  return { url, anon };
}

function isAuthRequired() {
  if (process.env.REQUIRE_API_AUTH === '0') return false;
  if (process.env.REQUIRE_API_AUTH === '1') return true;
  const { url, anon } = supabaseEnv();
  return Boolean(url && anon);
}

function getBearer(req) {
  const h =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    (typeof req.getHeader === 'function' ? req.getHeader('authorization') : null);
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function getVenueId(req, body) {
  const h =
    req.headers?.['x-venue-id'] ||
    req.headers?.['X-Venue-Id'] ||
    body?.venueId ||
    body?.venue_id;
  if (!h || typeof h !== 'string') return null;
  const id = h.trim();
  return id || null;
}

/**
 * @param {object} req - Vercel-style request (method, headers, body)
 * @param {string} endpoint - 'vision' | 'kruoka-lookup' | 'transcribe'
 * @param {object} [opts]
 * @param {number} [opts.dailyLimit]
 * @returns {Promise<
 *   | { ok: true, userId: string, venueId: string, skipped?: boolean }
 *   | { ok: false, status: number, error: string }
 * >}
 */
async function requireVenueAuth(req, endpoint, opts = {}) {
  if (!isAuthRequired()) {
    return {
      ok: true,
      userId: 'anon-dev',
      venueId: getVenueId(req, req.body) || 'local-dev',
      skipped: true,
    };
  }

  const { url, anon } = supabaseEnv();
  if (!url || !anon) {
    return {
      ok: false,
      status: 503,
      error:
        'API auth misconfigured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the server.',
    };
  }

  const token = getBearer(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error:
        'Sign in required for this API. Send Authorization: Bearer <session> and X-Venue-Id.',
    };
  }

  const venueId = getVenueId(req, typeof req.body === 'object' ? req.body : {});
  if (!venueId) {
    return {
      ok: false,
      status: 400,
      error: 'X-Venue-Id header (or body.venueId) is required.',
    };
  }

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData?.user) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid or expired session. Sign in again.',
    };
  }

  const { data: member, error: memberErr } = await sb
    .from('venue_members')
    .select('role')
    .eq('venue_id', venueId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (memberErr || !member) {
    return {
      ok: false,
      status: 403,
      error: 'Not a member of this venue.',
    };
  }

  const envLimit = Number(
    process.env[`API_LIMIT_${endpoint.toUpperCase().replace(/-/g, '_')}`],
  );
  const dailyLimit =
    opts.dailyLimit ??
    (Number.isFinite(envLimit) && envLimit > 0
      ? envLimit
      : DEFAULT_LIMITS[endpoint] || 100);

  const { data: allowed, error: quotaErr } = await sb.rpc(
    'check_and_increment_api_usage',
    {
      p_venue_id: venueId,
      p_endpoint: endpoint,
      p_daily_limit: dailyLimit,
    },
  );

  if (quotaErr) {
    return {
      ok: false,
      status: 503,
      error: `Quota check failed: ${quotaErr.message}`,
    };
  }

  if (allowed === false) {
    return {
      ok: false,
      status: 429,
      error: `Daily ${endpoint} limit (${dailyLimit}) reached for this venue. Try again tomorrow.`,
    };
  }

  return { ok: true, userId: userData.user.id, venueId };
}

/**
 * Read / write shared EAN product cache (authenticated client).
 */
async function readEanCache(req, ean) {
  if (!isAuthRequired() || !ean) return null;
  const { url, anon } = supabaseEnv();
  const token = getBearer(req);
  if (!url || !anon || !token) return null;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb
    .from('product_ean_cache')
    .select('payload, source, updated_at')
    .eq('ean', ean)
    .maybeSingle();
  return data?.payload ?? null;
}

async function writeEanCache(req, ean, payload, source = 'kruoka') {
  if (!isAuthRequired() || !ean || !payload) return;
  const { url, anon } = supabaseEnv();
  const token = getBearer(req);
  if (!url || !anon || !token) return;
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await sb.from('product_ean_cache').upsert(
    {
      ean,
      payload,
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'ean' },
  );
}

const AUTH_CORS_HEADERS =
  'Content-Type, Authorization, X-Venue-Id';

module.exports = {
  requireVenueAuth,
  readEanCache,
  writeEanCache,
  isAuthRequired,
  AUTH_CORS_HEADERS,
  DEFAULT_LIMITS,
};
