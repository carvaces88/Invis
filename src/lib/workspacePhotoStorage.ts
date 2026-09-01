import { isSupabaseConfigured, supabase } from './supabase';
import { normalizeWorkspaceKey } from './workspaceSnapshot';

const BUCKET = 'inventory-photos';

function isCloudPhotoUri(uri: string): boolean {
  return (
    uri.startsWith('https://') &&
    (uri.includes('supabase.co') || uri.includes('/storage/v1/object/public/'))
  );
}

async function uriToBytes(uri: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const buf = await res.arrayBuffer();
  const mime =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    (uri.startsWith('data:')
      ? uri.slice(5, uri.indexOf(';')).trim()
      : 'image/jpeg');
  return { bytes: new Uint8Array(buf), mime: mime || 'image/jpeg' };
}

function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

/** Upload a local/device photo URI to Supabase Storage; return HTTPS URL. */
export async function ensurePhotoCloudUri(
  uri: string,
  email: string,
  photoId: string,
): Promise<string> {
  if (!isSupabaseConfigured || !uri.trim()) return uri;
  if (isCloudPhotoUri(uri)) return uri;

  const workspaceKey = normalizeWorkspaceKey(email);
  const { bytes, mime } = await uriToBytes(uri);
  const ext = extForMime(mime);
  const path = `${workspaceKey}/${photoId}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInventoryPhotosForSync(
  photos: { id: string; uri: string }[],
  email: string,
): Promise<Map<string, string>> {
  const uploaded = new Map<string, string>();
  if (!isSupabaseConfigured || !email.trim()) return uploaded;

  await Promise.all(
    photos.map(async (photo) => {
      if (isCloudPhotoUri(photo.uri)) {
        uploaded.set(photo.id, photo.uri);
        return;
      }
      try {
        const cloudUri = await ensurePhotoCloudUri(photo.uri, email, photo.id);
        uploaded.set(photo.id, cloudUri);
      } catch {
        /* keep device URI in payload if upload fails */
      }
    }),
  );

  return uploaded;
}
