# Supabase multi-venue setup (Invis)

Empty project is fine — apply the migration, then wire env vars.

## 1. Apply schema

In the Supabase SQL editor (project **Invis**), paste and run:

[`migrations/20260824100000_multi_venue_tenancy.sql`](./migrations/20260824100000_multi_venue_tenancy.sql)

Or with CLI (linked project):

```bash
supabase db push
```

This creates `venues`, `venue_members`, inventory tables, RLS, `create_venue_with_owner`, and `check_and_increment_api_usage` (per-venue API quotas).

## 2. Auth settings for load tests

Dashboard → Authentication → Providers → Email:

- For local/load tests you may disable “Confirm email” so `signUp` returns a session immediately.
- Production should keep email confirmation on.

## 3. App + server env

See root [`env.example`](../env.example).

Client needs `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.  
Server (Vercel) needs the same as `SUPABASE_URL` + `SUPABASE_ANON_KEY` so `/api/vision` and `/api/kruoka-lookup` can verify JWTs and enforce quotas **before** calling Gemini.

## 4. Verify

```bash
npm run test:venues
# live storm:
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run test:venues
```
