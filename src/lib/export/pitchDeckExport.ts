import * as Print from 'expo-print';
import {
  finlandSomArrEur,
  nordicsArrEur,
  pitchApproach,
  pitchAsk,
  pitchBusinessModel,
  pitchCompetitors,
  pitchMarket,
  pitchMeta,
  pitchMoat,
  pitchProduct,
  pitchProjections,
  pitchRoi,
  pitchVision,
  projectionArrEur,
} from '../../data/pitchDeck';
import { printHtmlOrSharePdf, shareOrDownloadBase64 } from './download';

const TEAL = '0D9488';
const TEAL_DEEP = '0F766E';
const INK = '1E293B';
const MUTED = '64748B';
const WHITE = 'FFFFFF';
const PAGE = 'F8FAFC';

function formatEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1000)}k`;
  return `€${n}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export type PitchDeckOrientation = 'horizontal' | 'vertical';

function filenameBase(orientation: PitchDeckOrientation): string {
  const orient = orientation === 'vertical' ? 'portrait' : 'landscape';
  return `Invis-investor-pitch-${orient}-${stamp()}`;
}

/** Shared slide content used by PDF + PPTX builders. */
type DeckSlide =
  | {
      kind: 'cover';
      kicker: string;
      brand: string;
      tagline: string;
      audienceLabel: string;
      audience: string;
    }
  | {
      kind: 'section';
      title: string;
      body?: string;
      bullets?: string[];
      columns?: { head: string; bullets: string[] }[];
      cards?: { title: string; body: string }[];
      metrics?: { label: string; value: string; sub?: string }[];
      note?: string;
      quote?: string;
      role?: string;
    };

function buildSlides(): DeckSlide[] {
  const som = finlandSomArrEur();
  const nordics = nordicsArrEur();

  return [
    {
      kind: 'cover',
      kicker: pitchMeta.presentationLabel,
      brand: pitchMeta.brand,
      tagline: pitchMeta.tagline,
      audienceLabel: 'Target audience',
      audience: pitchMeta.audience,
    },
    {
      kind: 'section',
      title: pitchVision.headline,
      body: pitchVision.body,
      columns: [
        { head: 'Legacy', bullets: [...pitchVision.legacyBullets] },
        { head: pitchMeta.brandShort, bullets: [...pitchVision.invisBullets] },
      ],
    },
    {
      kind: 'section',
      title: pitchProduct.headline,
      body: pitchProduct.body,
      cards: pitchProduct.steps.map((s) => ({
        title: `${s.short} — ${s.title}`,
        body: s.body,
      })),
    },
    {
      kind: 'section',
      title: 'Market analysis',
      metrics: [
        {
          label: 'TAM',
          value: `$${pitchMarket.globalTamUsdB}B`,
          sub: `${pitchMarket.cagrPct}% CAGR · global kitchen inventory software`,
        },
        {
          label: 'SAM',
          value: `€${pitchMarket.euSamArrEurM}M`,
          sub: `~${pitchMarket.euFullServiceKitchensK}k full-service EU kitchens`,
        },
        {
          label: 'SOM',
          value: formatEur(som),
          sub: `Finland Y1–3 · ${pitchMarket.fiTargetAccounts} × €${pitchMarket.arpuEurMonth}/mo`,
        },
      ],
    },
    {
      kind: 'section',
      title: 'Market size',
      metrics: [
        {
          label: 'Finland SOM ARR',
          value: formatEur(som),
          sub: `${pitchMarket.fiTargetAccounts} × €${pitchMarket.arpuEurMonth}/mo × 12`,
        },
        {
          label: 'Nordics ARR path',
          value: formatEur(nordics),
          sub: `${pitchMarket.nordicsTargetAccounts} kitchens target`,
        },
        {
          label: 'ARPU',
          value: `€${pitchMarket.arpuEurMonth}/mo`,
          sub: 'Target per kitchen',
        },
      ],
      note: `${pitchMarket.fiTargetAccounts} accounts × €${pitchMarket.arpuEurMonth}/mo × 12 = ${formatEur(som)} Finland ARR`,
    },
    {
      kind: 'section',
      title: 'Finland → Scandinavia path',
      cards: pitchProjections.map((p) => ({
        title: `${p.label} · ${p.kitchens} kitchens · ${formatEur(projectionArrEur(p.kitchens))} ARR`,
        body: p.note,
      })),
    },
    {
      kind: 'section',
      title: 'Our approach',
      bullets: pitchApproach.map((n) => `${n.label}`),
    },
    {
      kind: 'section',
      title: 'Business model',
      cards: pitchBusinessModel.map((p) => ({
        title: p.title,
        body: p.body,
      })),
    },
    {
      kind: 'section',
      title: 'Unfair advantage',
      cards: pitchMoat.map((m) => ({ title: m.title, body: m.body })),
    },
    {
      kind: 'section',
      title: 'Competitor pricing',
      cards: pitchCompetitors.map((c) => ({
        title:
          c.priceLow === c.priceHigh
            ? `${c.name} · $${c.priceLow}/mo`
            : `${c.name} · $${c.priceLow}–$${c.priceHigh}/mo`,
        body: c.note,
      })),
    },
    {
      kind: 'section',
      title: 'Core ROI',
      metrics: [
        {
          label: 'Waste of purchases',
          value: `${pitchRoi.wasteOfPurchasesLowPct}–${pitchRoi.wasteOfPurchasesHighPct}%`,
        },
        {
          label: 'Waste cut potential',
          value: `↓${pitchRoi.wasteCutPct}%`,
        },
        {
          label: 'Hours/week stock admin',
          value: `${pitchRoi.hoursSavedWeekly}+`,
        },
      ],
      cards: pitchRoi.points.map((p) => ({ title: p.title, body: p.body })),
    },
    {
      kind: 'section',
      title: pitchAsk.headline,
      body: pitchAsk.body,
      bullets: [...pitchAsk.bullets],
      quote: pitchAsk.founderQuote,
      role: pitchAsk.founderRole,
    },
  ];
}

