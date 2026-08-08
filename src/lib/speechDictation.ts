/**
 * Speech-to-text for fridge walk-through dictation.
 *
 * Prefer Web Speech API on web (live partials, no extra cost).
 * Fallback: MediaRecorder → Gemini /api/transcribe (same key as vision).
 */
import { Platform } from 'react-native';
import {
  getGeminiApiKey,
  getGeminiModel,
  getVisionProxyUrl,
} from './visionConfig';

export type DictationLanguage = 'en' | 'fi';

export type DictationSession = {
  stop: () => Promise<string>;
  /** True while listening / recording */
  active: boolean;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isWebSpeechAvailable(): boolean {
  return Platform.OS === 'web' && getSpeechRecognitionCtor() != null;
}

export function isMediaRecorderAvailable(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** Same-origin or absolute URL for the serverless transcribe proxy. */
export function getTranscribeProxyUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_TRANSCRIBE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vision = getVisionProxyUrl();
  if (vision) return vision.replace(/\/api\/vision\/?$/, '/api/transcribe');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/transcribe`;
  }
  return undefined;
}

export function isGeminiTranscribeEnabled(): boolean {
  return Boolean(getGeminiApiKey() || getTranscribeProxyUrl());
}

export function isDictationAvailable(): boolean {
  return isWebSpeechAvailable() || isMediaRecorderAvailable();
}

function speechLang(language: DictationLanguage): string {
  return language === 'fi' ? 'fi-FI' : 'en-US';
}

/**
 * Collapse consecutive repeated phrases from buggy STT streams
 * e.g. "two vegan two vegan mayo two vegan mayo" → "two vegan mayo"
 */
export function collapseRepeatedSpeech(text: string): string {
  let out = text.replace(/\s+/g, ' ').trim();
  if (!out) return '';

  // Drop immediate duplicate words: "mayo mayo" → "mayo"
  out = out.replace(/\b([\p{L}\p{N}']+)(?:\s+\1\b)+/giu, '$1');

  // Drop consecutive duplicate n-grams (2–6 words), repeatedly
  for (let n = 6; n >= 2; n--) {
    const re = new RegExp(
      `\\b((?:[\\p{L}\\p{N}']+\\s+){${n - 1}}[\\p{L}\\p{N}']+)(?:\\s+\\1\\b)+`,
      'giu',
    );
    let prev = '';
    while (prev !== out) {
      prev = out;
      out = out.replace(re, '$1');
    }
  }

  return out.replace(/\s+/g, ' ').trim();
}

function joinSpeechParts(finalText: string, interimText: string): string {
  return collapseRepeatedSpeech(
    [finalText, interimText].filter(Boolean).join(' '),
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 encode unavailable');
}

async function transcribeWithGemini(
  mimeType: string,
  base64: string,
  language: DictationLanguage,
): Promise<string> {
  const proxy = getTranscribeProxyUrl();
  const clientKey = getGeminiApiKey();
  const model = getGeminiModel();

  if (proxy) {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: { mimeType, base64 },
        language,
        model,
      }),
    });
    const json = (await res.json()) as { transcript?: string; error?: string };
    if (!res.ok) {
      throw new Error(json.error || `Transcribe failed (${res.status})`);
    }
    return (json.transcript || '').trim();
  }

  if (!clientKey) {
    throw new Error('Transcription not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(clientKey)}`;
  const langHint =
    language === 'fi'
      ? 'The speaker is usually Finnish (kitchen/restaurant). Prefer Finnish product names when unclear.'
      : 'The speaker may mix English and Finnish kitchen terms.';
  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: [
                'You are Inventaario kitchen inventory speech-to-text.',
                'Transcribe the staff fridge/walk-in dictation accurately.',
                'Return ONLY the spoken words as plain text (no JSON, no markdown).',
                'Keep product names, quantities, and units.',
                langHint,
              ].join('\n'),
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });
  const geminiJson = await geminiRes.json();
  if (!geminiRes.ok) {
    throw new Error(
      geminiJson?.error?.message || `Gemini failed (${geminiRes.status})`,
    );
  }
  const text = (geminiJson.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Empty transcript');
  return text;
}

/**
 * Start live Web Speech recognition. Calls onPartial with interim+final text.
 * stop() resolves with the final transcript.
 *
 * Important: rebuild from the full `results` list every event. Chrome often
 * re-sends earlier finals with resultIndex 0; appending those duplicates the
 * transcript ("two vegan two vegan two vegan…").
 */
export function startWebSpeechDictation(options: {
  language: DictationLanguage;
  onPartial: (text: string) => void;
  onError?: (message: string) => void;
}): DictationSession {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error('Web Speech API not available');
  }

  const recognition = new Ctor();
  recognition.lang = speechLang(options.language);
  recognition.continuous = true;
  recognition.interimResults = true;
  // Helps some browsers avoid re-hypothesizing the whole buffer as new finals
  try {
    (recognition as SpeechRecognitionLike & { maxAlternatives?: number }).maxAlternatives = 1;
  } catch {
    /* ignore */
  }

  let stableCommitted = '';
  let sessionCommitted = '';
  let interim = '';
  let active = true;
  let userStopped = false;
  let settle: ((text: string) => void) | null = null;

  const currentText = () =>
    joinSpeechParts(
      joinSpeechParts(stableCommitted, sessionCommitted),
      interim,
    );

  const emit = () => {
    options.onPartial(currentText());
  };

  recognition.onresult = (ev) => {
    let finals = '';
    let inter = '';
    // Always scan the full list — do not append from resultIndex.
    for (let i = 0; i < ev.results.length; i++) {
      const row = ev.results[i];
      const piece = row[0]?.transcript ?? '';
      if (!piece) continue;
      if (row.isFinal) {
        finals += piece;
      } else {
        inter += piece;
      }
    }
    sessionCommitted = finals.replace(/\s+/g, ' ').trim();
    interim = inter.replace(/\s+/g, ' ').trim();
    emit();
  };

  recognition.onerror = (ev) => {
    const err = ev.error || 'speech_error';
    if (err === 'aborted' || err === 'no-speech') return;
    options.onError?.(err);
  };

  recognition.onend = () => {
    // Fold this Chrome session into stable text before restarting —
    // a new recognition() clears `results`, which would wipe the UI.
    const folded = joinSpeechParts(stableCommitted, sessionCommitted);
    if (interim) {
      stableCommitted = joinSpeechParts(folded, interim);
    } else {
      stableCommitted = folded;
    }
    sessionCommitted = '';
    interim = '';

    // Chrome often ends after a short pause in continuous mode — keep
    // listening until the user hits Stop.
    if (!userStopped) {
      try {
        recognition.start();
        emit();
        return;
      } catch {
        /* fall through and settle */
      }
    }
    active = false;
    const text = currentText();
    settle?.(text);
    settle = null;
  };

  recognition.start();

  return {
    get active() {
      return active;
    },
    stop: () =>
      new Promise((resolve) => {
        userStopped = true;
        settle = resolve;
        active = false;
        try {
          recognition.stop();
        } catch {
          resolve(currentText());
        }
        // Safety if onend never fires
        setTimeout(() => {
          if (settle) {
            settle(currentText());
            settle = null;
          }
        }, 1500);
      }),
  };
}

