import * as FileSystem from 'expo-file-system/legacy';
import { Image, Platform, type ImageSourcePropType } from 'react-native';

/**
 * Live product screenshots for the investor pitch deck (on-screen + PDF/PPTX).
 * Interactive showcase highlights kitchen-speed features — not a generic gallery.
 */
export type PitchFeatureShot = {
  id: string;
  /** Short tab label */
  tab: string;
  title: string;
  caption: string;
  /** One-line “what chefs get” */
  beat: string;
  /** Metro bundler asset module */
  source: ImageSourcePropType;
};

export const pitchFeatureShots: PitchFeatureShot[] = [
  {
    id: 'photo',
    tab: 'Photo',
    title: 'Photo → inventaario',
    caption:
      'Scan fridge / take photos from Home — many items → confirm → verify → Restolution. Pack labels and shelves both work.',
    beat: 'Fridge & pack photos become counted stock',
    source: require('../../assets/pitch/pitch-photo.png'),
  },
  {
    id: 'voice',
    tab: 'Voice',
    title: 'Voice walk-through',
    caption:
      'Mic on the inventaario sheet: dictate while walking the walk-in — transcript → review lines → confirm (beta).',
    beat: 'Mic in, stock lines out',
    source: require('../../assets/pitch/pitch-voice.png'),
  },
  {
    id: 'places',
    tab: 'Places',
    title: 'Multi-location · multi-fridge',
    caption:
      'Site + named places: Dry storage, Freezer, Prep fridge, Drawers… Counts always belong to one place.',
    beat: 'Every fridge / site has its own sheet',
    source: require('../../assets/pitch/pitch-places.png'),
  },
  {
    id: 'mini',
    tab: 'Mini Invis',
    title: 'Mini Invis · mid-service count',
    caption:
      'Category lists, search, swipe ±1, stock € at 0% ALV. Built for speed between tickets — not desk ERP.',
    beat: 'Open mid-service, finish the count',
    source: require('../../assets/pitch/pitch-mini-invis.png'),
  },
  {
    id: 'fire',
    tab: 'Fire mode',
    title: 'Fire mode · focused counting',
    caption:
      'One item at a time with keypad + swipe next/prev. Stay in the flow mid-service — no scrolling a clipboard.',
    beat: 'One item · set qty · next',
    source: require('../../assets/pitch/pitch-fire.png'),
  },
  {
    id: 'catalog',
    tab: 'Catalog',
    title: 'Nordic catalog match',
    caption:
      'Searchable kitchen catalog with K-Ruoka / S-kaupat / Lidl price columns — EAN, pack size, 0% ALV.',
    beat: 'Distributor prices without retyping',
    source: require('../../assets/pitch/pitch-catalog.png'),
  },
];

export const pitchScreensHeadline = 'Product in the kitchen';
export const pitchScreensBody =
  'Tap a feature — real INVIS screens: photo counting, voice walk-through, multi-fridge places, Mini Invis, and fire-mode speed.';

/** Who we are / what we do (Chameleo-style narrative opener) */
export const pitchWho = {
  headline: 'Who we are',
  body: 'INVIS (by Countro) is a kitchen inventaario app built by a former professional chef. We replace clipboard stock counts with photo, voice, and swipe-speed tools chefs actually open mid-service.',
  whatWeDoTitle: 'What we do',
  whatWeDo:
    'Help full-service kitchens count stock accurately across fridges and sites, keep prices at 0% ALV, cut hävikki admin, and export Restolution-ready sheets — without enterprise ERP bloat.',
  nicheTitle: 'Our niche',
  niche:
    'Finnish (then Nordic) full-service restaurant kitchens — head chefs and kitchen managers who still close inventaario on paper or clunky desktop tools.',
};

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
