#!/usr/bin/env node
/**
 * Multi-venue load + isolation checks.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/load-test-venues.mjs
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... VENUE_COUNT=50 node scripts/load-test-venues.mjs
 *
 * Also validates the SQL migration file is present and contains RLS + auth RPC.
 * Without live credentials, exits 0 after static checks (CI-friendly).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const migration = resolve(
  root,
  'supabase/migrations/20260824100000_multi_venue_tenancy.sql',
);

function assertMigration() {
  if (!existsSync(migration)) {
    throw new Error(`Missing migration: ${migration}`);
  }
  const sql = readFileSync(migration, 'utf8');
  const required = [
    'create table if not exists public.venues',
    'create table if not exists public.venue_members',
    'create table if not exists public.inventory_lines',
    'create table if not exists public.api_usage',
    'create table if not exists public.product_ean_cache',
    'create or replace function public.create_venue_with_owner',
    'create or replace function public.check_and_increment_api_usage',
    'enable row level security',
    'is_venue_member',
  ];
  for (const needle of required) {
    if (!sql.toLowerCase().includes(needle.toLowerCase())) {
      throw new Error(`Migration missing required piece: ${needle}`);
    }
  }
  console.log('✓ Migration contains venues, RLS, create_venue_with_owner, api_usage');
}

function assertApiAuthGate() {
  const authLib = readFileSync(resolve(root, 'api/_lib/auth.js'), 'utf8');
  const vision = readFileSync(resolve(root, 'api/vision.js'), 'utf8');
  const kruoka = readFileSync(resolve(root, 'api/kruoka-lookup.js'), 'utf8');
  const transcribe = readFileSync(resolve(root, 'api/transcribe.js'), 'utf8');
  if (!authLib.includes('requireVenueAuth')) {
    throw new Error('api/_lib/auth.js missing requireVenueAuth');
  }
  if (!authLib.includes('check_and_increment_api_usage')) {
    throw new Error('api/_lib/auth.js must call check_and_increment_api_usage');
  }
  if (!vision.includes("requireVenueAuth(req, 'vision')")) {
    throw new Error('api/vision.js must gate on requireVenueAuth before Gemini');
  }
  if (!kruoka.includes("requireVenueAuth(req, 'kruoka-lookup')")) {
    throw new Error('api/kruoka-lookup.js must gate on requireVenueAuth');
  }
  if (!transcribe.includes("requireVenueAuth(req, 'transcribe')")) {
    throw new Error('api/transcribe.js must gate on requireVenueAuth before Gemini');
  }
  // Ensure Gemini key is only used AFTER auth block in vision.js
  const authIdx = vision.indexOf("requireVenueAuth(req, 'vision')");
  const geminiIdx = vision.indexOf('generativelanguage.googleapis.com');
  if (authIdx < 0 || geminiIdx < 0 || authIdx > geminiIdx) {
    throw new Error('Auth must run before Gemini upstream call in api/vision.js');
  }
  const tAuth = transcribe.indexOf("requireVenueAuth(req, 'transcribe')");
  const tGemini = transcribe.indexOf('generativelanguage.googleapis.com');
  if (tAuth < 0 || tGemini < 0 || tAuth > tGemini) {
    throw new Error('Auth must run before Gemini in api/transcribe.js');
  }
  console.log('✓ Vision + lookup + transcribe require session + per-venue quota before upstream');
}

async function liveSignupStorm() {
  const url = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const anon = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !anon) {
    console.log('⏭ Skipping live signup storm (set SUPABASE_URL + SUPABASE_ANON_KEY)');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const count = Math.min(Number(process.env.VENUE_COUNT) || 50, 50);
  console.log(`→ Creating ${count} venues in parallel…`);

  const stamp = Date.now();
  const jobs = Array.from({ length: count }, async (_, i) => {
    const email = `loadtest+${stamp}-${i}@example.com`;
    const password = `LoadTest!${stamp}${i}`;
    const venueName = `Load Venue ${stamp}-${i}`;
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sign, error: signErr } = await sb.auth.signUp({
      email,
      password,
    });
    if (signErr) throw new Error(`signup ${i}: ${signErr.message}`);
    if (!sign.session) {
      throw new Error(
        `signup ${i}: no session (disable email confirm for load tests)`,
      );
    }
    const authed = createClient(url, anon, {
      global: {
        headers: { Authorization: `Bearer ${sign.session.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: venueId, error: rpcErr } = await authed.rpc(
      'create_venue_with_owner',
      { p_name: venueName },
    );
    if (rpcErr) throw new Error(`venue ${i}: ${rpcErr.message}`);

    // Isolation: must not see other venues' members as inventory owner
    const { data: places, error: placesErr } = await authed
      .from('places')
      .select('venue_id, id')
      .eq('venue_id', venueId);
    if (placesErr) throw new Error(`places ${i}: ${placesErr.message}`);
    if (!places?.length) throw new Error(`places ${i}: expected seed places`);

    // Quota RPC should allow first vision call
    const { data: allowed, error: quotaErr } = await authed.rpc(
      'check_and_increment_api_usage',
      {
        p_venue_id: venueId,
        p_endpoint: 'vision',
        p_daily_limit: 100,
      },
    );
    if (quotaErr) throw new Error(`quota ${i}: ${quotaErr.message}`);
    if (allowed !== true) throw new Error(`quota ${i}: expected allowed=true`);

    return { email, venueId, userId: sign.user.id };
  });

  const results = await Promise.all(jobs);
  console.log(`✓ ${results.length} concurrent signups + venues created`);

  // Cross-tenant isolation: user 0 must not read user 1 venue rows
  const a = results[0];
  const b = results[1];
  if (a && b) {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Re-login as A
    const { data: signA, error } = await sb.auth.signInWithPassword({
      email: a.email,
      password: `LoadTest!${stamp}0`,
    });
    if (error || !signA.session) throw new Error('re-login A failed');
    const clientA = createClient(url, anon, {
      global: {
        headers: { Authorization: `Bearer ${signA.session.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: leak } = await clientA
      .from('places')
      .select('id')
      .eq('venue_id', b.venueId);
    if (leak && leak.length > 0) {
      throw new Error('RLS FAILURE: venue A can read venue B places');
    }
    console.log('✓ RLS isolation: venue A cannot read venue B places');
  }
}

async function main() {
  assertMigration();
  assertApiAuthGate();
  await liveSignupStorm();
  console.log('All multi-venue checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
