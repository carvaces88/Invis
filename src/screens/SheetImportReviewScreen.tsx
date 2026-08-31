import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceSelect } from '../components/PlaceSelect';
import { useInventory } from '../data/store';
import type {
  ProductMatch,
  RootStackParamList,
  UnitCode,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertConfirm, alertInfo } from '../lib/alertAck';
import { bestExtractMatch } from '../lib/fuzzyMatch';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetImportReview'>;

type SortMode = 'sheet' | 'az' | 'za' | 'qty';

type DraftRow = {
  key: string;
  index: number;
  extract: VisionExtract;
  match: ProductMatch | null;
  name: string;
  unit: string;
  qty: string;
  price: string;
  included: boolean;
};

function parseFiNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(raw: string): UnitCode {
  const u = raw.trim().toUpperCase();
  const map: Record<string, UnitCode> = {
    L: 'L',
    KPL: 'KPL',
    PRK: 'PRK',
    RSA: 'RSA',
    PSS: 'PSS',
    PL: 'PL',
    PLO: 'PLO',
    LTK: 'LTK',
    KG: 'KG',
    RAS: 'RAS',
    PKT: 'PKT',
    PK: 'PKT',
    PACKET: 'PKT',
  };
  return map[u] ?? 'KPL';
}

/**
 * Desktop-friendly validation table: edit OCR rows, sort A–Z, write absolute stock.
 */
