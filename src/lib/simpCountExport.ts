import * as Print from 'expo-print';
import type { SimplifiedCountItem } from '../data/simplifiedCountingSeed';
import { lineTotal } from '../data/simplifiedCountingSeed';
import { printHtmlOrSharePdf } from './export/download';
import { shareOrDownloadBase64 } from './export/download';

export type SimpExportScope = 'category' | 'all' | 'blank';
export type SimpExportFormat = 'pdf' | 'excel';

export type SimpExportRow = {
  product: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
};

export function buildSimpExportRows(
  items: SimplifiedCountItem[],
  opts: { blank: boolean; nameOf: (item: SimplifiedCountItem) => string },
): SimpExportRow[] {
  return items.map((item) => {
    if (opts.blank) {
      return {
        product: opts.nameOf(item),
        quantity: '',
        unit: item.unit,
        unitPrice: '',
        lineTotal: '',
      };
    }
    const qty = item.quantity;
    const total = lineTotal(item);
    return {
      product: opts.nameOf(item),
      quantity: qty === 0 ? '' : String(qty),
      unit: item.unit,
      unitPrice: item.unitPriceAlv0.toFixed(2),
      lineTotal: qty > 0 ? total.toFixed(2) : '',
    };
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSimpCountExportHtml(opts: {
  title: string;
  subtitle: string;
  headers: {
    product: string;
    qty: string;
    unit: string;
    unitPrice: string;
    lineTotal: string;
  };
  rows: SimpExportRow[];
}): string {
  const body = opts.rows
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.product)}</td>
      <td style="text-align:right">${escapeHtml(r.quantity)}</td>
      <td>${escapeHtml(r.unit)}</td>
      <td style="text-align:right">${escapeHtml(r.unitPrice)}</td>
      <td style="text-align:right">${escapeHtml(r.lineTotal)}</td>
    </tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(opts.title)}</title>
<style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0B1F33;padding:24px}
  h1{font-size:18px;margin:0 0 4px} p{margin:0 0 16px;color:#5A6B7D;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border-bottom:1px solid #E4EBF2;padding:6px 4px;text-align:left}
  th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#5A6B7D}
</style></head><body>
<h1>${escapeHtml(opts.title)}</h1>
<p>${escapeHtml(opts.subtitle)}</p>
<table>
<thead><tr>
  <th>${escapeHtml(opts.headers.product)}</th>
  <th style="text-align:right">${escapeHtml(opts.headers.qty)}</th>
  <th>${escapeHtml(opts.headers.unit)}</th>
  <th style="text-align:right">${escapeHtml(opts.headers.unitPrice)}</th>
  <th style="text-align:right">${escapeHtml(opts.headers.lineTotal)}</th>
</tr></thead>
<tbody>${body || `<tr><td colspan="5">—</td></tr>`}</tbody>
</table>
</body></html>`;
}

export async function exportSimpCountPdf(opts: {
  html: string;
  filename: string;
}): Promise<void> {
  await printHtmlOrSharePdf({
    html: opts.html,
    filename: opts.filename,
    nativePrint: () => Print.printToFileAsync({ html: opts.html }),
  });
}

export async function exportSimpCountExcel(opts: {
  rows: SimpExportRow[];
  sheetName: string;
  filename: string;
  headers: {
    product: string;
    qty: string;
    unit: string;
    unitPrice: string;
    lineTotal: string;
  };
  dialogTitle?: string;
}): Promise<void> {
  const XLSX = await import('xlsx');
  const data = opts.rows.map((r) => ({
    [opts.headers.product]: r.product,
    [opts.headers.qty]: r.quantity,
    [opts.headers.unit]: r.unit,
    [opts.headers.unitPrice]: r.unitPrice,
    [opts.headers.lineTotal]: r.lineTotal,
  }));
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, opts.sheetName.slice(0, 31));
  const wbout = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  await shareOrDownloadBase64({
    base64: wbout,
    filename: opts.filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'com.microsoft.excel.xlsx',
    dialogTitle: opts.dialogTitle,
  });
}
