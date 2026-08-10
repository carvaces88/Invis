import type {
  InventoryPeriodSnapshot,
  InventorySession,
  Product,
  Recipe,
  StockMovement,
} from '../../data/types';
import { en, type Messages } from '../../i18n/en';
import { shareOrDownloadBase64 } from './download';
import {
  cellDisplay,
  columnHeader,
  DEFAULT_EXPORT_PROFILE,
  getExportProfile,
  totalsFooterCells,
  type ExportCellContext,
  type ExportProfileId,
} from './profiles';

export type ExportDataContext = {
  movements?: StockMovement[];
  products?: Product[];
  recipes?: Recipe[];
  periodSnapshot?: InventoryPeriodSnapshot | null;
};

/**
 * DOCX export via `docx`. If the runtime cannot pack the binary,
 * callers should fall back to Excel + PDF (still first-class).
 */
export async function exportSessionDocx(
  session: InventorySession,
  labels: Messages = en,
  profileId: ExportProfileId = DEFAULT_EXPORT_PROFILE,
  dataCtx: ExportDataContext = {},
) {
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx');

  const profile = getExportProfile(profileId);
  const ctx: ExportCellContext = { session, ...dataCtx };
  const fiHeaders = Boolean(profile.finnishExportHeaders);

  const cell = (text: string, bold = false) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold })],
        }),
      ],
    });

  const headerRow = new TableRow({
    children: profile.columns.map((col) =>
      cell(
        columnHeader(col, labels, { finnishRestolution: fiHeaders }),
        true,
      ),
    ),
  });

  const dataRows = session.lines.map(
    (line) =>
      new TableRow({
        children: profile.columns.map((col) =>
          cell(cellDisplay(col, line, ctx)),
        ),
      }),
  );

  const footer = totalsFooterCells(session, profile, labels);
  const footerRow = footer
    ? [
        new TableRow({
          children: footer.map((text) => cell(text, true)),
        }),
      ]
    : [];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: session.title, bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun(`${labels.date}: ${session.date}`)],
          }),
          new Paragraph({ children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows, ...footerRow],
          }),
        ],
      },
    ],
  });

  const base64 = await Packer.toBase64String(doc);
  const filename = `inventory-${session.date}.docx`;
  return shareOrDownloadBase64({
    base64,
    filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uti: 'org.openxmlformats.wordprocessingml.document',
    dialogTitle: labels.export,
  });
}