/** Dense multi-section pages for PDF — not one sparse block per sheet. */
function buildPitchDeckHtml(orientation: PitchDeckOrientation): string {
  const portrait = orientation === 'vertical';
  const pageSize = portrait ? 'A4 portrait' : 'A4 landscape';
  const som = finlandSomArrEur();
  const nordics = nordicsArrEur();
  const pageCount = 5;

  const footer = (n: number) => `
<footer class="foot">
  <span class="foot-brand">${escapeHtml(pitchMeta.brandShort)}</span>
  <span class="foot-mid">${escapeHtml(pitchMeta.tagline)}</span>
  <span class="foot-page">${n} / ${pageCount}</span>
</footer>`;

  const header = (section: string) => `
<header class="head">
  <span class="head-brand">${escapeHtml(pitchMeta.brandShort)}</span>
  <span class="head-sec">${escapeHtml(section)}</span>
  <span class="head-label">${escapeHtml(pitchMeta.presentationLabel)}</span>
</header>`;

  const flowSteps = pitchProduct.steps
    .map(
      (s, i) => `
      <div class="flow-step">
        <div class="flow-num">${i + 1}</div>
        <div class="flow-short">${escapeHtml(s.short)}</div>
        <div class="flow-title">${escapeHtml(s.title)}</div>
        <p class="flow-body">${escapeHtml(s.body)}</p>
      </div>
      ${
        i < pitchProduct.steps.length - 1
          ? '<div class="flow-arrow" aria-hidden="true">→</div>'
          : ''
      }`,
    )
    .join('');

  const approachChips = pitchApproach
    .map((n) => `<span class="chip">${escapeHtml(n.label)}</span>`)
    .join('');

  const bizCards = pitchBusinessModel
    .map(
      (p) =>
        `<div class="tile"><h4>${escapeHtml(p.title)}</h4><p>${escapeHtml(p.body)}</p></div>`,
    )
    .join('');

  const moatCards = pitchMoat
    .map(
      (m) =>
        `<div class="tile"><h4>${escapeHtml(m.title)}</h4><p>${escapeHtml(m.body)}</p></div>`,
    )
    .join('');

  const projCards = pitchProjections
    .map(
      (p) =>
        `<div class="proj">
          <div class="proj-label">${escapeHtml(p.shortLabel)}</div>
          <div class="proj-val">${p.kitchens}</div>
          <div class="proj-sub">${escapeHtml(formatEur(projectionArrEur(p.kitchens)))} ARR</div>
          <p>${escapeHtml(p.note)}</p>
        </div>`,
    )
    .join('');

  const competitorRows = pitchCompetitors
    .map((c) => {
      const price =
        c.priceLow === c.priceHigh
          ? `$${c.priceLow}`
          : `$${c.priceLow}–$${c.priceHigh}`;
      const hl = 'highlight' in c && c.highlight ? ' class="hl"' : '';
      return `<tr${hl}><td>${escapeHtml(c.name)}</td><td>${price}/mo</td><td>${escapeHtml(c.note)}</td></tr>`;
    })
    .join('');

  const roiPoints = pitchRoi.points
    .map(
      (p) =>
        `<div class="tile"><h4>${escapeHtml(p.title)}</h4><p>${escapeHtml(p.body)}</p></div>`,
    )
    .join('');

  const askBullets = pitchAsk.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');

  const coverFlow = pitchProduct.steps
    .map((s) => `<span>${escapeHtml(s.short)}</span>`)
    .join('<span class="sep">→</span>');

  const pages = [
    `<section class="sheet cover">
      <div class="cover-inner">
        <p class="kicker">${escapeHtml(pitchMeta.presentationLabel)}</p>
        <h1>${escapeHtml(pitchMeta.brand)}</h1>
        <p class="tag">${escapeHtml(pitchMeta.tagline)}</p>
        <div class="cover-card">
          <p class="card-label">Target audience</p>
          <p>${escapeHtml(pitchMeta.audience)}</p>
        </div>
        <div class="cover-flow">${coverFlow}</div>
      </div>
      <div class="cover-foot">
        <span>${escapeHtml(pitchMeta.brandShort)} · Confidential · ${escapeHtml(stamp())}</span>
        <span>1 / ${pageCount}</span>
      </div>
    </section>`,

    `<section class="sheet">
      ${header('Product')}
      <div class="sheet-body">
        <div class="block">
          <h2>${escapeHtml(pitchVision.headline)}</h2>
          <p class="lede">${escapeHtml(pitchVision.body)}</p>
          <div class="cols two">
            <div class="col muted-col">
              <h3>Legacy</h3>
              <ul>${pitchVision.legacyBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
            </div>
            <div class="col accent-col">
              <h3>${escapeHtml(pitchMeta.brandShort)}</h3>
              <ul>${pitchVision.invisBullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
            </div>
          </div>
        </div>
        <div class="block grow">
          <h2>${escapeHtml(pitchProduct.headline)}</h2>
          <p class="lede tight">${escapeHtml(pitchProduct.body)}</p>
          <p class="eyebrow">${escapeHtml(pitchProduct.flowLabel)}</p>
          <div class="flow">${flowSteps}</div>
        </div>
      </div>
      ${footer(2)}
    </section>`,

    `<section class="sheet">
      ${header('Market')}
      <div class="sheet-body">
        <div class="block">
          <h2>Market analysis</h2>
          <div class="metrics">
            <div class="metric m1">
              <div class="metric-val">$${pitchMarket.globalTamUsdB}B</div>
              <div class="metric-label">TAM</div>
              <div class="metric-sub">${pitchMarket.cagrPct}% CAGR · global kitchen inventory software</div>
            </div>
            <div class="metric m2">
              <div class="metric-val">€${pitchMarket.euSamArrEurM}M</div>
              <div class="metric-label">SAM</div>
              <div class="metric-sub">~${pitchMarket.euFullServiceKitchensK}k full-service EU kitchens</div>
            </div>
            <div class="metric m3">
              <div class="metric-val">${escapeHtml(formatEur(som))}</div>
              <div class="metric-label">SOM</div>
              <div class="metric-sub">Finland Y1–3 · ${pitchMarket.fiTargetAccounts} × €${pitchMarket.arpuEurMonth}/mo</div>
            </div>
          </div>
          <div class="metrics compact">
            <div class="metric soft">
              <div class="metric-val">${escapeHtml(formatEur(som))}</div>
              <div class="metric-label">Finland SOM ARR</div>
              <div class="metric-sub">${pitchMarket.fiTargetAccounts} × €${pitchMarket.arpuEurMonth}/mo × 12</div>
            </div>
            <div class="metric soft">
              <div class="metric-val">${escapeHtml(formatEur(nordics))}</div>
              <div class="metric-label">Nordics ARR path</div>
              <div class="metric-sub">${pitchMarket.nordicsTargetAccounts} kitchens target</div>
            </div>
            <div class="metric soft">
              <div class="metric-val">€${pitchMarket.arpuEurMonth}/mo</div>
              <div class="metric-label">ARPU</div>
              <div class="metric-sub">Target per kitchen</div>
            </div>
          </div>
        </div>
        <div class="block grow">
          <h2>Finland → Scandinavia</h2>
          <div class="proj-row">${projCards}</div>
        </div>
      </div>
      ${footer(3)}
    </section>`,

    `<section class="sheet">
      ${header('Go-to-market')}
      <div class="sheet-body">
        <div class="block">
          <h2>Our approach</h2>
          <div class="chips">${approachChips}</div>
        </div>
        <div class="block">
          <h2>Business model</h2>
          <div class="grid four">${bizCards}</div>
        </div>
        <div class="block grow">
          <h2>Unfair advantage</h2>
          <div class="grid three">${moatCards}</div>
        </div>
      </div>
      ${footer(4)}
    </section>`,

    `<section class="sheet">
      ${header('ROI & ask')}
      <div class="sheet-body">
        <div class="split">
          <div class="block">
            <h2>Competitor pricing</h2>
            <table class="comp">
              <thead><tr><th>Product</th><th>Price</th><th>Note</th></tr></thead>
              <tbody>${competitorRows}</tbody>
            </table>
          </div>
          <div class="block">
            <h2>Core ROI</h2>
            <div class="metrics stack">
              <div class="metric m1">
                <div class="metric-val">${pitchRoi.wasteOfPurchasesLowPct}–${pitchRoi.wasteOfPurchasesHighPct}%</div>
                <div class="metric-label">Waste of purchases</div>
              </div>
              <div class="metric m2">
                <div class="metric-val">↓${pitchRoi.wasteCutPct}%</div>
                <div class="metric-label">Waste cut potential</div>
              </div>
              <div class="metric m3">
                <div class="metric-val">${pitchRoi.hoursSavedWeekly}+</div>
                <div class="metric-label">Hours/week stock admin</div>
              </div>
            </div>
            <div class="grid one">${roiPoints}</div>
          </div>
        </div>
        <div class="block ask">
          <h2>${escapeHtml(pitchAsk.headline)}</h2>
          <p class="lede tight">${escapeHtml(pitchAsk.body)}</p>
          <ul class="ask-list">${askBullets}</ul>
          <blockquote>“${escapeHtml(pitchAsk.founderQuote)}”</blockquote>
          <p class="role">${escapeHtml(pitchAsk.founderRole)}</p>
        </div>
      </div>
      ${footer(5)}
    </section>`,
  ];

  const titleSize = portrait ? '34px' : '42px';
  const h2Size = portrait ? '16px' : '18px';
  const padX = portrait ? '10mm' : '12mm';
  const padY = portrait ? '9mm' : '8mm';
  const flowDir = portrait ? 'column' : 'row';
  const splitDir = portrait ? 'column' : 'row';
  const gridFour = portrait ? '1fr 1fr' : '1fr 1fr 1fr 1fr';
  const gridThree = portrait ? '1fr' : '1fr 1fr 1fr';
  const projCols = portrait ? '1fr 1fr' : 'repeat(5, 1fr)';
  const sheetH = portrait ? '297mm' : '210mm';
  // Portrait packs taller stacks; slightly smaller type keeps page 5 from clipping.
  const bodySize = portrait ? '10px' : '11px';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(pitchMeta.brand)} — ${escapeHtml(pitchMeta.presentationLabel)}</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Avenir Next', 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #${INK};
    background: #${WHITE};
    font-size: ${bodySize};
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sheet {
    page-break-after: always;
    break-after: page;
    width: 100%;
    min-height: ${sheetH};
    height: ${sheetH};
    padding: ${padY} ${padX};
    display: flex;
    flex-direction: column;
    background: #${WHITE};
    position: relative;
    overflow: hidden;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }

  .head, .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .head {
    padding-bottom: 6px;
    border-bottom: 2px solid #${TEAL};
    margin-bottom: 8px;
  }
  .head-brand {
    font-weight: 800;
    letter-spacing: 1.4px;
    color: #${TEAL_DEEP};
    font-size: 11px;
  }
  .head-sec { color: #${MUTED}; font-size: 10px; font-weight: 600; }
  .head-label {
    color: #${MUTED};
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .foot {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px solid #E2E8F0;
    color: #${MUTED};
    font-size: 9px;
  }
  .foot-brand { font-weight: 800; color: #${TEAL_DEEP}; letter-spacing: 1px; }
  .foot-page { font-variant-numeric: tabular-nums; font-weight: 700; }

  .sheet-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${portrait ? '10px' : '8px'};
    min-height: 0;
  }
  .block { flex-shrink: 0; }
  .block.grow { flex: 1; min-height: 0; }
  h2 {
    color: #${TEAL_DEEP};
    font-size: ${h2Size};
    margin: 0 0 4px;
    letter-spacing: -0.2px;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 12px;
    color: #${TEAL_DEEP};
  }
  h4 {
    margin: 0 0 2px;
    font-size: 11px;
    color: #${TEAL_DEEP};
  }
  .lede { margin: 0 0 6px; font-size: ${portrait ? '11px' : '12px'}; color: #${INK}; }
  .lede.tight { margin-bottom: 4px; }
  .eyebrow {
    margin: 0 0 4px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #${TEAL};
  }

  .cols { display: flex; gap: 8px; }
  .cols.two > .col { flex: 1; }
  .col {
    border-radius: 8px;
    padding: 8px 10px;
    border: 1px solid #E2E8F0;
    background: #${PAGE};
  }
  .col.accent-col {
    background: #F0FDFA;
    border-color: #99F6E4;
  }
  ul { margin: 0; padding-left: 16px; }
  li { margin-bottom: 2px; }

  .flow {
    display: flex;
    flex-direction: ${flowDir};
    align-items: stretch;
    gap: 4px;
  }
  .flow-step {
    flex: 1;
    background: linear-gradient(165deg, #F0FDFA 0%, #${PAGE} 100%);
    border: 1px solid #CCFBF1;
    border-radius: 8px;
    padding: 7px 8px;
    min-width: 0;
  }
  .flow-num {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #${TEAL};
    color: #${WHITE};
    font-size: 10px;
    font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 3px;
  }
  .flow-short {
    font-weight: 800;
    color: #${TEAL_DEEP};
    font-size: 12px;
    letter-spacing: 0.3px;
  }
  .flow-title { font-weight: 700; font-size: 10px; margin: 1px 0 2px; }
  .flow-body { margin: 0; font-size: 9.5px; color: #${MUTED}; }
  .flow-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #${TEAL};
    font-weight: 800;
    font-size: 14px;
    padding: 0 2px;
    ${portrait ? 'transform: rotate(90deg); height: 12px;' : ''}
  }

  .metrics {
    display: flex;
    flex-direction: row;
    flex-wrap: ${portrait ? 'wrap' : 'nowrap'};
    gap: 6px;
    margin-bottom: 6px;
  }
  .metrics.compact { margin-bottom: 0; }
  .metrics.stack { flex-direction: ${portrait ? 'column' : 'row'}; }
  .metric {
    flex: 1;
    min-width: ${portrait ? '30%' : '0'};
    border-radius: 8px;
    padding: 8px 10px;
    color: #${WHITE};
    background: #${TEAL};
  }
  .metric.m2 { background: #${TEAL_DEEP}; }
  .metric.m3 { background: #0284C7; }
  .metric.soft {
    background: #F0FDFA;
    color: #${INK};
    border: 1px solid #CCFBF1;
  }
  .metric.soft .metric-val { color: #${TEAL_DEEP}; }
  .metric.soft .metric-label { color: #${TEAL_DEEP}; }
  .metric.soft .metric-sub { color: #${MUTED}; }
  .metric-val { font-size: ${portrait ? '16px' : '18px'}; font-weight: 800; letter-spacing: -0.3px; }
  .metric-label { font-size: 10px; font-weight: 700; margin-top: 2px; opacity: 0.95; }
  .metric-sub { font-size: 9px; margin-top: 2px; opacity: 0.88; line-height: 1.3; }

  .proj-row {
    display: grid;
    grid-template-columns: ${projCols};
    gap: 6px;
  }
  .proj {
    background: #${PAGE};
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 7px 8px;
  }
  .proj-label { font-size: 9px; font-weight: 700; color: #${TEAL}; text-transform: uppercase; letter-spacing: 0.6px; }
  .proj-val { font-size: 16px; font-weight: 800; color: #${INK}; }
  .proj-sub { font-size: 10px; font-weight: 700; color: #${TEAL_DEEP}; margin-bottom: 2px; }
  .proj p { margin: 0; font-size: 9px; color: #${MUTED}; }

  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip {
    background: #${TEAL};
    color: #${WHITE};
    font-weight: 700;
    font-size: 10px;
    padding: 5px 10px;
    border-radius: 999px;
  }

  .grid { display: grid; gap: 6px; }
  .grid.four { grid-template-columns: ${gridFour}; }
  .grid.three { grid-template-columns: ${gridThree}; }
  .grid.one { grid-template-columns: 1fr; gap: 4px; margin-top: 6px; }
  .tile {
    background: #${PAGE};
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 7px 9px;
  }
  .tile p { margin: 0; font-size: 9.5px; color: #${MUTED}; }

  .split {
    display: flex;
    flex-direction: ${splitDir};
    gap: 10px;
    align-items: flex-start;
    flex: 1;
  }
  .split > .block { flex: 1; min-width: 0; }

  table.comp {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
  }
  table.comp th {
    text-align: left;
    background: #${TEAL_DEEP};
    color: #${WHITE};
    padding: 5px 7px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table.comp td {
    padding: 5px 7px;
    border-bottom: 1px solid #E2E8F0;
    vertical-align: top;
  }
  table.comp tr.hl td {
    background: #F0FDFA;
    font-weight: 700;
    color: #${TEAL_DEEP};
  }
  table.comp td:nth-child(2) { white-space: nowrap; font-weight: 700; }

  .ask {
    background: linear-gradient(135deg, #F0FDFA 0%, #${PAGE} 60%);
    border: 1px solid #CCFBF1;
    border-radius: 10px;
    padding: 8px 10px;
    margin-top: 2px;
  }
  .ask-list { margin: 4px 0 6px; padding-left: 16px; }
  .ask-list li { margin-bottom: 2px; font-weight: 600; font-size: 10.5px; }
  blockquote {
    margin: 0 0 4px;
    font-size: 11px;
    font-style: italic;
    color: #${INK};
    border-left: 3px solid #${TEAL};
    padding-left: 10px;
  }
  .role { color: #${MUTED}; font-weight: 700; margin: 0; font-size: 10px; }

  .cover {
    background: linear-gradient(155deg, #0F766E 0%, #0D9488 55%, #0284C7 120%);
    color: #${WHITE};
    padding: 0;
  }
  .cover-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${portrait ? '22mm 12mm' : '16mm 18mm'};
  }
  .cover h1 {
    font-size: ${titleSize};
    margin: 8px 0 8px;
    letter-spacing: -0.8px;
    font-weight: 800;
  }
  .kicker {
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 11px;
    opacity: 0.88;
    margin: 0;
    font-weight: 700;
  }
  .tag { font-size: ${portrait ? '15px' : '18px'}; margin: 0 0 18px; opacity: 0.95; font-weight: 500; }
  .cover-card {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.22);
    border-radius: 10px;
    padding: 12px 14px;
    max-width: 560px;
  }
  .card-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 5px;
    opacity: 0.85;
  }
  .cover-card p:last-child { margin: 0; font-size: 12px; line-height: 1.45; }
  .cover-flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 22px;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.4px;
  }
  .cover-flow .sep { opacity: 0.7; font-weight: 600; }
  .cover-foot {
    display: flex;
    justify-content: space-between;
    padding: 10px ${padX};
    font-size: 10px;
    font-weight: 600;
    opacity: 0.85;
    border-top: 1px solid rgba(255,255,255,0.18);
  }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

export async function exportPitchDeckPdf(
  orientation: PitchDeckOrientation = 'horizontal',
): Promise<string> {
  const html = buildPitchDeckHtml(orientation);
  const filename = `${filenameBase(orientation)}.pdf`;
  const landscape = orientation === 'horizontal';
  return printHtmlOrSharePdf({
    html,
    filename,
    dialogTitle: `${pitchMeta.brand} — PDF (${orientation})`,
    nativePrint: () =>
      Print.printToFileAsync({
        html,
        width: landscape ? 842 : 595,
        height: landscape ? 595 : 842,
      }),
  });
}

type PptxCtor = new () => {
  author: string;
  title: string;
  subject: string;
  layout: string;
  defineLayout: (opts: { name: string; width: number; height: number }) => void;
  ShapeType: { roundRect: unknown };
  addSlide: () => {
    background: { color: string };
    addText: (...args: unknown[]) => void;
    addShape: (...args: unknown[]) => void;
  };
  write: (opts: {
    outputType: 'base64';
  }) => Promise<string | Uint8Array | ArrayBuffer | Blob>;
};

export async function exportPitchDeckPptx(
  orientation: PitchDeckOrientation = 'horizontal',
): Promise<string> {
  // Dynamic import keeps the pitch screen light until export is tapped.
  const mod = await import('pptxgenjs');
  const PptxGenJS = ((mod as { default?: PptxCtor }).default ??
    mod) as unknown as PptxCtor;

  const pptx = new PptxGenJS();
  pptx.author = 'Cesar Carvajal';
  pptx.title = `${pitchMeta.brand} — ${pitchMeta.presentationLabel}`;
  pptx.subject = pitchMeta.tagline;

  const landscape = orientation === 'horizontal';
  // Wide 16:9 vs tall phone/print portrait
  pptx.defineLayout({
    name: landscape ? 'INVIS_LANDSCAPE' : 'INVIS_PORTRAIT',
    width: landscape ? 13.333 : 7.5,
    height: landscape ? 7.5 : 13.333,
  });
  pptx.layout = landscape ? 'INVIS_LANDSCAPE' : 'INVIS_PORTRAIT';

  const contentW = landscape ? 12.3 : 6.5;
  const marginX = 0.5;
  const slides = buildSlides();

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: WHITE };

    if (slide.kind === 'cover') {
      s.background = { color: TEAL_DEEP };
      const coverY = landscape ? 1.2 : 2.4;
      s.addText(slide.kicker.toUpperCase(), {
        x: marginX,
        y: coverY,
        w: contentW,
        h: 0.4,
        color: WHITE,
        fontSize: 12,
        bold: true,
        charSpacing: 2,
      });
      s.addText(slide.brand, {
        x: marginX,
        y: coverY + 0.5,
        w: contentW,
        h: landscape ? 0.9 : 1.1,
        color: WHITE,
        fontSize: landscape ? 36 : 28,
        bold: true,
      });
      s.addText(slide.tagline, {
        x: marginX,
        y: coverY + (landscape ? 1.5 : 1.8),
        w: contentW - 0.3,
        h: 0.5,
        color: WHITE,
        fontSize: 18,
      });
      const cardY = coverY + (landscape ? 2.3 : 2.8);
      const cardW = Math.min(contentW, landscape ? 8.5 : contentW);
      s.addShape(pptx.ShapeType.roundRect, {
        x: marginX,
        y: cardY,
        w: cardW,
        h: landscape ? 1.6 : 2.2,
        fill: { color: '0F766E' },
        line: { color: '14B8A6', width: 1 },
        rectRadius: 0.1,
      });
      s.addText(slide.audienceLabel.toUpperCase(), {
        x: marginX + 0.25,
        y: cardY + 0.15,
        w: cardW - 0.5,
        h: 0.3,
        color: 'CCFBF1',
        fontSize: 11,
        bold: true,
      });
      s.addText(slide.audience, {
        x: marginX + 0.25,
        y: cardY + 0.5,
        w: cardW - 0.5,
        h: landscape ? 0.9 : 1.4,
        color: WHITE,
        fontSize: 14,
      });
      continue;
    }

    s.addText(slide.title, {
      x: marginX,
      y: 0.35,
      w: contentW,
      h: 0.5,
      color: TEAL,
      fontSize: landscape ? 24 : 22,
      bold: true,
    });

    let y = 1.0;

    if (slide.quote) {
      s.addText(`“${slide.quote}”`, {
        x: marginX,
        y,
        w: contentW,
        h: landscape ? 0.9 : 1.3,
        color: INK,
        fontSize: 14,
        italic: true,
      });
      y += landscape ? 1.0 : 1.4;
    }
    if (slide.role) {
      s.addText(slide.role, {
        x: marginX,
        y,
        w: contentW,
        h: 0.35,
        color: MUTED,
        fontSize: 12,
        bold: true,
      });
      y += 0.45;
    }
    if (slide.body) {
      s.addText(slide.body, {
        x: marginX,
        y,
        w: contentW,
        h: landscape ? 1.1 : 1.5,
        color: INK,
        fontSize: 13,
      });
      y += landscape ? 1.2 : 1.6;
    }

    if (slide.metrics?.length) {
      if (landscape) {
        const w = contentW / slide.metrics.length;
        slide.metrics.forEach((m, i) => {
          const colors = [TEAL, TEAL_DEEP, '0284C7'];
          const x = marginX + i * (w + 0.08);
          s.addShape(pptx.ShapeType.roundRect, {
            x,
            y,
            w: w - 0.08,
            h: 1.35,
            fill: { color: colors[i % colors.length]! },
            rectRadius: 0.08,
          });
          s.addText(m.value, {
            x: x + 0.15,
            y: y + 0.2,
            w: w - 0.35,
            h: 0.45,
            color: WHITE,
            fontSize: 20,
            bold: true,
          });
          s.addText(m.label, {
            x: x + 0.15,
            y: y + 0.7,
            w: w - 0.35,
            h: 0.25,
            color: WHITE,
            fontSize: 11,
            bold: true,
          });
          if (m.sub) {
            s.addText(m.sub, {
              x: x + 0.15,
              y: y + 0.95,
              w: w - 0.35,
              h: 0.3,
              color: WHITE,
              fontSize: 9,
            });
          }
        });
        y += 1.55;
      } else {
        const colors = [TEAL, TEAL_DEEP, '0284C7'];
        slide.metrics.forEach((m, i) => {
          s.addShape(pptx.ShapeType.roundRect, {
            x: marginX,
            y,
            w: contentW,
            h: 1.15,
            fill: { color: colors[i % colors.length]! },
            rectRadius: 0.08,
          });
          s.addText(m.value, {
            x: marginX + 0.2,
            y: y + 0.15,
            w: contentW - 0.4,
            h: 0.4,
            color: WHITE,
            fontSize: 20,
            bold: true,
          });
          s.addText(
            m.sub ? `${m.label} · ${m.sub}` : m.label,
            {
              x: marginX + 0.2,
              y: y + 0.6,
              w: contentW - 0.4,
              h: 0.4,
              color: WHITE,
              fontSize: 11,
              bold: true,
            },
          );
          y += 1.28;
        });
      }
    }

    if (slide.columns?.length) {
      if (landscape) {
        const w = contentW / slide.columns.length;
        slide.columns.forEach((col, i) => {
          const x = marginX + i * (w + 0.1);
          s.addShape(pptx.ShapeType.roundRect, {
            x,
            y,
            w: w - 0.1,
            h: 2.4,
            fill: { color: PAGE },
            line: { color: 'E2E8F0', width: 1 },
            rectRadius: 0.08,
          });
          s.addText(col.head, {
            x: x + 0.15,
            y: y + 0.15,
            w: w - 0.4,
            h: 0.35,
            color: TEAL_DEEP,
            fontSize: 14,
            bold: true,
          });
          s.addText(col.bullets.map((b) => `• ${b}`).join('\n'), {
            x: x + 0.15,
            y: y + 0.55,
            w: w - 0.4,
            h: 1.7,
            color: INK,
            fontSize: 13,
          });
        });
        y += 2.6;
      } else {
        slide.columns.forEach((col) => {
          s.addShape(pptx.ShapeType.roundRect, {
            x: marginX,
            y,
            w: contentW,
            h: 1.9,
            fill: { color: PAGE },
            line: { color: 'E2E8F0', width: 1 },
            rectRadius: 0.08,
          });
          s.addText(col.head, {
            x: marginX + 0.15,
            y: y + 0.12,
            w: contentW - 0.3,
            h: 0.3,
            color: TEAL_DEEP,
            fontSize: 14,
            bold: true,
          });
          s.addText(col.bullets.map((b) => `• ${b}`).join('\n'), {
            x: marginX + 0.15,
            y: y + 0.5,
            w: contentW - 0.3,
            h: 1.25,
            color: INK,
            fontSize: 13,
          });
          y += 2.05;
        });
      }
    }

    if (slide.cards?.length) {
      const cols = landscape ? Math.min(2, slide.cards.length) : 1;
      const cardW = (contentW - (cols - 1) * 0.15) / cols;
      const cardH = landscape ? 1.15 : 1.25;
      slide.cards.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * (cardW + 0.15);
        const cy = y + row * (cardH + 0.12);
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: cy,
          w: cardW,
          h: cardH,
          fill: { color: PAGE },
          line: { color: 'E2E8F0', width: 1 },
          rectRadius: 0.08,
        });
        s.addText(c.title, {
          x: x + 0.12,
          y: cy + 0.1,
          w: cardW - 0.24,
          h: 0.3,
          color: TEAL_DEEP,
          fontSize: 12,
          bold: true,
        });
        s.addText(c.body, {
          x: x + 0.12,
          y: cy + 0.4,
          w: cardW - 0.24,
          h: cardH - 0.5,
          color: MUTED,
          fontSize: 11,
        });
      });
      y += Math.ceil(slide.cards.length / cols) * (cardH + 0.12);
    }

    if (slide.bullets?.length) {
      s.addText(slide.bullets.map((b) => `→ ${b}`).join('\n'), {
        x: marginX,
        y,
        w: contentW,
        h: Math.min(landscape ? 2.5 : 3.5, slide.bullets.length * 0.4 + 0.2),
        color: INK,
        fontSize: 14,
      });
      y += slide.bullets.length * 0.4 + 0.3;
    }

    if (slide.note) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: marginX,
        y,
        w: contentW,
        h: landscape ? 0.7 : 0.9,
        fill: { color: 'F0FDFA' },
        line: { color: 'CCFBF1', width: 1 },
        rectRadius: 0.08,
      });
      s.addText(slide.note, {
        x: marginX + 0.2,
        y: y + 0.15,
        w: contentW - 0.4,
        h: landscape ? 0.4 : 0.6,
        color: TEAL_DEEP,
        fontSize: 13,
        bold: true,
      });
    }
  }

  const raw = await pptx.write({ outputType: 'base64' });
  const base64 = typeof raw === 'string' ? raw : String(raw);
  const filename = `${filenameBase(orientation)}.pptx`;
  return shareOrDownloadBase64({
    base64,
    filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    uti: 'org.openxmlformats.presentationml.presentation',
    dialogTitle: `${pitchMeta.brand} — PowerPoint (${orientation})`,
  });
}
