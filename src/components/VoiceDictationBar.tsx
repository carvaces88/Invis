import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import {
  isDictationAvailable,
  preferProductPhrase,
  startDictation,
  type DictationSession,
} from '../lib/speechDictation';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  /** Called when user wants the transcript applied to the product name field */
  onApplyToName: (phrase: string) => void;
  /** Optional: full transcript updates while listening / after stop */
  onTranscriptChange?: (text: string) => void;
};

/**
 * Mic → live/final transcript → editable text → apply to record search.
 * Web: Web Speech API; fallback MediaRecorder + Gemini /api/transcribe.
 */
export function VoiceDictationBar({
  onApplyToName,
  onTranscriptChange,
}: Props) {
  const { t, locale } = useI18n();
  const [supported] = useState(() => isDictationAvailable());
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const sessionRef = useRef<DictationSession | null>(null);

  useEffect(() => {
    return () => {
      const s = sessionRef.current;
      sessionRef.current = null;
      if (s?.active) void s.stop().catch(() => {});
    };
  }, []);

  function setText(next: string) {
    setTranscript(next);
    onTranscriptChange?.(next);
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

  function apply() {
    const phrase = preferProductPhrase(transcript);
    if (!phrase) {
      setHint(t('voiceEmpty'));
      return;
    }
    onApplyToName(phrase);
    setHint(t('voiceApplied'));
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
        <Text style={styles.label}>{t('voiceDictateLabel')}</Text>
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
        <Pressable
          onPress={apply}
          disabled={!transcript.trim()}
          style={({ pressed }) => [
            styles.applyBtn,
            !transcript.trim() && styles.applyBtnDisabled,
            pressed && transcript.trim() && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('voiceApplyToName')}
        >
          <Text style={styles.applyBtnText}>{t('voiceApplyToName')}</Text>
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
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
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
