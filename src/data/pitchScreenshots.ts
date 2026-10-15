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
    id: 'main',
    tab: 'Main Invis',
    title: 'Main Invis · full inventaario',
    caption:
      'The full kitchen sheet: photo & voice entry, storages, 0% ALV values, filters, and Restolution-ready export — inventaario without the desk detour.',
    beat: 'Full inventaario on the phone',
    source: require('../../assets/pitch/pitch-voice.png'),
  },
  {
    id: 'photo',
    tab: 'Photo',
    title: 'Photo → inventaario',
    caption:
      'Scan fridge / take photos from Home — many items → confirm → stock. One step instead of clipboard → category hunt → computer.',
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
    id: 'find',
    tab: 'Find',
    title: 'Find products · fast',
    caption:
      'Search the kitchen catalog by name or EAN — K-Ruoka / S-kaupat / Lidl columns, pack size, 0% ALV. No hunting the right category on paper.',
    beat: 'Right product in seconds',
    source: require('../../assets/pitch/pitch-catalog.png'),
  },
  {
    id: 'reports',
    tab: 'Reports',
    title: 'Owner-ready reports',
    caption:
      'Ask reports chat or tap “My inventory value right now” — stock € at a glance, low stock, value by category. Owner-ready without spreadsheets.',
    beat: 'Inventory value on one tap',
    source: require('../../assets/pitch/pitch-reports.png'),
  },
  {
    id: 'value',
    tab: 'Value €',
    title: 'Inventory value · one click',
    caption:
      'Current inventory value in one tap — excl. VAT / 0% ALV, with ALV toggle, breakdown by place. Managers see the number instantly.',
    beat: '€5.6k demo · by fridge at a glance',
    source: require('../../assets/pitch/pitch-inventory-value.png'),
  },
  {
    id: 'kuorma',
    tab: 'Kuorma',
    title: 'Kuormakirja · delivery in 1 photo',
    caption:
      'Photograph the supplier delivery paper (kuormalista / kuormakirja) → extract lines → match catalog → confirm adds stock.',
    beat: 'Delivery receipt → inventory',
    source: require('../../assets/pitch/pitch-kuorma.png'),
  },
  {
    id: 'waste',
    tab: 'Hävikki',
    title: 'Log food waste',
    caption:
      'Photograph the station waste list → match catalog → confirm subtracts stock and logs hävikki. Waste tracking without a second spreadsheet.',
    beat: 'Waste list photo → logged hävikki',
    source: require('../../assets/pitch/pitch-waste.png'),
  },
  {
    id: 'places',
    tab: 'Places',
    title: 'Venues · fridges · walk-ins',
    caption:
      'One company can run several restaurants/sites; each site has Dry storage, Freezer, Prep fridge, Drawers… Counts always belong to one place.',
    beat: 'Multi-venue groups · multi-fridge sites',
    source: require('../../assets/pitch/pitch-places.png'),
  },
  {
    id: 'mini',
    tab: 'Mini Invis',
    title: 'Mini Invis · Simple Invis',
    caption:
      'The fast twin of Main Invis: category lists, swipe ±1, stock € at 0% ALV — built for mid-service, not desk ERP.',
    beat: 'Simple count when service is on',
    source: require('../../assets/pitch/pitch-mini-invis.png'),
  },
  {
    id: 'fire',
    tab: 'Fire mode',
    title: 'Fire mode (inside Mini Invis)',
    caption:
      'Inside Mini / Simple Invis: focus one item, keypad qty, swipe next/prev. Stay in the flow mid-service.',
    beat: 'One item · set qty · next',
    source: require('../../assets/pitch/pitch-fire.png'),
  },
];

export const pitchScreensHeadline = 'Product in the kitchen';
export const pitchScreensBody =
  'Tap a feature — inventaario, find, reports & value, kuormakirja, hävikki, places, Mini Invis & fire. Real screens from the investor demo.';

/** Who we are / what we do (Chameleo-style narrative opener) */
export const pitchWho = {
  headline: 'Who we are',
  body: 'Countro builds INVIS — kitchen inventaario that replaces the clipboard → category hunt → computer chore with one fast step on the phone: photo, voice, swipe, and owner-ready reports.',
  whatWeDoTitle: 'What we do',
  whatWeDo:
    'Help full-service kitchens count stock across venues and fridges, see inventory value on one tap, log kuormakirja deliveries and hävikki from a photo, find products fast, keep prices at 0% ALV, and export Restolution-ready sheets — without enterprise ERP bloat.',
  nicheTitle: 'Our niche',
  niche:
    'Finnish (then Nordic) full-service restaurant kitchens and multi-concept groups — head chefs and kitchen managers who still close inventaario on paper or clunky desktop tools.',
  teamTitle: 'The team · Countro',
  team: [
    {
      name: 'Cesar Carvajal',
      role: 'Food division · marketing',
      body: 'Former professional chef — owns the kitchen inventaario product narrative and go-to-market.',
    },
    {
      name: 'Ivan',
      role: 'Beverages division · development',
      body: 'Leads product development and the beverages side of Countro — shipping the app kitchens actually use.',
    },
  ],
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
