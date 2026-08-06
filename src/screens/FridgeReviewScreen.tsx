import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CroppedImage } from '../components/CroppedImage';
import { useChefNudge } from '../components/ChefNudge';
import { PackCheckModal } from '../components/PackCheckModal';
import { PlaceSelect } from '../components/PlaceSelect';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { ProductThumb } from '../components/ProductThumb';
import { useInventory } from '../data/store';
import type {
  ProductMatch,
  RootStackParamList,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import { confirmIfRecentAdd } from '../lib/confirmIfRecentAdd';
import { bestExtractMatch, isIdentityCatalogMatch } from '../lib/fuzzyMatch';
import {
  shouldShowPackCheck,
  type PackCheckInfo,
  type PackCheckResolve,
} from '../lib/packUnits';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'FridgeReview'>;

type LineStatus = 'pending' | 'confirmed' | 'skipped' | 'deferred';

type ReviewLine = {
  key: string;
  extract: VisionExtract;
  match: ProductMatch | null;
  qty: string;
  status: LineStatus;
  isSuggested: boolean;
};

function isSuggestedLine(extract: VisionExtract, match: ProductMatch | null) {
  if (extract.unrecognized) return true;
  if (extract.confidence < 0.45) return true;
  if (!match || match.score < 0.45) return true;
  return false;
}

export function FridgeReviewScreen({ route, navigation }: Props) {
  const { document, imageUri } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { yesChef } = useChefNudge();
  const {
    products,
    addQuantity,
    getRecentAddWarning,
    places,
    activePlaceId,
    setActivePlaceId,
    siteName,
    setProductPackInfo,
  } = useInventory();

  const initial = useMemo<ReviewLine[]>(
    () =>
      document.lines.map((extract, i) => {
        const match = extract.unrecognized
          ? null
          : bestExtractMatch(products, extract);
        const suggested = isSuggestedLine(extract, match);
        return {
          key: `f-${i}-${extract.suggestedName}`,
          extract,
          match: suggested && extract.unrecognized ? null : match,
          qty:
            extract.quantity != null ? String(extract.quantity) : '1',
          status: 'pending' as LineStatus,
          isSuggested: suggested,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [document],
  );

  const [lines, setLines] = useState(initial);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [detailsText, setDetailsText] = useState('');
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  const [packCheck, setPackCheck] = useState<{
    info: PackCheckInfo;
    lineKey: string;
  } | null>(null);

  const recognized = lines.filter((l) => !l.isSuggested);
  const suggested = lines.filter((l) => l.isSuggested);
  const pendingCount = lines.filter((l) => l.status === 'pending').length;
  const confirmedCount = lines.filter((l) => l.status === 'confirmed').length;

  function setQty(key: string, qty: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty } : l)),
    );
  }

  function setStatus(key: string, status: LineStatus) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, status } : l)),
    );
  }

  function setMatch(key: string, match: ProductMatch) {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? { ...l, match, isSuggested: false, extract: { ...l.extract, unrecognized: false } }
          : l,
      ),
    );
  }

  function writeConfirmed(line: ReviewLine, n: number) {
    if (!line.match) return;
    const run = () => {
      addQuantity({
        productId: line.match!.product.id,
        delta: n,
        placeId: activePlaceId,
        notes: document.title,
      });
      yesChef();
      setStatus(line.key, 'confirmed');
    };
    confirmIfRecentAdd(
      getRecentAddWarning(line.match.product.id, activePlaceId),
      t,
      run,
    );
  }

  function confirmOne(line: ReviewLine) {
    if (!line.match) {
      alertInfo(t('fridgeNeedMatch'), t('fridgeNeedMatchBody'));
      return;
    }
    const n = Number(line.qty.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) {
      alertInfo(t('qty'), t('recordInvalidQty'));
      return;
    }
    const check = shouldShowPackCheck(
      line.match.product,
      line.match.product.unit,
      n,
    );
    if (check) {
      setPackCheck({ info: check, lineKey: line.key });
      return;
    }
    writeConfirmed(line, n);
  }

  function onPackYes(resolved?: PackCheckResolve) {
    if (!packCheck) return;
    const line = lines.find((l) => l.key === packCheck.lineKey);
    if (
      line?.match &&
      resolved?.unitsPerPack != null &&
      resolved.unitsPerPack > 1
    ) {
      setProductPackInfo(
        line.match.product.id,
        resolved.unitsPerPack,
        resolved.packBaseUnit,
      );
    }
    setPackCheck(null);
    if (line) writeConfirmed(line, packCheck.info.packQty);
  }

  function onPackChangeToPieces(resolved?: PackCheckResolve) {
    if (!packCheck) return;
    const line = lines.find((l) => l.key === packCheck.lineKey);
    if (
      line?.match &&
      resolved?.unitsPerPack != null &&
      resolved.unitsPerPack > 1
    ) {
      setProductPackInfo(
        line.match.product.id,
        resolved.unitsPerPack,
        resolved.packBaseUnit,
      );
    }
    const n =
      packCheck.info.needsUnitsPerPack || packCheck.info.pieceQty == null
        ? packCheck.info.packQty
        : packCheck.info.pieceQty;
    setPackCheck(null);
    if (!line) return;
    setQty(line.key, String(n));
    writeConfirmed({ ...line, qty: String(n) }, n);
  }

  function skipOne(key: string) {
    setStatus(key, 'skipped');
  }

  function openAdd(line: ReviewLine, extraDescription?: string) {
    const name =
      line.extract.suggestedName === 'Unknown item' ||
      line.extract.suggestedName === 'Unknown container'
        ? ''
        : line.extract.suggestedName;
    const description = [
      line.extract.aiDescription,
      extraDescription?.trim(),
      line.extract.rawNotes,
    ]
      .filter(Boolean)
      .join(' · ');
    navigation.navigate('AddProduct', {
      prefillName: name || description.slice(0, 60),
      unit: line.extract.unit ?? undefined,
      packSize: line.extract.packSize ?? undefined,
      unitPriceAlv0: line.extract.unitPriceAlv0 ?? undefined,
      aliases: line.extract.aliases,
      ean: line.extract.ean ?? undefined,
      sourceUrl: line.extract.sourceUrl ?? undefined,
      imageUrl: line.extract.imageUrl ?? undefined,
      ingredientType: line.extract.ingredientType ?? undefined,
      brand: line.extract.brand ?? undefined,
      containerHint: line.extract.containerHint ?? undefined,
      photoUris: imageUri ? [imageUri] : undefined,
      returnToFridge: true,
      fridgeDocument: document,
      imageUri,
      extract: {
        ...line.extract,
        suggestedName: name || line.extract.suggestedName,
        aiDescription: description,
      },
    });
  }

  function askMoreDetails(line: ReviewLine) {
    setDetailsKey(line.key);
    setDetailsText(line.extract.aiDescription ?? '');
  }

  function submitDetails() {
    const line = lines.find((l) => l.key === detailsKey);
    setDetailsKey(null);
    if (!line) return;
    const note = detailsText.trim();
    if (!note) {
      alertInfo(t('fridgeDetailsTitle'), t('fridgeDetailsNeeded'));
      return;
    }
    setStatus(line.key, 'deferred');
    yesChef();
    openAdd(line, note);
  }

  function finish() {
    alertAck(
      t('fridgeDoneTitle'),
      t('fridgeDoneBody')
        .replace('{confirmed}', String(confirmedCount))
        .replace('{pending}', String(pendingCount)),
      () => navigation.navigate('VerifyAmounts', { mode: 'recent' }),
    );
  }

  function renderMatchPair(line: ReviewLine) {
    return (
      <View style={styles.matchPair}>
        <View style={styles.matchCol}>
          <CroppedImage
            uri={imageUri}
            crop={line.extract.crop}
            size={96}
            fallbackColor={line.extract.crop?.previewColor}
          />
          <Text style={styles.matchCap}>{t('fridgeDetectedCrop')}</Text>
        </View>
        <Text style={styles.matchArrow}>→</Text>
        <View style={styles.matchCol}>
          {line.match ? (
            <ProductThumb product={line.match.product} size={96} />
          ) : (
            <View style={[styles.packPlaceholder, { width: 96, height: 96 }]} />
          )}
          <Text style={styles.matchCap}>{t('fridgeOfficialPhoto')}</Text>
        </View>
      </View>
    );
  }

  function renderRecognized(line: ReviewLine) {
    const done = line.status !== 'pending';
    return (
      <View
        key={line.key}
        style={[styles.card, done && styles.cardDone]}
      >
        <Text style={styles.ask}>{t('fridgeIsThisProduct')}</Text>
        {renderMatchPair(line)}

        <Text style={styles.aiName}>
          AI: “{line.extract.suggestedName}”
        </Text>
        <Text style={styles.matchName}>
          {line.match
            ? line.match.product.officialName
            : t('fridgeNoCatalogMatch')}
        </Text>
        {line.match ? (
          <Text style={styles.meta}>
            {line.match.product.packSize
              ? `${line.match.product.packSize} · `
              : ''}
            {line.match.product.unit}
            {line.match.product.ean ? ` · EAN ${line.match.product.ean}` : ''}
            {' · '}
            {Math.round(line.match.score * 100)}%
          </Text>
        ) : null}
        {line.match && isIdentityCatalogMatch(line.match) ? (
          <Text style={styles.alreadyHave}>{t('confirmAlreadyHaveTitle')}</Text>
        ) : null}
        {line.status === 'confirmed' ? (
          <Text style={styles.statusOk}>{t('fridgeConfirmed')}</Text>
        ) : null}
        {line.status === 'skipped' ? (
          <Text style={styles.statusSkip}>{t('fridgeSkipped')}</Text>
        ) : null}

        {line.status === 'pending' ? (
          <>
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>{t('qty')}</Text>
              <TextInput
                value={line.qty}
                onChangeText={(v) => setQty(line.key, v)}
                keyboardType="decimal-pad"
                style={styles.qtyInput}
              />
              <Text style={styles.unit}>
                {line.match?.product.unit ?? line.extract.unit ?? ''}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={styles.btnConfirm}
                onPress={() => confirmOne(line)}
              >
                <Text style={styles.btnConfirmText}>{t('fridgeYes')}</Text>
              </Pressable>
              <Pressable
                style={styles.btnSecondary}
                onPress={() => setPickerKey(line.key)}
              >
                <Text style={styles.btnSecondaryText}>
                  {t('fridgePickAnother')}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.btnGhost, { marginTop: spacing.sm }]}
              onPress={() => skipOne(line.key)}
            >
              <Text style={styles.btnGhostText}>{t('fridgeSkip')}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  function renderSuggested(line: ReviewLine) {
    const done = line.status !== 'pending';
    return (
      <View
        key={line.key}
        style={[styles.card, styles.cardSuggest, done && styles.cardDone]}
      >
        <Text style={styles.suggestBadge}>{t('fridgeSuggested')}</Text>
        <View style={styles.cardTop}>
          <CroppedImage
            uri={imageUri}
            crop={line.extract.crop}
            size={72}
            fallbackColor={line.extract.crop?.previewColor}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.matchName}>
              {line.extract.suggestedName}
            </Text>
            <Text style={styles.desc}>
              {line.extract.aiDescription ??
                t('fridgeUnrecognizedDefault')}
            </Text>
            <Text style={styles.ask}>{t('fridgeWouldYouAdd')}</Text>
          </View>
        </View>

        {line.status === 'pending' ? (
          <View style={styles.suggestActions}>
            <Pressable
              style={styles.btnConfirm}
              onPress={() => {
                yesChef();
                openAdd(line);
              }}
            >
              <Text style={styles.btnConfirmText}>{t('fridgeAddItem')}</Text>
            </Pressable>
            <Pressable
              style={styles.btnSecondary}
              onPress={() => askMoreDetails(line)}
            >
              <Text style={styles.btnSecondaryText}>
                {t('fridgeAskDetails')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnGhost}
              onPress={() => skipOne(line.key)}
            >
              <Text style={styles.btnGhostText}>{t('fridgeSkip')}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.statusSkip}>
            {line.status === 'skipped'
              ? t('fridgeSkipped')
              : t('fridgeSentToAdd')}
          </Text>
        )}
      </View>
    );
  }

  const pickerLine = lines.find((l) => l.key === pickerKey);

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>{t('fridgeReviewKicker')}</Text>
        <Text style={styles.title}>
          {document.title ?? t('fridgeReviewTitle')}
        </Text>
        <Text style={styles.sub}>{t('fridgeReviewSub')}</Text>
        <Text style={styles.attribution}>{t('kruokaPhotoCredit')}</Text>

        {places.length > 0 ? (
          <View style={{ marginBottom: spacing.md }}>
            <PlaceSelect
              places={places}
              selectedId={activePlaceId}
              onSelect={(id) => {
                if (id !== 'all') setActivePlaceId(id);
              }}
              label={`${t('placesCountingAt')}${siteName ? ` · ${siteName}` : ''}`}
              flush
            />
          </View>
        ) : null}

        <Text style={styles.section}>{t('fridgeRecognized')}</Text>
        {recognized.length === 0 ? (
          <Text style={styles.empty}>{t('fridgeNoneRecognized')}</Text>
        ) : (
          recognized.map(renderRecognized)
        )}

        <Text style={[styles.section, { marginTop: spacing.xl }]}>
          {t('fridgeSuggestedSection')}
        </Text>
        <Text style={styles.sectionHint}>{t('fridgeSuggestedHint')}</Text>
        {suggested.length === 0 ? (
          <Text style={styles.empty}>{t('fridgeNoneSuggested')}</Text>
        ) : (
          suggested.map(renderSuggested)
        )}

        <Pressable style={styles.finish} onPress={finish}>
          <Text style={styles.finishText}>
            {pendingCount > 0
              ? t('fridgeFinishPartial')
              : t('fridgeFinishDone')}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={detailsKey != null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsKey(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDetailsKey(null)}
        >
          <Pressable
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('fridgeDetailsTitle')}</Text>
            <Text style={styles.modalSub}>{t('fridgeDetailsSub')}</Text>
            <TextInput
              value={detailsText}
              onChangeText={setDetailsText}
              placeholder={t('fridgeDetailsPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              multiline
              style={styles.modalInput}
            />
            <Pressable style={styles.btnConfirm} onPress={submitDetails}>
              <Text style={styles.btnConfirmText}>
                {t('fridgeDetailsContinue')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnGhost, { marginTop: spacing.sm }]}
              onPress={() => setDetailsKey(null)}
            >
              <Text style={styles.btnGhostText}>{t('fridgeSkip')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerKey != null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerKey(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerKey(null)}
        >
          <Pressable
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('fridgePickAnotherTitle')}</Text>
            <Text style={styles.modalSub}>{t('fridgePickAnotherSub')}</Text>
            <ProductSearchInput
              products={products}
              initialQuery={pickerLine?.extract.suggestedName ?? ''}
              onSelect={(m) => {
                if (pickerKey) setMatch(pickerKey, m);
                setPickerKey(null);
                yesChef();
              }}
            />
            <Pressable
              style={[styles.btnGhost, { marginTop: spacing.md }]}
              onPress={() => setPickerKey(null)}
            >
              <Text style={styles.btnGhostText}>{t('fridgeSkip')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <PackCheckModal
        visible={packCheck != null}
        info={packCheck?.info ?? null}
        onYesPacks={onPackYes}
        onChangeToPieces={onPackChangeToPieces}
        onEdit={() => setPackCheck(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { color: colors.inkMuted, marginTop: 6, lineHeight: 20, fontSize: 14 },
  attribution: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.inkFaint,
  },
  section: {
    marginTop: spacing.lg,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  sectionHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  empty: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 13 },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  cardSuggest: { borderColor: colors.primaryMid },
  cardDone: { opacity: 0.7 },
  suggestBadge: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  matchPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  matchCol: { alignItems: 'center', gap: 6 },
  matchArrow: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 18,
  },
  matchCap: { fontSize: 10, color: colors.inkMuted, fontWeight: '600' },
  packPlaceholder: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.primarySoft,
  },
  aiName: { fontSize: 12, color: colors.inkMuted },
  matchName: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  meta: { fontSize: 12, color: colors.accent, marginTop: 4 },
  alreadyHave: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  desc: { fontSize: 13, color: colors.inkMuted, marginTop: 6, lineHeight: 18 },
  ask: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  qtyLabel: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  qtyInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  unit: { color: colors.inkMuted, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  suggestActions: { marginTop: spacing.md, gap: spacing.sm },
  btnConfirm: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  btnGhost: {
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    flex: 1,
  },
  btnGhostText: { color: colors.inkMuted, fontWeight: '600', fontSize: 14 },
  statusOk: {
    marginTop: 6,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  statusSkip: {
    marginTop: 6,
    color: colors.inkFaint,
    fontWeight: '600',
    fontSize: 12,
  },
  finish: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryMid,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalSub: {
    marginTop: 6,
    marginBottom: spacing.md,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    color: colors.ink,
    backgroundColor: colors.bg,
    marginBottom: spacing.md,
    fontSize: 15,
  },
});
