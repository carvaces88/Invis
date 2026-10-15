import AsyncStorage from '@react-native-async-storage/async-storage';
import { pitchAsk, pitchMeta, pitchProblem, pitchProduct, pitchVision } from '../data/pitchDeck';
import { pitchWho } from '../data/pitchScreenshots';

const DRAFT_KEY = '@invis/pitch-deck-draft-v1';
const UNLOCK_KEY = '@invis/pitch-deck-edit-unlocked-v1';

/** Soft gate — keyword only, as requested for phone edit. */
export function pitchEditKeywordOk(raw: string): boolean {
  const k = raw.trim().toLowerCase();
  return k === 'cesar' || k === 'admin';
}

export type PitchTeamDraft = {
  name: string;
  role: string;
  body: string;
};

export type PitchFundDraft = {
  label: string;
  pct: number;
  eur: number;
  body: string;
};

/** Editable investor-facing copy (device-local overrides). */
export type PitchDeckDraft = {
  tagline: string;
  audience: string;
  whoBody: string;
  whatWeDo: string;
  niche: string;
  team: PitchTeamDraft[];
  problemBody: string;
  solutionBody: string;
  visionBody: string;
  productBody: string;
  askHeadline: string;
  askAmountLabel: string;
  askBody: string;
  founderQuote: string;
  founderRole: string;
  useOfFunds: PitchFundDraft[];
  askBullets: string[];
};

export function defaultPitchDraft(): PitchDeckDraft {
  return {
    tagline: pitchMeta.tagline,
    audience: pitchMeta.audience,
    whoBody: pitchWho.body,
    whatWeDo: pitchWho.whatWeDo,
    niche: pitchWho.niche,
    team: pitchWho.team.map((m) => ({ ...m })),
    problemBody: pitchProblem.body,
    solutionBody: pitchProblem.solutionBody,
    visionBody: pitchVision.body,
    productBody: pitchProduct.body,
    askHeadline: pitchAsk.headline,
    askAmountLabel: pitchAsk.amountLabel,
    askBody: pitchAsk.body,
    founderQuote: pitchAsk.founderQuote,
    founderRole: pitchAsk.founderRole,
    useOfFunds: pitchAsk.useOfFunds.map((r) => ({ ...r })),
    askBullets: [...pitchAsk.bullets],
  };
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Merge stored partial with current defaults (new fields pick up code defaults). */
export function mergePitchDraft(stored: unknown): PitchDeckDraft {
  const base = defaultPitchDraft();
  if (!stored || typeof stored !== 'object') return base;
  const s = stored as Partial<PitchDeckDraft>;

  const team =
    Array.isArray(s.team) && s.team.length
      ? s.team.map((m, i) => ({
          name: asString(m?.name, base.team[i]?.name ?? ''),
          role: asString(m?.role, base.team[i]?.role ?? ''),
          body: asString(m?.body, base.team[i]?.body ?? ''),
        }))
      : base.team;

  const useOfFunds =
    Array.isArray(s.useOfFunds) && s.useOfFunds.length
      ? s.useOfFunds.map((r, i) => ({
          label: asString(r?.label, base.useOfFunds[i]?.label ?? ''),
          pct: asNumber(r?.pct, base.useOfFunds[i]?.pct ?? 0),
          eur: asNumber(r?.eur, base.useOfFunds[i]?.eur ?? 0),
          body: asString(r?.body, base.useOfFunds[i]?.body ?? ''),
        }))
      : base.useOfFunds;

  const askBullets =
    Array.isArray(s.askBullets) && s.askBullets.length
      ? s.askBullets.map((b, i) => asString(b, base.askBullets[i] ?? ''))
      : base.askBullets;

  return {
    tagline: asString(s.tagline, base.tagline),
    audience: asString(s.audience, base.audience),
    whoBody: asString(s.whoBody, base.whoBody),
    whatWeDo: asString(s.whatWeDo, base.whatWeDo),
    niche: asString(s.niche, base.niche),
    team,
    problemBody: asString(s.problemBody, base.problemBody),
    solutionBody: asString(s.solutionBody, base.solutionBody),
    visionBody: asString(s.visionBody, base.visionBody),
    productBody: asString(s.productBody, base.productBody),
    askHeadline: asString(s.askHeadline, base.askHeadline),
    askAmountLabel: asString(s.askAmountLabel, base.askAmountLabel),
    askBody: asString(s.askBody, base.askBody),
    founderQuote: asString(s.founderQuote, base.founderQuote),
    founderRole: asString(s.founderRole, base.founderRole),
    useOfFunds,
    askBullets,
  };
}

export async function loadPitchDraft(): Promise<PitchDeckDraft> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultPitchDraft();
    return mergePitchDraft(JSON.parse(raw) as unknown);
  } catch {
    return defaultPitchDraft();
  }
}

export async function savePitchDraft(draft: PitchDeckDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function clearPitchDraft(): Promise<PitchDeckDraft> {
  await AsyncStorage.removeItem(DRAFT_KEY);
  return defaultPitchDraft();
}

export async function loadPitchEditUnlocked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(UNLOCK_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setPitchEditUnlocked(on: boolean): Promise<void> {
  if (on) await AsyncStorage.setItem(UNLOCK_KEY, '1');
  else await AsyncStorage.removeItem(UNLOCK_KEY);
}

/** Resolved view models for screen + PDF/PPTX from a draft. */
export function resolvePitchFromDraft(draft: PitchDeckDraft) {
  return {
    meta: {
      ...pitchMeta,
      tagline: draft.tagline,
      audience: draft.audience,
    },
    who: {
      ...pitchWho,
      body: draft.whoBody,
      whatWeDo: draft.whatWeDo,
      niche: draft.niche,
      team: draft.team,
    },
    problem: {
      ...pitchProblem,
      body: draft.problemBody,
      solutionBody: draft.solutionBody,
    },
    vision: {
      ...pitchVision,
      body: draft.visionBody,
    },
    product: {
      ...pitchProduct,
      body: draft.productBody,
    },
    ask: {
      ...pitchAsk,
      headline: draft.askHeadline,
      amountLabel: draft.askAmountLabel,
      body: draft.askBody,
      founderQuote: draft.founderQuote,
      founderRole: draft.founderRole,
      useOfFunds: draft.useOfFunds,
      bullets: draft.askBullets,
    },
  };
}
