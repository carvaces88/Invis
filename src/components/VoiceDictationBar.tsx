import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DocumentExtract } from '../data/types';
import { useI18n } from '../i18n';
import {
  countDictationLines,
  transcriptToFridgeDocument,
} from '../lib/parseDictationTranscript';
import {
  isDictationAvailable,
  preferProductPhrase,
  collapseRepeatedSpeech,
  startDictation,
  type DictationSession,
} from '../lib/speechDictation';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  /** Called when user wants the transcript applied to the product name field */
  onApplyToName: (phrase: string) => void;
  /** Multi-item walk-through → FridgeReview confirm flow */
  onReviewLines?: (document: DocumentExtract) => void;
  /** Optional: full transcript updates while listening / after stop */
  onTranscriptChange?: (text: string) => void;
  /** Change to clear internal transcript (e.g. after saving a shelf) */
  resetToken?: string | number;
};

/**
 * Mic → live/final transcript → editable text → review lines or apply to name.
 * Web: Web Speech API; fallback MediaRecorder + Gemini /api/transcribe.
 */
export function VoiceDictationBar({
  onApplyToName,
  onReviewLines,
  onTranscriptChange,
  resetToken,
}: Props) {
  const { t, locale } = useI18n();
  const [supported] = useState(() => isDictationAvailable());
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const sessionRef = useRef<DictationSession | null>(null);
  const lineCount = useMemo(
    () => countDictationLines(transcript),
    [transcript],
  );

  useEffect(() => {
    return () => {
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s?.active) void s.stop().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (resetToken == null) return;
    setTranscript('');
    setHint(null);
    onTranscriptChange?.('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on token change
  }, [resetToken]);

  function setText(next: string) {
    const cleaned = collapseRepeatedSpeech(next);
    setTranscript(cleaned);
    onTranscriptChange?.(cleaned);
  }

  async function toggle() {
    if (!supported) {
      setHint(t('voiceUnsupported'));
      return;
    }

    if (listening && sessionRef.current) {
      setBusy(true);
      setHint(t('voiceTranscribing'));
      try {
        const finalText = await sessionRef.current.stop();
        sessionRef.current = null;
        setListening(false);
        if (finalText.trim()) {
          setText(finalText.trim());
          setHint(t('voiceReadyHint'));
        } else if (!transcript.trim()) {
          setHint(t('voiceEmpty'));
        } else {
          setHint(t('voiceReadyHint'));
        }
      } catch (e) {
        sessionRef.current = null;
        setListening(false);
        setHint(e instanceof Error ? e.message : t('voiceFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    setHint(null);
    setBusy(true);
    try {
      const session = await startDictation({
        language: locale === 'fi' ? 'fi' : 'en',
        onPartial: (text) => {
          if (text) setText(text);
        },
        onError: (message) => {
          setHint(message);
        },
        onMode: (mode) => {
          setHint(
            mode === 'webspeech' ? t('voiceListeningLive') : t('voiceRecording'),
          );
        },
      });
      sessionRef.current = session;
      setListening(true);
    } catch (e) {
      setHint(e instanceof Error ? e.message : t('voiceFailed'));
    } finally {
      setBusy(false);
    }
  }

  function applyName() {
    const phrase = preferProductPhrase(transcript);
    if (!phrase) {
      setHint(t('voiceEmpty'));
      return;
    }
    onApplyToName(phrase);
    setHint(t('voiceApplied'));
  }

  function reviewLines() {
    const doc = transcriptToFridgeDocument(transcript, {
      title: t('voiceWalkthroughTitle'),
    });
    if (!doc || doc.lines.length === 0) {
      setHint(t('voiceParseFailed'));
      return;
    }
    onReviewLines?.(doc);
    setHint(t('voiceReviewOpened').replace('{n}', String(doc.lines.length)));
  }

  if (!supported) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.unsupported}>{t('voiceUnsupported')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.label}>{t('voiceDictateLabel')}</Text>
          <View style={styles.betaBadge} accessibilityLabel={t('voiceBeta')}>
            <Text style={styles.betaBadgeText}>{t('voiceBeta')}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => void toggle()}
          disabled={busy}
          style={({ pressed }) => [
            styles.micBtn,
            listening && styles.micBtnOn,
            (pressed || busy) && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ busy: busy || listening }}
          accessibilityLabel={
            listening ? t('voiceStopA11y') : t('voiceStartA11y')
          }
        >
          {busy && !listening ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.micText, listening && styles.micTextOn]}>
              {listening ? t('voiceStop') : t('voiceMic')}
            </Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.sub}>{t('voiceDictateSub')}</Text>
      {listening ? (
        <View style={styles.pulseRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.pulseText}>{t('voiceListening')}</Text>
        </View>
      ) : null}
      <TextInput
        value={transcript}
        onChangeText={setText}
        placeholder={t('voiceTranscriptPlaceholder')}
        placeholderTextColor={colors.inkFaint}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={styles.transcript}
        accessibilityLabel={t('voiceTranscriptPlaceholder')}
      />
      <View style={styles.actions}>
        {onReviewLines ? (
          <Pressable
            onPress={reviewLines}
            disabled={!transcript.trim() || lineCount === 0}
            style={({ pressed }) => [
              styles.applyBtn,
              (!transcript.trim() || lineCount === 0) && styles.applyBtnDisabled,
              pressed && transcript.trim() && lineCount > 0 && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('voiceReviewLines')}
          >
            <Text style={styles.applyBtnText}>
              {lineCount > 0
                ? t('voiceReviewLinesN').replace('{n}', String(lineCount))
                : t('voiceReviewLines')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={applyName}
          disabled={!transcript.trim()}
          style={({ pressed }) => [
            onReviewLines ? styles.secondaryBtn : styles.applyBtn,
            !transcript.trim() && styles.applyBtnDisabled,
            pressed && transcript.trim() && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('voiceApplyToName')}
        >
          <Text
            style={
              onReviewLines ? styles.secondaryBtnText : styles.applyBtnText
            }
          >
            {t('voiceApplyToName')}
          </Text>
        </Pressable>
        {transcript.trim() ? (
          <Pressable
            onPress={() => {
              setText('');
              setHint(null);
            }}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.clearBtnText}>{t('voiceClear')}</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  betaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  betaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.warning,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkMuted,
  },
  micBtn: {
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnOn: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  micText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.primary,
  },
  micTextOn: {
    color: colors.danger,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  pulseText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  transcript: {
    marginTop: spacing.sm,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  secondaryBtnText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  hint: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.inkFaint,
  },
  unsupported: {
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
});
