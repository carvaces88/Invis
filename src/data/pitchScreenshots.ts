import * as FileSystem from 'expo-file-system/legacy';
import { Image, Platform, type ImageSourcePropType } from 'react-native';

/**
 * Live product screenshots for the investor pitch deck (on-screen + PDF/PPTX).
 * Captured from production Invis UI.
 */
export type PitchFeatureShot = {
  id: string;
  title: string;
  caption: string;
  /** Metro bundler asset module */
  source: ImageSourcePropType;
};

export const pitchFeatureShots: PitchFeatureShot[] = [
  {
    id: 'home',
    title: 'Home · start counting',
    caption: 'Scan fridge / photos, import a prior list, or start from catalog.',
    source: require('../../assets/pitch/pitch-home.png'),
  },
  {
    id: 'mini-invis',
    title: 'Mini Invis · fast count',
    caption:
      'Category lists, swipe ±1, stock totals at 0% ALV, fire/speed mode.',
    source: require('../../assets/pitch/pitch-mini-invis.png'),
  },
  {
    id: 'inventory',
    title: 'Inventory · sheet & export',
    caption: 'Recorded stock, 0% ALV toggle, Excel / PDF / Word, Restolution path.',
    source: require('../../assets/pitch/pitch-inventory.png'),
  },
  {
    id: 'catalog',
    title: 'Catalog · Nordic match',
    caption: 'Searchable kitchen catalog with K-Ruoka / S-kaupat / Lidl price columns.',
    source: require('../../assets/pitch/pitch-catalog.png'),
  },
  {
    id: 'more',
    title: 'More · Mini Invis entry',
    caption: 'Ops tools in one place — Mini Invis highlighted for mid-service counts.',
    source: require('../../assets/pitch/pitch-more-mini.png'),
  },
];

export const pitchScreensHeadline = 'Product in the kitchen';
export const pitchScreensBody =
  'Real screens from INVIS: photo-first counting, Mini Invis mid-service speed, inventaario export, and Nordic catalog pricing.';

async function uriToDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;

  if (uri.startsWith('file:') || (Platform.OS !== 'web' && !uri.startsWith('http'))) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/png;base64,${base64}`;
    } catch {
      /* fall through to fetch */
    }
  }

  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read screenshot'));
    reader.readAsDataURL(blob);
  });
}

async function moduleToDataUri(source: ImageSourcePropType): Promise<string> {
  if (typeof source !== 'number') {
    throw new Error('Pitch screenshots must be Metro require() modules');
  }
  const resolved = Image.resolveAssetSource(source);
  const uri = resolved?.uri;
  if (!uri) throw new Error('Pitch screenshot asset missing');
  return uriToDataUri(uri);
}

/** Resolve all pitch screenshots to data URIs for PDF / PPTX embedding. */
export async function loadPitchScreenshotDataUris(): Promise<
  { id: string; title: string; caption: string; dataUri: string }[]
> {
  const out: { id: string; title: string; caption: string; dataUri: string }[] =
    [];
  for (const shot of pitchFeatureShots) {
    try {
      const dataUri = await moduleToDataUri(shot.source);
      if (dataUri.startsWith('data:')) {
        out.push({
          id: shot.id,
          title: shot.title,
          caption: shot.caption,
          dataUri,
        });
      }
    } catch {
      /* skip broken asset — deck still exports without that frame */
    }
  }
  return out;
}
