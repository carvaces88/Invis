/**
 * Capture current Invis UI shots → assets/preview/latest-*.png
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const URL = 'http://localhost:8081';

async function shot(page, name) {
  const dest = path.join(OUT, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log('SHOT', dest);
}

async function tab(page, label) {
  const all = page.getByText(label, { exact: true });
  const n = await all.count();
  let best = null;
  for (let i = 0; i < n; i++) {
    const box = await all.nth(i).boundingBox();
    if (!box) continue;
    if (!best || box.y > best.box.y) best = { box };
  }
  if (!best) throw new Error(`no tab ${label} count=${n}`);
  await page.mouse.click(
    best.box.x + best.box.width / 2,
    best.box.y + best.box.height / 2,
  );
  await page.waitForTimeout(800);
}

async function fiberPress(page, exactText) {
  return page.evaluate((text) => {
    const all = Array.from(document.querySelectorAll('div, span, a'));
    const candidates = all.filter(
      (d) =>
        d.childNodes &&
        Array.from(d.childNodes).some(
          (c) => c.nodeType === 3 && c.textContent === text,
        ),
    );
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      let cur = el;
      for (let depth = 0; depth < 14 && cur; depth++) {
        const fiberKey = Object.keys(cur).find((k) =>
          k.startsWith('__reactFiber'),
        );
        if (fiberKey) {
          let fiber = cur[fiberKey];
          for (let i = 0; i < 18 && fiber; i++) {
            const props = fiber.memoizedProps || fiber.pendingProps;
            if (props && typeof props.onPress === 'function') {
              props.onPress({});
              return true;
            }
            fiber = fiber.return;
          }
        }
        cur = cur.parentElement;
      }
    }
    return false;
  }, exactText);
}

async function pressText(page, pattern) {
  const pressable = page.locator('[tabindex="0"]').filter({ hasText: pattern });
  const target =
    (await pressable.count()) > 0
      ? pressable.first()
      : page.getByText(pattern).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`no box ${pattern}`);
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 20));
  await page.waitForTimeout(700);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
    })
  ).newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText(/Hello Chef|What do you want to do\?/i).waitFor({
    timeout: 120000,
  });
  await page.waitForTimeout(1000);
  await shot(page, 'latest-01-home.png');
  console.log('OK home');

  await tab(page, 'Inventory');
  await page.getByText(/0% ALV|With ALV|Name/i).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  await shot(page, 'latest-02-inventory.png');
  console.log('OK inventory');

  // Scroll list to buffet/meat if present
  const scrollTarget = page
    .getByText(/buffet|meat|liha|Buffet|Meat/i)
    .first();
  if ((await scrollTarget.count()) > 0) {
    await scrollTarget.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
  } else {
    // Scroll inventory list area down a bit
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(400);
  }
  await shot(page, 'latest-02b-inventory-scrolled.png');
  console.log('OK inventory scrolled');

  // Open unit legend if ? is visible
  const unitHelp = page.getByText('?', { exact: true });
  if ((await unitHelp.count()) > 0) {
    const ok = await fiberPress(page, '?');
    if (!ok) {
      try {
        await pressText(page, /^\?$/);
      } catch {
        /* ignore */
      }
    }
    await page.waitForTimeout(700);
    if (
      (await page.getByText(/Unit codes|YKSIKKÖ|PSS|LTK/i).count()) > 0
    ) {
      await shot(page, 'latest-02c-unit-legend.png');
      console.log('OK unit legend');
      // close if possible
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
      const close = page.getByText(/Close|Sulje|Got it|OK/i);
      if ((await close.count()) > 0) {
        await fiberPress(page, 'Close').catch(() => {});
        await page.waitForTimeout(400);
      }
    }
  }

  // Export Excel sheet
  const excelOk = await fiberPress(page, 'Excel');
  if (!excelOk) {
    await pressText(page, /^Excel$/);
  }
  await page
    .getByText(/What info or data do you want to export\?/i)
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, 'latest-03-export-presets.png');
  console.log('OK export presets');

  // Dismiss sheet
  await fiberPress(page, 'Cancel').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // Catalog
  await tab(page, 'Catalog');
  await page.waitForTimeout(800);
  const search = page.getByPlaceholder(/Search|Hae|capers|brand/i);
  if ((await search.count()) > 0) {
    await search.fill('capers');
    await page.waitForTimeout(700);
  }
  await shot(page, 'latest-04-catalog.png');
  console.log('OK catalog');

  // Record inventory from home if easy
  await tab(page, 'Home');
  await page.waitForTimeout(600);
  const recordOk = await fiberPress(page, 'Record inventory');
  if (!recordOk) {
    try {
      await pressText(page, /Record inventory/i);
    } catch {
      console.log('SKIP record inventory');
    }
  }
  await page.waitForTimeout(900);
  if (
    (await page.getByText(/Record|Count|Qty|quantity|Search/i).count()) > 0
  ) {
    await shot(page, 'latest-05-record.png');
    console.log('OK record');
  }

  await browser.close();
  console.log('LATEST_DONE');
}

main().catch((e) => {
  console.error('LATEST_FAILED', e);
  process.exit(1);
});