/**
 * Record mic audio via MediaRecorder, then transcribe with Gemini.
 * onPartial is only called after stop (no live STT).
 */
export async function startMediaRecorderDictation(options: {
  language: DictationLanguage;
  onRecording?: () => void;
}): Promise<DictationSession> {
  if (!isMediaRecorderAvailable()) {
    throw new Error('MediaRecorder not available');
  }
  if (!isGeminiTranscribeEnabled()) {
    throw new Error('Gemini transcription not configured');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
  ];
  const mimeType =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  let active = true;

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  recorder.start(250);
  options.onRecording?.();

  return {
    get active() {
      return active;
    },
    stop: () =>
      new Promise((resolve, reject) => {
        active = false;
        recorder.onstop = async () => {
          try {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, {
              type: recorder.mimeType || mimeType || 'audio/webm',
            });
            if (blob.size < 200) {
              resolve('');
              return;
            }
            const b64 = await blobToBase64(blob);
            const text = await transcribeWithGemini(
              blob.type || 'audio/webm',
              b64,
              options.language,
            );
            resolve(text);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        };
        try {
          recorder.stop();
        } catch (e) {
          stream.getTracks().forEach((t) => t.stop());
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }),
  };
}

/**
 * Best available dictation: Web Speech first, else MediaRecorder + Gemini.
 */
export async function startDictation(options: {
  language: DictationLanguage;
  onPartial: (text: string) => void;
  onError?: (message: string) => void;
  onMode?: (mode: 'webspeech' | 'gemini') => void;
}): Promise<DictationSession> {
  if (isWebSpeechAvailable()) {
    options.onMode?.('webspeech');
    return startWebSpeechDictation(options);
  }
  if (isMediaRecorderAvailable() && isGeminiTranscribeEnabled()) {
    options.onMode?.('gemini');
    const session = await startMediaRecorderDictation({
      language: options.language,
      onRecording: () => options.onPartial(''),
    });
    return session;
  }
  throw new Error('Dictation not available on this device');
}

/**
 * Pull a likely product phrase from a longer fridge walk-through transcript.
 * Prefer the last non-empty line / comma segment for the name field.
 */
export function preferProductPhrase(transcript: string): string {
  const cleaned = collapseRepeatedSpeech(transcript);
  if (!cleaned) return '';
  const parts = cleaned
    .split(/[\n;]+|(?:\s+and\s+)|(?:\s+ja\s+)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return cleaned;
  return parts[parts.length - 1]!;
}
