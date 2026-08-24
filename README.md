# Invis by Cesar

Minimal kitchen inventory app for Finnish restaurants. Digital inventory sheet (Name · Unit · Qty · Price excl. VAT · Total) with **photo → AI extract → catalog match → confirm**.

Local-first demo — no Supabase required for guest mode. **Product photo analysis** uses **Gemini** via client key or production `/api/vision` (see `env.example`). Without a key, real photos stay unrecognized — they never invent a public K-Ruoka match.

### Multi-venue (auth + quotas)

With Supabase configured (`EXPO_PUBLIC_SUPABASE_*` + server `SUPABASE_*`):

- Sign up creates venue + owner via `create_venue_with_owner`
- Inventory syncs under the existing store (AsyncStorage cache + RLS)
- **`/api/vision` and `/api/kruoka-lookup` require Bearer session + `X-Venue-Id` and per-venue daily limits before Gemini / distributors** so concurrent venue onboarding cannot melt one shared key

Schema: `supabase/migrations/20260824100000_multi_venue_tenancy.sql` · checks: `npm run test:venues`

UI is English throughout. Catalog product official names may stay Finnish when they mirror real POS / distributor names.

## Live mic companion (shelf by shelf)

Scan hub → **Live mic companion**, or Record inventory mic bar:

1. Pick the place/shelf you’re counting  
2. Hold **Mic** and describe what you see (“two mayo, three milk…”)  
3. Preview catalog matches → **Save this shelf · next** (or review one shelf)  
4. **Review all** → FridgeReview confirm → stock written  
5. Voice walks open **Export** so you get the registered document  

Web Speech API when available; otherwise MediaRecorder → `/api/transcribe` (same Gemini key, **venue auth + daily quota**).

## Live vision (Gemini)

### Local Expo

1. Copy `env.example` → `.env.local`
2. Set `EXPO_PUBLIC_GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
3. `npx expo start` (restart after changing env)
4. Scan hub → Product photo → take a real label photo → Confirm shows name/price (0% ALV) and **inventory-first** match

### Production web (Vercel — e.g. invis-lac.vercel.app)

Set **server-only** env (Production + Preview), then redeploy:

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Google AI Studio key for `/api/vision` |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-3.6-flash` (server `/api/vision`) |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Optional | Only if you also want the key in the client bundle |
| `EXPO_PUBLIC_GEMINI_MODEL` | Optional | Defaults to `gemini-3.6-flash` (client direct calls) |
| `EXPO_PUBLIC_VISION_URL` | Optional | Defaults to same-origin `/api/vision` on web |
| `EXPO_PUBLIC_KRUOKA_LOOKUP_URL` | Optional | Defaults to same-origin `/api/kruoka-lookup` |

Without `GEMINI_API_KEY`, Analyze shows that live label reading is not configured and **does not** claim a K-Ruoka match.

If Analyze returns **“are blocked”** / Generative Language disabled:

1. Enable the API for the GCP project: [Generative Language API](https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview) (Status must be **Enabled**).
2. Open [Credentials](https://console.cloud.google.com/apis/credentials) → click the **same API key** stored in Vercel `GEMINI_API_KEY`.
3. **Application restrictions:** set to **None** (HTTP referrers / IPs break Vercel serverless).
4. **API restrictions:** either **Don't restrict key**, or **Restrict key** and include **Generative Language API**.
5. Save → wait **1–5 minutes** → hard-refresh the app and retry Analyze. No redeploy needed if only key restrictions changed.

Do not put a browser-restricted key in `GEMINI_API_KEY`; keep that server-only.

## Run

```bash
cd /Users/cesarcarvajal/Documents/inventaario
npx expo start
```

Then press `i` (iOS simulator), `a` (Android), or scan the QR with Expo Go.

## Why aliases matter (Figaro / capers)

POS / distributor name: `Figaro Kapris etikkaliemessä 935g/600g`

Staff often type or the model says: `capers` / `kapris` (no brand). Brand A–Z browse fails under **C**.

Each catalog row has **aliases**. Search, product confirm, and delivery / food-waste batch confirm use the same fuzzy matcher.

**Try it:** Catalog → type `capers` · or Scan → Product photo → Run demo.

## Delivery list (kuorma)

Finnish kitchens receive a **delivery list** (kuormalista). Scan hub → **Delivery** → photograph the paper (or Run demo A/B) → batch confirm → stock increases via `kuorma_in` movements. Alias matching resolves informal names (e.g. “capers” → Figaro).

## Food waste (hävikki)

End-of-day waste lists (e.g. 0.5 kg cooked rice). Scan hub → **Food waste** → demo or photo → confirm → stock decreases (`havikki_out`) and a **food waste log** entry is stored. Separate from recipe portioning margin (explicit recorded loss). View log under **More → Food waste log**.

## Local reports chatbot (no API cost)

**More → Reports chat** is a **local rule/intent** bot over inventory data. It does **not** call OpenAI/Gemini on free/trial.

Examples:

- “How much money in stock?”
- “Low stock”
- “How many falafel bowls can I make?” — uses the seeded **recipe book**, shows **ideal** portions and **with portioning margin** (default 10–15% extra usage for chef over-portioning). Adjust margin chips in the chat header.

Finnish keywords still work in the engine (e.g. “vähissä”), but prompt chips are English.

Pro LLM chat stays behind `isProLlmChatEnabled()` (off).

## Screens

| Tab / screen | Purpose |
|---|---|
| **List** | Inventory grid, edit Qty, export Excel / PDF / Word |
| **Scan hub** | Product photo · Delivery · Food waste |
| **Catalog** | Alias search, by ingredient / A–Z, Add to DB |
| **More** | Reports chat, food waste log, video stub |
| **Confirm / Batch confirm** | AI never auto-writes stock |

## Exports

From List: **Excel**, **PDF**, **Word** (docx; fall back to Excel/PDF if needed).

## Stack

Expo (TypeScript) · React Navigation · Fuse.js · `xlsx` · `expo-print` · `docx`

Tokens: `src/theme/colors.ts` · Seeds: `src/data/seedCatalog.ts`, `seedDocuments.ts`, `seedRecipes.ts` · Copy: `src/i18n/en.ts`

## Later

- Edge Function proxy for Gemini (avoid shipping `EXPO_PUBLIC_` keys in production)
- Live camera / video (`VideoDemoScreen`)
- Pro LLM chat flag
- Live www.k-ruoka.fi fetch (seed + vision today; Cloudflare often blocks)
- Supabase sync, Restolution POS, barcode
