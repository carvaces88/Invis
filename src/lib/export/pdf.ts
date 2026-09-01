import * as Print from 'expo-print';
import type {
  InventoryPeriodSnapshot,
  InventorySession,
  Product,
  Recipe,
  StockMovement,
} from '../../data/types';
import { en, type Messages } from '../../i18n/en';
import { printHtmlOrSharePdf } from './download';
import {
  cellDisplay,
  columnHeader,
  DEFAULT_EXPORT_PROFILE,
  getExportProfile,
  isNumericColumn,
  restolutionHeaderParts,
  totalsFooterCells,
  type ExportCellContext,
  type ExportColumnId,
  type ExportProfileId,
} from './profiles';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type ExportDataContext = {
  movements?: StockMovement[];
  products?: Product[];
  recipes?: Recipe[];
  periodSnapshot?: InventoryPeriodSnapshot | null;
};

/** US Letter landscape @ 72 PPI — wide enough for Restolution’s 9 columns. */
const LANDSCAPE_LETTER = { width: 792, height: 612 } as const;
const PORTRAIT_LETTER = { width: 612, height: 792 } as const;

function needsLandscape(columns: ExportColumnId[]): boolean {
  return columns.length >= 6 || columns.includes('turnover');
}

/** Percentage widths so the table always fills the printable page (no horizontal clip). */
function colWidthPct(col: ExportColumnId, columns: ExportColumnId[]): string {
  const wide = needsLandscape(columns);
  switch (col) {
    case 'productCode':
      return wide ? '11%' : '14%';
    case 'name':
      return wide ? '22%' : '36%';
    case 'openingStock':
    case 'purchases':
    case 'closingStock':
    case 'usage':
    case 'need':
    case 'variance':
      return wide ? '8%' : '10%';
    case 'turnover':
      return wide ? '11%' : '14%';
    case 'unit':
      return '10%';
    case 'qty':
      return '12%';
    case 'price':
    case 'total':
      return '14%';
    case 'date':
      return '14%';
    default:
      return `${Math.floor(100 / Math.max(columns.length, 1))}%`;
  }
}

function headerHtml(
  col: ExportColumnId,
  labels: Messages,
  finnishRestolution: boolean,
): string {
  if (finnishRestolution) {
    const parts = restolutionHeaderParts(col);
    if (parts) {
      return `<span class="h-fi">${escapeHtml(parts.fi)}</span><span class="h-en">${escapeHtml(parts.en)}</span>`;
    }
  }
  return escapeHtml(
    columnHeader(col, labels, { finnishRestolution }),
  );
}

export async function exportSessionPdf(
  session: InventorySession,
  labels: Messages = en,
  profileId: ExportProfileId = DEFAULT_EXPORT_PROFILE,
  dataCtx: ExportDataContext = {},
) {
  const profile = getExportProfile(profileId);
  const ctx: ExportCellContext = { session, ...dataCtx };
  const fiHeaders = Boolean(profile.finnishExportHeaders);
  const landscape = needsLandscape(profile.columns);
  const page = landscape ? LANDSCAPE_LETTER : PORTRAIT_LETTER;

  const colgroup = profile.columns
    .map(
      (col) =>
        `<col style="width:${colWidthPct(col, profile.columns)}" />`,
    )
    .join('');

  const head = profile.columns
    .map(
      (col) =>
        `<th class="${isNumericColumn(col) ? 'num' : ''}">${headerHtml(
          col,
          labels,
          fiHeaders,
        )}</th>`,
    )
    .join('');

  const bodyRows = session.lines
    .map((line) => {
      const cells = profile.columns
        .map(
          (col) =>
            `<td class="${isNumericColumn(col) ? 'num' : ''}">${escapeHtml(
              cellDisplay(col, line, ctx),
            )}</td>`,
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const footer = totalsFooterCells(session, profile, labels);
  const footHtml = footer
    ? `<tfoot><tr>${footer
        .map(
          (text, i) =>
            `<td class="${
              isNumericColumn(profile.columns[i]) ? 'num' : ''
            }">${escapeHtml(text)}</td>`,
        )
        .join('')}</tr></tfoot>`
    : '';

  const dateLabel = session.date.includes('-')
    ? session.date.split('-').reverse().join('.')
    : session.date;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(
    profileId === 'restolution'
      ? `restolution-${session.date}`
      : `inventory-${session.date}`,
  )}</title>
  <style>
    @page {
      size: ${landscape ? 'landscape' : 'portrait'};
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Helvetica, Arial, sans-serif;
      color: #0B1F33;
      padding: 8px 10px 12px;
    }
    h1 {
      font-size: 14px;
      margin: 0 0 2px;
      letter-spacing: 0.02em;
    }
    .meta {
      color: #5A6B7D;
      font-size: 9px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      max-width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: ${landscape ? '8px' : '10px'};
    }
    th, td {
      border: 1px solid #D7E0EA;
      padding: 3px 4px;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    th {
      background: #E6F0F8;
      font-weight: 700;
      font-size: ${landscape ? '7px' : '9px'};
      line-height: 1.25;
    }
    th .h-fi { display: block; }
    th .h-en {
      display: block;
      font-weight: 500;
      color: #5A6B7D;
      font-size: 0.92em;
    }
    td { line-height: 1.3; }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    tfoot td { font-weight: 700; background: #F4F7FB; }
  </style>
</head>
<body>
  <h1>${escapeHtml(
    profileId === 'restolution' ? 'Restolution' : session.title,
  )}</h1>
  <div class="meta">${escapeHtml(labels.date)}: ${escapeHtml(dateLabel)}${
    profile.includeTotals ? ` · ${escapeHtml(labels.exclVat)}` : ''
  } · ${session.lines.length} rows</div>
  <table>
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${head}</tr></thead>
    <tbody>${bodyRows}</tbody>
    ${footHtml}
  </table>
</body>
</html>`;

  const filename =
    profileId === 'restolution'
      ? `restolution-${session.date}.pdf`
      : `inventory-${session.date}.pdf`;

  return printHtmlOrSharePdf({
    html,
    filename,
    dialogTitle: labels.export,
    nativePrint: () =>
      Print.printToFileAsync({
        html,
        width: page.width,
        height: page.height,
      }),
  });
}