export function SheetImportReviewScreen({ route, navigation }: Props) {
  const { document } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { t } = useI18n();
  const {
    products,
    places,
    activePlaceId,
    setActivePlaceId,
    upsertCountedProduct,
    addProduct,
  } = useInventory();

  const [placeId, setPlaceId] = useState(activePlaceId);
  const [sortMode, setSortMode] = useState<SortMode>('sheet');
  const [busy, setBusy] = useState(false);

  const initial = useMemo<DraftRow[]>(
    () =>
      document.lines.map((extract, i) => ({
        key: `s-${i}-${extract.suggestedName}`,
        index: i,
        extract,
        match: bestExtractMatch(products, extract),
        name: extract.suggestedName,
        unit: extract.unit ?? 'KPL',
        qty:
          extract.quantity != null
            ? String(extract.quantity).replace('.', ',')
            : '',
        price:
          extract.unitPriceAlv0 != null
            ? String(extract.unitPriceAlv0).replace('.', ',')
            : '',
        included: extract.quantity != null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
    [document],
  );

  const [drafts, setDrafts] = useState(initial);

  const sortedDrafts = useMemo(() => {
    const rows = [...drafts];
    if (sortMode === 'sheet') {
      return rows.sort((a, b) => a.index - b.index);
    }
    if (sortMode === 'az') {
      return rows.sort((a, b) =>
        a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' }),
      );
    }
    if (sortMode === 'za') {
      return rows.sort((a, b) =>
        b.name.localeCompare(a.name, 'fi', { sensitivity: 'base' }),
      );
    }
    // qty: filled first, then by name
    return rows.sort((a, b) => {
      const aQ = a.qty.trim() ? 0 : 1;
      const bQ = b.qty.trim() ? 0 : 1;
      if (aQ !== bQ) return aQ - bQ;
      return a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' });
    });
  }, [drafts, sortMode]);

  const stats = useMemo(() => {
    const included = drafts.filter((d) => d.included);
    const withQty = included.filter((d) => parseFiNumber(d.qty) != null);
    const matched = included.filter((d) => d.match);
    const unmatched = included.filter((d) => !d.match);
    return {
      total: drafts.length,
      included: included.length,
      withQty: withQty.length,
      matched: matched.length,
      unmatched: unmatched.length,
    };
  }, [drafts]);

  function patch(key: string, patch: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch } : d)),
    );
  }

  function applySort(mode: SortMode) {
    setSortMode(mode);
  }

  function writeInventory(createMissing: boolean) {
    const selected = drafts.filter((d) => d.included);
    if (!selected.length) {
      alertInfo(t('sheetImportReviewTitle'), t('sheetImportNothingSelected'));
      return;
    }

    const missing = selected.filter((d) => !d.match);
    if (missing.length && !createMissing) {
      alertConfirm(
        t('sheetImportUnmatchedTitle'),
        t('sheetImportUnmatchedBody').replace(
          '{count}',
          String(missing.length),
        ),
        {
          confirmLabel: t('sheetImportCreateMissing'),
          cancelLabel: t('cancel'),
          onConfirm: () => writeInventory(true),
        },
      );
      return;
    }

    setBusy(true);
    try {
      setActivePlaceId(placeId);
      let written = 0;
      let created = 0;

      for (const d of selected) {
        const qty = parseFiNumber(d.qty);
        const price = parseFiNumber(d.price);
        const unit = normalizeUnit(d.unit);
        let productId = d.match?.product.id;

        if (!productId && createMissing) {
          const product = addProduct({
            officialName: d.name.trim() || d.extract.suggestedName,
            unit,
            unitPriceAlv0: price ?? undefined,
            packSize: d.extract.packSize ?? undefined,
            aliases: d.extract.aliases ?? [],
            ingredientType: d.extract.ingredientType ?? undefined,
          });
          productId = product.id;
          created += 1;
        }
        if (!productId) continue;

        if (qty != null && qty >= 0) {
          upsertCountedProduct({
            productId,
            quantity: qty,
            placeId,
            notes: document.title,
            unitPriceAlv0: price ?? undefined,
          });
          written += 1;
        }
      }

      alertAck(
        t('sheetImportDoneTitle'),
        t('sheetImportDoneBody')
          .replace('{written}', String(written))
          .replace('{created}', String(created)),
      );
      navigation.navigate('MainTabs', { screen: 'Inventaario' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('sheetImportReviewTitle')}</Text>
        <Text style={styles.sub}>
          {(document.title || t('sheetImportTitle')) +
            ` · ${stats.withQty}/${stats.total} ` +
            t('sheetImportWithQty')}
        </Text>

        <View style={styles.placeRow}>
          <PlaceSelect
            places={places}
            selectedId={placeId}
            onSelect={setPlaceId}
            label={t('placesCountingAt')}
            flush
            compact
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {(
            [
              ['sheet', t('sheetImportSortSheet')],
              ['az', t('sheetImportSortAz')],
              ['za', t('sheetImportSortZa')],
              ['qty', t('sheetImportSortQty')],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              onPress={() => applySort(mode)}
              style={[styles.sortChip, sortMode === mode && styles.sortChipOn]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortMode === mode && styles.sortChipTextOn,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.meta}>
          {t('sheetImportMatchMeta')
            .replace('{matched}', String(stats.matched))
            .replace('{unmatched}', String(stats.unmatched))}
        </Text>
      </View>

      <ScrollView
        horizontal={!wide}
        style={styles.tableScroll}
        contentContainerStyle={{ minWidth: wide ? undefined : 720 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colCheck]}>✓</Text>
            <Text style={[styles.th, styles.colName]}>
              {t('sheetImportColName')}
            </Text>
            <Text style={[styles.th, styles.colUnit]}>
              {t('sheetImportColUnit')}
            </Text>
            <Text style={[styles.th, styles.colQty]}>
              {t('sheetImportColQty')}
            </Text>
            <Text style={[styles.th, styles.colPrice]}>
              {t('sheetImportColPrice')}
            </Text>
            <Text style={[styles.th, styles.colMatch]}>
              {t('sheetImportColMatch')}
            </Text>
          </View>

          {sortedDrafts.map((d) => (
            <View
              key={d.key}
              style={[styles.tr, !d.match && d.included && styles.trWarn]}
            >
              <Pressable
                onPress={() => patch(d.key, { included: !d.included })}
                style={styles.colCheck}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: d.included }}
              >
                <Text style={styles.checkText}>{d.included ? '☑' : '☐'}</Text>
              </Pressable>
              <TextInput
                value={d.name}
                onChangeText={(name) => patch(d.key, { name })}
                style={[styles.input, styles.colName]}
              />
              <TextInput
                value={d.unit}
                onChangeText={(unit) => patch(d.key, { unit })}
                autoCapitalize="characters"
                style={[styles.input, styles.colUnit]}
              />
              <TextInput
                value={d.qty}
                onChangeText={(qty) => patch(d.key, { qty })}
                keyboardType="decimal-pad"
                style={[styles.input, styles.colQty]}
              />
              <TextInput
                value={d.price}
                onChangeText={(price) => patch(d.key, { price })}
                keyboardType="decimal-pad"
                style={[styles.input, styles.colPrice]}
              />
              <Text
                style={[styles.matchText, styles.colMatch]}
                numberOfLines={2}
              >
                {d.match
                  ? d.match.product.officialName
                  : t('sheetImportNoMatch')}
              </Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          disabled={busy}
          onPress={() => writeInventory(false)}
          style={({ pressed }) => [
            styles.writeBtn,
            pressed && { opacity: 0.9 },
            busy && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.writeBtnText}>{t('sheetImportWrite')}</Text>
          <Text style={styles.writeBtnSub}>{t('sheetImportWriteSub')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  sub: { marginTop: 4, fontSize: 13, color: colors.inkMuted },
  placeRow: { marginTop: spacing.sm },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  sortChipOn: { backgroundColor: colors.primary },
  sortChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  sortChipTextOn: { color: '#fff' },
  meta: { fontSize: 12, color: colors.inkFaint },
  tableScroll: { flex: 1 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.primarySoft,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  trWarn: { backgroundColor: colors.warningSoft },
  colCheck: { width: 36, alignItems: 'center' },
  colName: { flex: 1.6, minWidth: 160 },
  colUnit: { width: 64 },
  colQty: { width: 72 },
  colPrice: { width: 72 },
  colMatch: { flex: 1.2, minWidth: 120, paddingLeft: 6 },
  checkText: { fontSize: 18, color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
    marginHorizontal: 2,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  matchText: { fontSize: 12, color: colors.inkMuted },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  writeBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  writeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  writeBtnSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
});
