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
  totalsFooterCells,
  type ExportCellContext,
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

export async function exportSessionPdf(
  session: InventorySession,
  labels: Messages = en,
  profileId: ExportProfileId = DEFAULT_EXPORT_PROFILE,
  dataCtx: ExportDataContext = {},
) {
  const profile = getExportProfile(profileId);
  const ctx: ExportCellContext = { session, ...dataCtx };
  const fiHeaders = Boolean(profile.finnishExportHeaders);

  const head = profile.columns
    .map(
      (col) =>
        `<th class="${isNumericColumn(col) ? 'num' : ''}">${escapeHtml(
          columnHeader(col, labels, { finnishRestolution: fiHeaders }),
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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(`inventory-${session.date}`)}</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; color: #0B1F33; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: 0.02em; }
    .meta { color: #5A6B7D; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #D7E0EA; padding: 6px 8px; text-align: left; }
    th { background: #E6F0F8; font-weight: 600; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight: 700; background: #F4F7FB; }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.title)}</h1>
  <div class="meta">${labels.date}: ${escapeHtml(session.date)}${
    profile.includeTotals ? ` · ${labels.exclVat}` : ''
  }</div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${bodyRows}</tbody>
    ${footHtml}
  </table>
</body>
</html>`;

  const filename = `inventory-${session.date}.pdf`;
  return printHtmlOrSharePdf({
    html,
    filename,
    dialogTitle: labels.export,
    nativePrint: () => Print.printToFileAsync({ html }),
  });
}
