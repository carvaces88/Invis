import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import type { ProductMatch, RootStackParamList, VisionExtract } from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import { confirmIfRecentAdd } from '../lib/confirmIfRecentAdd';
import { bestExtractMatch } from '../lib/fuzzyMatch';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchConfirm'>;

type DraftLine = {
  key: string;
  extract: VisionExtract;
  match: ProductMatch | null;
  qty: string;
  included: boolean;
};

export function BatchConfirmScreen({ route, navigation }: Props) {
  const { document } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    products,
    applyStockDelta,
    recordHavikki,
    addQuantity,
    getRecentAddWarning,
    activePlaceId,
  } = useInventory();
  const isKuorma = document.kind === 'kuorma';
  const isFridge = document.kind === 'fridge';

  const initial = useMemo<DraftLine[]>(
    () =>
      document.lines.map((extract, i) => ({
        key: `d-${i}-${extract.suggestedName}`,
        extract,
        match: bestExtractMatch(products, extract),
        qty:
          extract.quantity != null
            ? String(extract.quantity)
            : '1',
        included: true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once from document
    [document],
  );

  const [drafts, setDrafts] = useState(initial);

  function setQty(key: string, qty: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, qty } : d)),
    );
  }

  function toggle(key: string) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.key === key ? { ...d, included: !d.included } : d,
      ),
    );
  }

  function confirmAll() {
    const selected = drafts.filter((d) => d.included);
    const unmatched = selected.filter((d) => !d.match);
    if (unmatched.length) {
      alertInfo(
        'Unmatched lines',
        `${unmatched.length} line(s) have no catalog match. Uncheck them or add to database first.`,
      );
      return;
    }

    const applySelected = () => {
      for (const d of selected) {
        const n = Number(d.qty.replace(',', '.'));
        if (Number.isNaN(n) || n < 0) continue;
        const productId = d.match!.product.id;
        if (isFridge) {
          addQuantity({
            productId,
            delta: n,
            notes: document.title,
          });
        } else if (isKuorma) {
          applyStockDelta({
            productId,
            delta: n,
            type: 'kuorma_in',
            notes: document.title,
            source: 'kuorma',
          });
        } else {
          recordHavikki({
            productId,
            quantity: n,
            station: document.station,
            notes: d.extract.rawNotes ?? document.title,
          });
        }
      }
      const savedMsg = isFridge
        ? `Inventory count: ${selected.length} item(s) confirmed.`
        : isKuorma
          ? `Delivery: ${selected.length} line(s) added to stock.`
          : `Food waste: ${selected.length} line(s) subtracted & logged.`;
      alertAck('Saved', savedMsg, () => navigation.popToTop());
    };

    if (isFridge) {
      const firstWarn = selected
        .map((d) =>
          getRecentAddWarning(d.match!.product.id, activePlaceId),
        )
        .find((w) => w != null);
      if (firstWarn) {
        confirmIfRecentAdd(firstWarn, t, applySelected);
        return;
      }
    }
    applySelected();
  }

  const kicker = isFridge
    ? 'Fridge / shelf'
    : isKuorma
      ? 'Delivery'
      : 'Food waste';
  const saveLabel = isFridge
    ? 'Confirm inventory counts'
    : isKuorma
      ? 'Confirm delivery (add stock)'
      : 'Confirm food waste (subtract)';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{document.title ?? 'Confirm lines'}</Text>
      <Text style={styles.sub}>
        {isFridge
          ? 'AI found multiple items in this photo. Uncheck anything wrong, edit qty, then confirm — nothing is written until you confirm.'
          : 'AI never writes alone. Review matches (alias-aware), edit qty, then confirm.'}
        {document.station ? ` Station: ${document.station}.` : ''}
      </Text>
      {document.rawNotes ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{document.rawNotes}</Text>
        </View>
      ) : null}

      {drafts.map((d) => (
        <View
          key={d.key}
          style={[styles.card, !d.included && styles.cardOff]}
        >
          <Pressable onPress={() => toggle(d.key)} style={styles.cardHead}>
            <View style={[styles.check, d.included && styles.checkOn]}>
              <Text style={styles.checkMark}>{d.included ? '✓' : ''}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiName}>AI: “{d.extract.suggestedName}”</Text>
              <Text style={styles.matchName}>
                {d.match
                  ? d.match.product.officialName
                  : 'No match — add to database'}
              </Text>
              {d.match ? (
                <Text style={styles.meta}>
                  via “{d.match.matchedTerm}” · {d.match.product.unit} ·{' '}
                  {Math.round(d.match.score * 100)}%
                </Text>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Qty</Text>
            <TextInput
              value={d.qty}
              onChangeText={(t) => setQty(d.key, t)}
              keyboardType="decimal-pad"
              style={styles.qtyInput}
            />
            <Text style={styles.unit}>
              {d.match?.product.unit ?? d.extract.unit ?? ''}
            </Text>
            {!d.match ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('AddProduct', {
                    prefillName: d.extract.suggestedName,
                    unit: d.extract.unit ?? undefined,
                    packSize: d.extract.packSize ?? undefined,
                    unitPriceAlv0: d.extract.unitPriceAlv0 ?? undefined,
                    aliases: d.extract.aliases,
                    ean: d.extract.ean ?? undefined,
                    sourceUrl: d.extract.sourceUrl ?? undefined,
                    imageUrl: d.extract.imageUrl ?? undefined,
                    ingredientType: d.extract.ingredientType ?? undefined,
                    brand: d.extract.brand ?? undefined,
                    containerHint: d.extract.containerHint ?? undefined,
                    photoUris: route.params.imageUri
                      ? [route.params.imageUri]
                      : undefined,
                    returnToBatch: true,
                    document,
                    imageUri: route.params.imageUri,
                    extract: d.extract,
                  })
                }
              >
                <Text style={styles.addLink}>Add to DB</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <Pressable style={styles.save} onPress={confirmAll}>
        <Text style={styles.saveText}>{saveLabel}</Text>
      </Pressable>
    </ScrollView>
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
  note: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noteText: { color: colors.primary, fontSize: 13, lineHeight: 18 },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  cardOff: { opacity: 0.45 },
  cardHead: { flexDirection: 'row', gap: spacing.sm },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  aiName: { fontSize: 12, color: colors.inkMuted },
  matchName: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 2 },
  meta: { fontSize: 12, color: colors.accent, marginTop: 4 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
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
  addLink: { color: colors.primary, fontWeight: '700', marginLeft: 'auto' },
  save: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
