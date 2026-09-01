import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Trigger a browser file download via object URL (web only). */
export function downloadBlob(blob: Blob, filename: string): string {
  if (typeof document === 'undefined') {
    throw new Error('Browser download is unavailable');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
  return url;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Web: download bytes as a file.
 * Native: write to cache and open the share sheet when available.
 */
export async function shareOrDownloadBase64(options: {
  base64: string;
  filename: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}): Promise<string> {
  const { base64, filename, mimeType, uti, dialogTitle } = options;

  if (Platform.OS === 'web') {
    const bytes = base64ToUint8Array(base64);
    // Copy into a plain ArrayBuffer so BlobPart typing accepts it.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: mimeType });
    return downloadBlob(blob, filename);
  }

  const directory = FileSystem.cacheDirectory;
  if (!directory) {
    throw new Error('File cache is unavailable');
  }
  const uri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      UTI: uti,
      dialogTitle,
    });
  }
  return uri;
}

/**
 * expo-print's printToFileAsync on web only calls window.print() on the
 * current document (ignoring html). Open the export HTML in a dedicated
 * window/tab and print that — mobile Safari often prints the parent page
 * when printing from a 0×0 iframe, which clips the Restolution sheet.
 */
export async function printHtmlOrSharePdf(options: {
  html: string;
  filename: string;
  dialogTitle?: string;
  /** Native path: URI from Print.printToFileAsync */
  nativePrint: () => Promise<{ uri: string }>;
}): Promise<string> {
  if (Platform.OS === 'web') {
    return printHtmlInBrowser(options.html, options.filename);
  }

  const { uri } = await options.nativePrint();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: options.dialogTitle,
    });
  }
  return uri;
}

function printHtmlInBrowser(html: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      reject(new Error('Browser print is unavailable'));
      return;
    }

    // Prefer a real window: iframe print on iOS Safari reprints the app UI.
    const printWindow = window.open('', '_blank');
    if (printWindow?.document) {
      try {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        const run = () => {
          try {
            printWindow.focus();
            printWindow.print();
            resolve(filename);
          } catch (e) {
            reject(e instanceof Error ? e : new Error('Print failed'));
          }
        };
        setTimeout(run, 300);
        return;
      } catch {
        try {
          printWindow.close();
        } catch {
          // ignore
        }
      }
    }

    // Fallback when popups are blocked: full-viewport offscreen iframe.
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', filename);
    iframe.setAttribute(
      'style',
      'position:fixed;inset:0;width:100vw;height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;',
    );
    document.body.appendChild(iframe);

    const cleanup = () => {
      iframe.remove();
    };

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      cleanup();
      reject(new Error('Could not open print frame'));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        win.focus();
        win.print();
        resolve(filename);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Print failed'));
      } finally {
        setTimeout(cleanup, 1_000);
      }
    }, 300);
  });
}
