/**
 * End-to-end Playwright demo for inventaario web.
 * Saves screenshots to assets/preview/demo-*.png
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
  await page.waitForTimeout(700);
}

async function press(page, pattern) {
  const pressable = page.locator('[tabindex="0"]').filter({ hasText: pattern });
  const target =
    (await pressable.count()) > 0
      ? pressable.first()
      : page.getByText(pattern).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`no box ${pattern}`);
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + Math.min(box.height / 2, 24),
  );
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

async function fiberPress(page, exactText) {
  return page.evaluate((text) => {
    const all = Array.from(document.querySelectorAll('div'));
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
      for (let depth = 0; depth < 12 && cur; depth++) {
        const fiberKey = Object.keys(cur).find((k) =>
          k.startsWith('__reactFiber'),
        );
        if (fiberKey) {
          let fiber = cur[fiberKey];
          for (let i = 0; i < 15 && fiber; i++) {
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (
    await browser.newContext({
      viewport: { width: 430, height: 1200 },
      deviceScaleFactor: 2,
    })
  ).newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText(/What do you want to do\?/i).waitFor({ timeout: 120000 });
  await page.waitForTimeout(900);
  await shot(page, 'demo-00-home.png');

  await tab(page, 'Inventory');
  await page.getByText(/Name|Nimi/i).first().waitFor({ timeout: 15000 });
  await shot(page, 'demo-01-inventory-list.png');
  const before = await page.locator('body').innerText();
  console.log('OK inventory');

  await tab(page, 'Catalog');
  await page.getByPlaceholder(/Search|capers|brand|Hae/i).fill('capers');
  await page.waitForTimeout(800);
  await page.getByText(/Figaro Kapris/i).first().waitFor({ timeout: 10000 });
  await shot(page, 'demo-02-catalog-capers.png');
  console.log('OK catalog Figaro Kapris');

  await tab(page, 'Scan');
  await shot(page, 'demo-03-scan-hub.png');
  await page.getByText('Delivery', { exact: true }).first().click({ force: true });
  await page.getByText(/Run delivery demo/i).waitFor({ timeout: 10000 });
  await shot(page, 'demo-04-delivery-ready.png');
  await press(page, /Run delivery demo/i);
  await page
    .getByText(/Confirm delivery \(add stock\)/i)
    .waitFor({ timeout: 20000 });
  await shot(page, 'demo-05-delivery-lines.png');
  console.log('OK delivery lines');

  await fiberPress(page, 'Confirm delivery (add stock)');
  await page.waitForTimeout(1500);
  await shot(page, 'demo-06-after-confirm.png');
  console.log('OK confirmed → home');

  await tab(page, 'Inventory');
  await page.waitForTimeout(700);
  await shot(page, 'demo-07-inventory-after-delivery.png');
  const after = await page.locator('body').innerText();
  console.log('LIST_CHANGED', before !== after);

  await tab(page, 'More');
  await press(page, /Local \/ offline|Reports chat|Raportit/i);
  await page.waitForTimeout(700);
  if ((await page.getByText('How many falafel bowls can I make?').count()) > 0) {
    await press(page, 'How many falafel bowls can I make?');
  } else if ((await page.getByText('How much money in stock?').count()) > 0) {
    await press(page, 'How much money in stock?');
  }
  await page.waitForTimeout(1000);
  await shot(page, 'demo-08-reports-chat.png');
  console.log('OK reports');

  const back = page.getByRole('link', { name: /MainTabs, back/i });
  if ((await back.count()) > 0) {
    const box = await back.first().boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.waitForTimeout(800);
  if ((await page.getByText(/^Language$|^Kieli$/).count()) === 0) {
    await tab(page, 'More');
  }

  await fiberPress(page, 'FI');
  await page.waitForTimeout(900);
  await shot(page, 'demo-09-lang-fi.png');
  console.log('OK FI');

  await fiberPress(page, 'EN');
  await page.waitForTimeout(900);
  await shot(page, 'demo-10-lang-en.png');
  console.log('OK EN');

  await browser.close();
  console.log('DEMO_DONE');
}

main().catch((e) => {
  console.error('DEMO_FAILED', e);
  process.exit(1);
});
