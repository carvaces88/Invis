import type {
  InventorySession,
  Product,
  Recipe,
  StockMovement,
} from '../../data/types';
import { en, type Messages } from '../../i18n/en';
import { shareOrDownloadBase64 } from './download';
import {
  buildExportRows,
  DEFAULT_EXPORT_PROFILE,
  getExportProfile,
  type ExportProfileId,
} from './profiles';

export type ExportDataContext = {
  movements?: StockMovement[];
  products?: Product[];
  recipes?: Recipe[];
};

export async function exportSessionExcel(
  session: InventorySession,
  labels: Messages = en,
  profileId: ExportProfileId = DEFAULT_EXPORT_PROFILE,
  dataCtx: ExportDataContext = {},
) {
  const XLSX = await import('xlsx');
  const profile = getExportProfile(profileId);
  const data = buildExportRows(session, profile, labels, dataCtx);
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, labels.inventory);
  const wbout = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  const filename = `inventory-${session.date}.xlsx`;
  return shareOrDownloadBase64({
    base64: wbout,
    filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uti: 'com.microsoft.excel.xlsx',
    dialogTitle: labels.export,
  });
}
