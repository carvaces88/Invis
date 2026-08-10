/**
 * Catalog photo background cleanup — isolate product on white for ProductThumb.
 * Prefers /api/remove-bg (Gemini image model); falls back to direct Gemini when
 * EXPO_PUBLIC_GEMINI_API_KEY is set. On failure, returns the original URI.
 */
import { EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  imageUriToPayload,
  isRealImageUri,
  type ImagePayload,
} from './geminiVision';
import {
  getGeminiApiKey,
  getGeminiImageModel,
  getRemoveBgProxyUrl,
  isRemoveBgEnabled,
} from './visionConfig';

const REMOVE_BG_TIMEOUT_MS = 45_000;
const MAX_PERSIST_EDGE_PX = 768;

const PROMPT = `Isolate the main product pack on a solid pure white (#FFFFFF) background.
Keep the product label and shape exactly as photographed. Remove shelves, other products, clutter, and backdrop shadows.
Center the product with a small white margin. Do not invent a different product.`;

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

/** Remote CDN / K-Ruoka packshots are already clean — skip processing. */
export function shouldCleanCatalogPhoto(uri: string | null | undefined): boolean {
  if (!uri || !isRealImageUri(uri)) return false;
  const u = uri.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return false;
  // Already a persisted cleaned catalog thumb
  if (u.includes('catalog-thumb-')) return false;
  return true;
}

function extractInlineImage(
  body: GeminiImageResponse,
): ImagePayload | null {
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const camel = part.inlineData;
    const snake = part.inline_data;
    const data = String(camel?.data ?? snake?.data ?? '').replace(/\s/g, '');
    if (data.length < 100) continue;
    const mimeType = String(
      camel?.mimeType ?? snake?.mime_type ?? 'image/jpeg',
    );
    return {
      mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
      base64: data,
    };
  }
  return null;
}

async function maybeDownscaleForPersist(
  mimeType: string,
  base64: string,
): Promise<ImagePayload> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { mimeType, base64 };
  }
  try {
    const src = `data:${mimeType};base64,${base64}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Catalog image decode failed'));
      el.src = src;
    });
    const scale = Math.min(
      1,
      MAX_PERSIST_EDGE_PX / Math.max(img.width, img.height),
    );
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { mimeType, base64 };
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', 0.85);
    const match = /^data:([^;]+);base64,(.+)$/.exec(out);
    if (!match) return { mimeType, base64 };
    return { mimeType: match[1], base64: match[2] };
  } catch {
    return { mimeType, base64 };
  }
}

async function persistCatalogImage(payload: ImagePayload): Promise<string> {
  const scaled = await maybeDownscaleForPersist(
    payload.mimeType,
    payload.base64,
  );
  const ext = scaled.mimeType.includes('png') ? 'png' : 'jpg';
  const filename = `catalog-thumb-${Date.now()}.${ext}`;

  if (Platform.OS === 'web') {
    return `data:${scaled.mimeType};base64,${scaled.base64}`;
  }

  // Dynamic import keeps web bundles from assuming native dirs always exist.
  const FileSystem = await import('expo-file-system/legacy');
  const directory =
    FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!directory) {
    return `data:${scaled.mimeType};base64,${scaled.base64}`;
  }
  const uri = `${directory}${filename}`;
  await writeAsStringAsync(uri, scaled.base64, {
    encoding: EncodingType.Base64,
  });
  return uri;
}

async function callRemoveBgProxy(
  payload: ImagePayload,
  proxyUrl: string,
  signal: AbortSignal,
): Promise<ImagePayload> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      image: { mimeType: payload.mimeType, base64: payload.base64 },
      model: getGeminiImageModel(),
    }),
    signal,
  });
  const body = (await res.json()) as ImagePayload & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Remove-bg proxy failed (${res.status})`);
  }
  if (!body.base64 || body.base64.length < 100) {
    throw new Error('Remove-bg proxy returned an empty image');
  }
  return {
    mimeType: body.mimeType || 'image/jpeg',
    base64: String(body.base64).replace(/\s/g, ''),
  };
}

async function callGeminiImageDirect(
  payload: ImagePayload,
  apiKey: string,
  signal: AbortSignal,
): Promise<ImagePayload> {
  const model = getGeminiImageModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: payload.mimeType, data: payload.base64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.2,
      },
    }),
    signal,
  });
  const body = (await res.json()) as GeminiImageResponse;
  if (!res.ok) {
    throw new Error(
      body.error?.message || `Gemini image edit failed (${res.status})`,
    );
  }
  const out = extractInlineImage(body);
  if (!out) {
    throw new Error('Gemini returned no cleaned image');
  }
  return out;
}

/**
 * Clean a local shelf/pack photo for catalog storage.
 * Returns a persisted URI (file:// or data:) on success, or the original URI
 * when cleanup is disabled / times out / fails.
 */
export async function removeCatalogPhotoBackground(
  uri: string,
): Promise<string> {
  if (!shouldCleanCatalogPhoto(uri) || !isRemoveBgEnabled()) {
    return uri;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOVE_BG_TIMEOUT_MS);

  try {
    const payload = await imageUriToPayload(uri);
    let cleaned: ImagePayload | null = null;

    const proxyUrl = getRemoveBgProxyUrl();
    if (proxyUrl) {
      try {
        cleaned = await callRemoveBgProxy(payload, proxyUrl, controller.signal);
      } catch (err) {
        // Fall through to direct key when proxy is missing/unreachable.
        if (!getGeminiApiKey()) throw err;
      }
    }

    if (!cleaned) {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        throw new Error('Remove-bg is not configured');
      }
      cleaned = await callGeminiImageDirect(
        payload,
        apiKey,
        controller.signal,
      );
    }

    return await persistCatalogImage(cleaned);
  } catch {
    // Never block catalog save on cleanup failure.
    return uri;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the image to store on a new product: prefer remote packshot when
 * present; otherwise clean the first local photo for a white-bg catalog thumb.
 */
export async function resolveCatalogImageUrl(options: {
  imageUrl?: string;
  photoUris?: string[];
}): Promise<string | undefined> {
  const remote = options.imageUrl?.trim();
  if (remote && (remote.startsWith('http://') || remote.startsWith('https://'))) {
    return remote;
  }

  const local =
    (remote && shouldCleanCatalogPhoto(remote) ? remote : undefined) ||
    options.photoUris?.find((u) => shouldCleanCatalogPhoto(u)) ||
    remote ||
    options.photoUris?.[0];

  if (!local) return undefined;
  if (!shouldCleanCatalogPhoto(local)) return local;
  return removeCatalogPhotoBackground(local);
}
