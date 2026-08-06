/**
 * Optional expander for K-Ruoka public product listings.
 *
 * Runtime lookups use src/lib/kruokaLookup.ts (+ /api/kruoka-lookup proxy).
 * Live www.k-ruoka.fi/kr-api is Cloudflare-protected from many datacenter IPs;
 * the browser/session path works. Prefer pasting CDN image URLs into
 * src/data/seedKruoka.ts after a respectful one-time browser capture.
 *
 * Usage (when network allows):
 *   npx tsx scripts/fetch-kruoka.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type SeedRow = {
  id: string;
  officialName: string;
  ean?: string;
  packSize?: string;
  imageUrl?: string;
  sourceUrl?: string;
  aliases: string[];
};

const OUT_DIR = join(__dirname, '..', 'src', 'data');
const OUT_FILE = join(OUT_DIR, 'kruokaSeed.generated.json');

/** Starter SKUs — expand manually or via authenticated browser session. */
const SEED: SeedRow[] = [
  {
    id: 'kruoka-herkkumaa-taysmajoneesi-5kg',
    officialName: 'Herkkumaa täysmajoneesi 5 kg',
    ean: '6411300002355',
    packSize: '5 kg',
    sourceUrl:
      'https://www.k-ruoka.fi/kauppa/tuote/herkkumaa-taysmajoneesi-5kg-6411300002355',
    aliases: ['herkkumaa täysmajoneesi', 'täysmajoneesi', 'herkkumaa mayo'],
  },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    note:
      'Offline seed mirror. Update imageUrl with stable CDN links when available; app also ships bundled packshots under assets/demo/.',
    products: SEED,
  };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${SEED.length} product(s) → ${OUT_FILE}`);
  console.log(
    'Tip: open the sourceUrl in a browser, copy the packshot CDN URL into seedKruoka.ts imageUrl.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
