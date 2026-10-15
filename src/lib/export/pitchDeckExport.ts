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

function slideToHtml(slide: DeckSlide, index: number): string {
  if (slide.kind === 'cover') {
    return `
<section class="page cover" ${index === 0 ? '' : ''}>
  <p class="kicker">${escapeHtml(slide.kicker)}</p>
  <h1>${escapeHtml(slide.brand)}</h1>
  <p class="tag">${escapeHtml(slide.tagline)}</p>
  <div class="card">
    <p class="card-label">${escapeHtml(slide.audienceLabel)}</p>
    <p>${escapeHtml(slide.audience)}</p>
  </div>
</section>`;
  }

  const parts: string[] = [
    `<section class="page">`,
    `<h2>${escapeHtml(slide.title)}</h2>`,
  ];
  if (slide.quote) {
    parts.push(`<blockquote>“${escapeHtml(slide.quote)}”</blockquote>`);
  }
  if (slide.role) {
    parts.push(`<p class="role">${escapeHtml(slide.role)}</p>`);
  }
  if (slide.body) {
    parts.push(`<p class="body">${escapeHtml(slide.body)}</p>`);
  }
  if (slide.metrics?.length) {
    parts.push(`<div class="metrics">`);
    for (const m of slide.metrics) {
      parts.push(`<div class="metric"><div class="metric-val">${escapeHtml(m.value)}</div><div class="metric-label">${escapeHtml(m.label)}</div>${m.sub ? `<div class="metric-sub">${escapeHtml(m.sub)}</div>` : ''}</div>`);
    }
    parts.push(`</div>`);
  }
  if (slide.columns?.length) {
    parts.push(`<div class="cols">`);
    for (const col of slide.columns) {
      parts.push(
        `<div class="col"><h3>${escapeHtml(col.head)}</h3><ul>${col.bullets
          .map((b) => `<li>${escapeHtml(b)}</li>`)
          .join('')}</ul></div>`,
      );
    }
    parts.push(`</div>`);
  }
  if (slide.cards?.length) {
    parts.push(`<div class="cards">`);
    for (const c of slide.cards) {
      parts.push(
        `<div class="mini"><h4>${escapeHtml(c.title)}</h4><p>${escapeHtml(c.body)}</p></div>`,
      );
    }
    parts.push(`</div>`);
  }
  if (slide.bullets?.length) {
    parts.push(
      `<ul class="bullets">${slide.bullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('')}</ul>`,
    );
  }
  if (slide.note) {
    parts.push(`<p class="note">${escapeHtml(slide.note)}</p>`);
  }
  parts.push(`</section>`);
  return parts.join('\n');
}

function buildPitchDeckHtml(orientation: PitchDeckOrientation): string {
  const slides = buildSlides();
  const portrait = orientation === 'vertical';
  const pageSize = portrait ? 'A4 portrait' : 'A4 landscape';
  const minH = portrait ? '240mm' : '170mm';
  const coverPad = portrait ? '22mm 12mm' : '18mm 14mm';
  const coverTitleSize = portrait ? '28px' : '36px';
  const metricDir = portrait ? 'column' : 'row';
  const miniWidth = portrait ? '100%' : 'calc(50% - 5px)';
  const colsDir = portrait ? 'column' : 'row';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(pitchMeta.brand)} — ${escapeHtml(pitchMeta.presentationLabel)}</title>
<style>
  @page { size: ${pageSize}; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #${INK};
    background: #${WHITE};
    font-size: 12px;
    line-height: 1.45;
  }
  .page {
    page-break-after: always;
    break-after: page;
    min-height: ${minH};
    padding: 8mm 6mm;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .cover {
    background: #${TEAL_DEEP};
    color: #${WHITE};
    border-radius: 12px;
    padding: ${coverPad};
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: ${minH};
  }
  .cover h1 { font-size: ${coverTitleSize}; margin: 8px 0 6px; letter-spacing: -0.5px; }
  .kicker { text-transform: uppercase; letter-spacing: 1.5px; font-size: 11px; opacity: 0.85; margin: 0; font-weight: 700; }
  .tag { font-size: 16px; margin: 0 0 18px; opacity: 0.95; }
  .cover .card {
    background: rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 14px 16px;
    max-width: 520px;
  }
  .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 6px; opacity: 0.85; }
  h2 { color: #${TEAL}; font-size: 22px; margin: 0 0 12px; }
  h3 { margin: 0 0 8px; font-size: 14px; color: #${TEAL_DEEP}; }
  h4 { margin: 0 0 4px; font-size: 13px; color: #${TEAL_DEEP}; }
  .body { margin: 0 0 12px; font-size: 13px; }
  .cols { display: flex; flex-direction: ${colsDir}; gap: 16px; }
  .col { flex: 1; background: #${PAGE}; border-radius: 10px; padding: 12px 14px; border: 1px solid #E2E8F0; }
  .metrics { display: flex; flex-direction: ${metricDir}; gap: 12px; margin-bottom: 12px; }
  .metric { flex: 1; background: #${TEAL}; color: #${WHITE}; border-radius: 10px; padding: 14px; }
  .metric:nth-child(2) { background: #${TEAL_DEEP}; }
  .metric:nth-child(3) { background: #0284C7; }
  .metric-val { font-size: 22px; font-weight: 800; }
  .metric-label { font-size: 11px; font-weight: 700; margin-top: 4px; opacity: 0.95; }
  .metric-sub { font-size: 10px; margin-top: 4px; opacity: 0.85; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; }
  .mini {
    width: ${miniWidth};
    background: #${PAGE};
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    padding: 10px 12px;
  }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 4px; }
  .bullets { margin-top: 8px; }
  .note {
    margin-top: 12px;
    background: #F0FDFA;
    border: 1px solid #CCFBF1;
    border-radius: 10px;
    padding: 10px 12px;
    font-weight: 600;
  }
  blockquote {
    margin: 0 0 8px;
    font-size: 15px;
    font-style: italic;
    color: #${INK};
    border-left: 4px solid #${TEAL};
    padding-left: 12px;
  }
  .role { color: #${MUTED}; font-weight: 700; margin: 0 0 14px; }
</style>
</head>
<body>
${slides.map((s, i) => slideToHtml(s, i)).join('\n')}
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
