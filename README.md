# Invis by Cesar

Minimal kitchen inventory app for Finnish restaurants. Digital inventory sheet (Name · Unit · Qty · Price excl. VAT · Total) with **photo → AI extract → catalog match → confirm**.

Local-first demo — no Supabase required. Vision uses stubs so alias matching and demos work offline (no API keys).

UI is English throughout. Catalog product official names may stay Finnish when they mirror real POS / distributor names.

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

- Real vision LLM behind paid flag (`src/lib/visionStub.ts`)
- Live camera / video (`VideoDemoScreen`)
- Pro LLM chat flag
- Supabase sync, Restolution POS, barcode
