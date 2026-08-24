import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceDictationBar } from '../components/VoiceDictationBar';
import { PlaceSelect } from '../components/PlaceSelect';
import { useInventory } from '../data/store';
import type {
  DocumentExtract,
  RootStackParamList,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { bestExtractMatch } from '../lib/fuzzyMatch';
import {
  mergeShelfDocuments,
  transcriptToFridgeDocument,
} from '../lib/parseDictationTranscript';
import { isDictationAvailable } from '../lib/speechDictation';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoDemo'>;

type ShelfBag = {
  placeId: string;
  placeName: string;
  document: DocumentExtract;
};

/**
 * Live mic companion — shelf by shelf.
 * Speak what you see on the current place → preview catalog matches →
 * save shelf → next place → finish into FridgeReview → confirm → export.
 */
export function VideoDemoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { products, places, activePlaceId, setActivePlaceId, siteName } =
    useInventory();
  const [draftTranscript, setDraftTranscript] = useState('');
  const [shelves, setShelves] = useState<ShelfBag[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [micReset, setMicReset] = useState(0);

  const placeName =
    places.find((p) => p.id === activePlaceId)?.name ?? t('placesCountingAt');

  const draftDoc = useMemo(() => {
    if (!draftTranscript.trim()) return null;
    return transcriptToFridgeDocument(draftTranscript, {
      title: t('companionShelfTitle').replace('{place}', placeName),
      placeLabel: placeName,
    });
  }, [draftTranscript, placeName, t]);

  const draftPreview = useMemo(() => {
    if (!draftDoc) return [] as { line: VisionExtract; matched: string | null }[];
    return draftDoc.lines.map((line) => {
      const match = bestExtractMatch(products, line);
      return {
        line,
        matched:
          match && match.score >= 0.45 ? match.product.officialName : null,
      };
    });
  }, [draftDoc, products]);

  const totalLines = shelves.reduce((n, s) => n + s.document.lines.length, 0);

  function saveCurrentShelf() {
    if (!draftDoc || draftDoc.lines.length === 0) {
      setHint(t('voiceParseFailed'));
      return;
    }
    setShelves((prev) => [
      ...prev,
      {
        placeId: activePlaceId,
        placeName,
        document: draftDoc,
      },
    ]);
    setDraftTranscript('');
    setMicReset((n) => n + 1);
    setHint(
      t('companionShelfSaved')
        .replace('{place}', placeName)
        .replace('{n}', String(draftDoc.lines.length)),
    );
  }

  function finishWalk() {
    const parts = [...shelves.map((s) => s.document)];
    if (draftDoc && draftDoc.lines.length > 0) {
      parts.push(draftDoc);
    }
    const merged = mergeShelfDocuments(parts, t('companionWalkTitle'));
    if (!merged) {
      setHint(t('companionEmptyWalk'));
      return;
    }
    navigation.navigate('FridgeReview', { document: merged });
  }

  const micOk = isDictationAvailable();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>{t('companionKicker')}</Text>
      <Text style={styles.title}>{t('companionTitle')}</Text>
      <Text style={styles.body}>{t('companionSub')}</Text>

      <View style={styles.placeBlock}>
        <PlaceSelect
          places={places}
          selectedId={activePlaceId}
          onSelect={(id) => {
            if (id !== 'all') setActivePlaceId(id);
          }}
          label={
            siteName
              ? `${t('companionCountingAt')} · ${siteName}`
              : t('companionCountingAt')
          }
        />
      </View>

      {!micOk ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>{t('voiceUnsupported')}</Text>
        </View>
      ) : null}

      <VoiceDictationBar
        resetToken={micReset}
        onApplyToName={(phrase) => setDraftTranscript(phrase)}
        onTranscriptChange={setDraftTranscript}
        onReviewLines={(document) => {
          const stamped: DocumentExtract = {
            ...document,
            title: t('companionShelfTitle').replace('{place}', placeName),
            lines: document.lines.map((l) => ({
              ...l,
              rawNotes: [l.rawNotes, `Place: ${placeName}`]
                .filter(Boolean)
                .join(' · '),
            })),
          };
          navigation.navigate('FridgeReview', { document: stamped });
        }}
      />

      {draftPreview.length > 0 ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>
            {t('companionDraftPreview').replace(
              '{n}',
              String(draftPreview.length),
            )}
          </Text>
          {draftPreview.map((row, i) => (
            <View key={`${row.line.suggestedName}-${i}`} style={styles.previewRow}>
              <Text style={styles.previewQty}>
                {row.line.quantity ?? 1}
                {row.line.unit ? ` ${row.line.unit}` : ''}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewName}>{row.line.suggestedName}</Text>
                <Text style={styles.previewMatch}>
                  {row.matched
                    ? t('companionMatchedAs').replace('{name}', row.matched)
                    : t('companionNoMatch')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primaryBtn,
            (!draftDoc || draftDoc.lines.length === 0) && styles.btnDisabled,
          ]}
          disabled={!draftDoc || draftDoc.lines.length === 0}
          onPress={saveCurrentShelf}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>{t('companionSaveShelf')}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondaryBtn,
            totalLines === 0 &&
              !(draftDoc && draftDoc.lines.length > 0) &&
              styles.btnDisabled,
          ]}
          disabled={
            totalLines === 0 && !(draftDoc && draftDoc.lines.length > 0)
          }
          onPress={finishWalk}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>
            {t('companionFinishWalk').replace(
              '{n}',
              String(
                totalLines + (draftDoc?.lines.length ?? 0),
              ),
            )}
          </Text>
        </Pressable>
      </View>

      {shelves.length > 0 ? (
        <View style={styles.bagCard}>
          <Text style={styles.previewTitle}>
            {t('companionSavedShelves').replace('{n}', String(shelves.length))}
          </Text>
          {shelves.map((s, i) => (
            <View key={`${s.placeId}-${i}`} style={styles.bagRow}>
              <Text style={styles.bagPlace}>{s.placeName}</Text>
              <Text style={styles.bagMeta}>
                {t('companionShelfLineCount').replace(
                  '{n}',
                  String(s.document.lines.length),
                )}
              </Text>
              <Pressable
                onPress={() =>
                  setShelves((prev) => prev.filter((_, j) => j !== i))
                }
                hitSlop={8}
              >
                <Text style={styles.bagRemove}>{t('voiceClear')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Text style={styles.footnote}>{t('companionFootnote')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  body: {
    color: colors.inkMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
    fontSize: 15,
  },
  placeBlock: { marginTop: spacing.lg },
  warn: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
  },
  warnText: { color: colors.warning, fontSize: 13, lineHeight: 18 },
  previewCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
    gap: spacing.sm,
  },
  previewTitle: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  previewQty: {
    minWidth: 48,
    fontWeight: '700',
    color: colors.primary,
    fontSize: 13,
  },
  previewName: { fontWeight: '600', color: colors.ink, fontSize: 14 },
  previewMatch: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  bagCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
    gap: spacing.sm,
  },
  bagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bagPlace: { flex: 1, fontWeight: '600', color: colors.ink },
  bagMeta: { color: colors.inkMuted, fontSize: 12 },
  bagRemove: { color: colors.danger, fontWeight: '600', fontSize: 12 },
  hint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 12 },
  footnote: {
    marginTop: spacing.lg,
    color: colors.inkFaint,
    fontSize: 12,
    lineHeight: 18,
  },
});
