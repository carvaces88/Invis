import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
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
import { UNIT_CODES, UNIT_GUIDE } from '../data/units';
import type {
  Product,
  ProductMatch,
  RootStackParamList,
  UnitCode,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertConfirm, alertInfo } from '../lib/alertAck';
import {
  bestExtractMatch,
  isStrongCatalogMatch,
  searchProducts,
} from '../lib/fuzzyMatch';
import { formatProductDisplayName } from '../lib/formatProductDisplayName';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SheetImportReview'>;

type SortMode =
  | 'sheet'
  | 'az'
  | 'za'
  | 'qty'
  | 'priceAsc'
  | 'priceDesc'
  | 'totalAsc'
  | 'totalDesc';

type DraftRow = {
  key: string;
  index: number;
  extract: VisionExtract;
  /** Confirmed catalog product (or null → add as new) */
  match: ProductMatch | null;
  /** Best auto suggestion — may be weak; shown in picker until confirmed/rejected */
  suggestion: ProductMatch | null;
  name: string;
  unit: UnitCode;
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

/** Short / generic sheet names need a near-identity match — never Farini→chicken. */
function sheetAutoMatch(
  products: Product[],
  extract: VisionExtract,
): { suggestion: ProductMatch | null; match: ProductMatch | null } {
  const suggestion = bestExtractMatch(products, extract);
  if (!suggestion) return { suggestion: null, match: null };

  const name = (extract.suggestedName || '').trim();
  const tokenCount = name.split(/\s+/).filter(Boolean).length;
  const shortName = name.length <= 10 || tokenCount <= 1;
  const strongEnough = shortName
    ? suggestion.score >= 0.92
    : isStrongCatalogMatch(suggestion, extract);

  // Require the suggested catalog name to share a meaningful token with OCR
  const ocrTokens = new Set(
    name
      .toLocaleLowerCase('fi-FI')
      .split(/[^a-zà-öø-ÿ0-9]+/i)
      .filter((t) => t.length >= 3),
  );
  const catalogTokens = suggestion.product.officialName
    .toLocaleLowerCase('fi-FI')
    .split(/[^a-zà-öø-ÿ0-9]+/i)
    .filter((t) => t.length >= 3);
  const sharesToken =
    ocrTokens.size === 0 ||
    catalogTokens.some((t) => ocrTokens.has(t));

  const match =
    strongEnough && sharesToken ? suggestion : null;
  return { suggestion: sharesToken ? suggestion : null, match };
}

function unitOptionLabel(
  code: UnitCode,
  locale: 'en' | 'fi',
): string {
  const row = UNIT_GUIDE.find((r) => r.code === code);
  if (!row) return code;
  const name = locale === 'fi' ? row.fiName : row.enName.split(' / ')[0];
  return `${code} · ${name}`;
}

function SheetUnitSelect({
  value,
  onChange,
}: {
  value: UnitCode;
  onChange: (unit: UnitCode) => void;
}) {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.unitWrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.unitTrigger}
        accessibilityRole="button"
        accessibilityLabel={t('sheetImportColUnit')}
      >
        <Text style={styles.unitTriggerText} numberOfLines={1}>
          {unitOptionLabel(value, locale)}
        </Text>
        <Text style={styles.matchChevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('sheetImportUnitPickTitle')}</Text>
            <Text style={styles.sheetSub}>{t('sheetImportUnitPickSub')}</Text>
            <ScrollView
              style={styles.optionsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {UNIT_CODES.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  style={[
                    styles.option,
                    value === code && styles.optionOn,
                  ]}
                >
                  <Text style={styles.optionName}>
                    {unitOptionLabel(code, locale)}
                  </Text>
                  <Text style={styles.optionMeta}>
                    {locale === 'fi'
                      ? UNIT_GUIDE.find((r) => r.code === code)?.enName
                      : UNIT_GUIDE.find((r) => r.code === code)?.fiName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setOpen(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CatalogMatchPicker({
  products,
  row,
  onConfirm,
  onReject,
}: {
  products: Product[];
  row: DraftRow;
  onConfirm: (match: ProductMatch) => void;
  onReject: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.name);

  const results = useMemo(
    () => searchProducts(products, query.trim() || row.name, 12),
    [products, query, row.name],
  );

  const triggerLabel = row.match
    ? formatProductDisplayName(row.match.product.officialName)
    : t('sheetImportNoMatch');
  const weakHint =
    !row.match && row.suggestion
      ? t('sheetImportWeakSuggest').replace(
          '{name}',
          formatProductDisplayName(row.suggestion.product.officialName),
        )
      : null;

  function pick(match: ProductMatch) {
    onConfirm(match);
    setOpen(false);
  }

  function reject() {
    onReject();
    setOpen(false);
  }

  return (
    <View style={styles.matchWrap}>
      <Pressable
        onPress={() => {
          setQuery(row.name);
          setOpen(true);
        }}
        style={[
          styles.matchTrigger,
          !row.match && styles.matchTriggerWarn,
          row.match && styles.matchTriggerOk,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('sheetImportColMatch')}
      >
        <Text
          style={[styles.matchTriggerText, !row.match && styles.matchWarnText]}
          numberOfLines={2}
        >
          {triggerLabel}
        </Text>
        <Text style={styles.matchChevron}>▾</Text>
      </Pressable>
      {weakHint ? (
        <Text style={styles.weakHint} numberOfLines={1}>
          {weakHint}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {t('sheetImportMatchPickTitle')}
            </Text>
            <Text style={styles.sheetSub} numberOfLines={2}>
              {row.name}
            </Text>

            <Pressable
              onPress={reject}
              style={[
                styles.option,
                !row.match && styles.optionOn,
                styles.optionReject,
              ]}
            >
              <Text style={styles.optionRejectText}>
                {t('sheetImportNoMatch')}
              </Text>
              <Text style={styles.optionMeta}>
                {t('sheetImportNoMatchHint')}
              </Text>
            </Pressable>

            {row.suggestion ? (
              <Pressable
                onPress={() => pick(row.suggestion!)}
                style={[
                  styles.option,
                  row.match?.product.id === row.suggestion.product.id &&
                    styles.optionOn,
                ]}
              >
                <Text style={styles.optionName}>
                  {formatProductDisplayName(row.suggestion.product.officialName)}
                </Text>
                <Text style={styles.optionMeta}>
                  {t('sheetImportConfirmSuggest').replace(
                    '{pct}',
                    String(Math.round(row.suggestion.score * 100)),
                  )}
                </Text>
              </Pressable>
            ) : null}

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('sheetImportMatchSearch')}
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />

            <ScrollView
              style={styles.optionsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {results.map((m) => (
                <Pressable
                  key={m.product.id}
                  onPress={() => pick(m)}
                  style={[
                    styles.option,
                    row.match?.product.id === m.product.id && styles.optionOn,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>
                      {formatProductDisplayName(m.product.officialName)}
                    </Text>
                    <Text style={styles.optionMeta}>
                      {m.product.unit}
                      {m.matchedOn === 'alias'
                        ? ` · “${m.matchedTerm}”`
                        : ''}
                    </Text>
                  </View>
                  <Text style={styles.optionScore}>
                    {Math.round(m.score * 100)}%
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setOpen(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Desktop-friendly validation table: edit OCR rows, sort A–Z, write absolute stock.
 */
export function SheetImportReviewScreen({ route, navigation }: Props) {
  const { document, imageUri, imageUris } = route.params;
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
    savePriorStockList,
  } = useInventory();

  const [placeId, setPlaceId] = useState(activePlaceId);
  const [sortMode, setSortMode] = useState<SortMode>('sheet');
  const [busy, setBusy] = useState(false);
  /** Blocks a second Write after success (double-click / accidental re-apply). */
  const [writeDone, setWriteDone] = useState(false);
  const writingRef = useRef(false);

  const initial = useMemo<DraftRow[]>(
    () =>
      document.lines.map((extract, i) => {
        const { suggestion, match } = sheetAutoMatch(products, extract);
        return {
          key: `s-${i}-${extract.suggestedName}`,
          index: i,
          extract,
          match,
          suggestion,
          name: formatProductDisplayName(extract.suggestedName),
          unit: normalizeUnit(extract.unit ?? 'KPL'),
          qty:
            extract.quantity != null
              ? String(extract.quantity).replace('.', ',')
              : '',
          price:
            extract.unitPriceAlv0 != null
              ? String(extract.unitPriceAlv0).replace('.', ',')
              : '',
          included: extract.quantity != null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
    [document],
  );

  const [drafts, setDrafts] = useState(initial);

  const sortedDrafts = useMemo(() => {
    const rows = [...drafts];
    const lineTotal = (d: DraftRow) => {
      const q = parseFiNumber(d.qty);
      const p = parseFiNumber(d.price);
      if (q == null || p == null) return null;
      return Math.round(q * p * 100) / 100;
    };
    const byNum = (
      get: (d: DraftRow) => number | null,
      dir: 1 | -1,
    ) =>
      rows.sort((a, b) => {
        const av = get(a);
        const bv = get(b);
        const aMissing = av == null ? 1 : 0;
        const bMissing = bv == null ? 1 : 0;
        if (aMissing !== bMissing) return aMissing - bMissing;
        if (av != null && bv != null && av !== bv) {
          return (av - bv) * dir;
        }
        return a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' });
      });

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
    if (sortMode === 'priceAsc') {
      return byNum((d) => parseFiNumber(d.price), 1);
    }
    if (sortMode === 'priceDesc') {
      return byNum((d) => parseFiNumber(d.price), -1);
    }
    if (sortMode === 'totalAsc') {
      return byNum(lineTotal, 1);
    }
    if (sortMode === 'totalDesc') {
      return byNum(lineTotal, -1);
    }
    // qty: filled first, then by name
    return rows.sort((a, b) => {
      const aQ = a.qty.trim() ? 0 : 1;
      const bQ = b.qty.trim() ? 0 : 1;
      if (aQ !== bQ) return aQ - bQ;
      const aq = parseFiNumber(a.qty) ?? 0;
      const bq = parseFiNumber(b.qty) ?? 0;
      if (aq !== bq) return bq - aq;
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
      allSelected:
        drafts.length > 0 && drafts.every((d) => d.included),
    };
  }, [drafts]);

  function patch(key: string, next: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...next } : d)),
    );
  }

  function toggleSelectAll() {
    const next = !stats.allSelected;
    setDrafts((prev) => prev.map((d) => ({ ...d, included: next })));
  }

  function normalizeNameField(key: string, raw: string) {
    patch(key, { name: formatProductDisplayName(raw) });
  }

  function applySort(mode: SortMode) {
    setSortMode(mode);
  }

  function goHomeAfterWrite() {
    navigation.navigate('MainTabs', { screen: 'Home' });
  }

  function writeInventory(createMissing: boolean) {
    if (writeDone || writingRef.current || busy) {
      alertInfo(
        t('sheetImportAlreadyTitle'),
        t('sheetImportAlreadyBody'),
      );
      goHomeAfterWrite();
      return;
    }

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

    writingRef.current = true;
    setBusy(true);
    try {
      setActivePlaceId(placeId);
      let written = 0;
      let created = 0;
      const snapshotLines: {
        name: string;
        quantity: number | null;
        unit: UnitCode | null;
        aliases?: string[];
        matchedProductId?: string | null;
      }[] = [];

      for (const d of selected) {
        const qty = parseFiNumber(d.qty);
        const price = parseFiNumber(d.price);
        const unit = d.unit;
        let productId = d.match?.product.id;

        if (!productId && createMissing) {
          const product = addProduct({
            officialName:
              formatProductDisplayName(d.name) ||
              formatProductDisplayName(d.extract.suggestedName),
            unit,
            unitPriceAlv0: price ?? undefined,
            packSize: d.extract.packSize ?? undefined,
            aliases: d.extract.aliases ?? [],
            ingredientType: d.extract.ingredientType ?? undefined,
          });
          productId = product.id;
          created += 1;
        }
        if (!productId) {
          snapshotLines.push({
            name: formatProductDisplayName(d.name) || d.extract.suggestedName,
            quantity: qty,
            unit,
            aliases: d.extract.aliases,
            matchedProductId: null,
          });
          continue;
        }

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
        snapshotLines.push({
          name: formatProductDisplayName(d.name) || d.extract.suggestedName,
          quantity: qty,
          unit,
          aliases: d.extract.aliases,
          matchedProductId: productId,
        });
      }

      const sourceUris =
        imageUris?.filter(Boolean) ??
        (imageUri ? [imageUri] : []);
      savePriorStockList({
        id: `prior-${Date.now()}`,
        title: document.title || t('sheetImportTitle'),
        importedAt: new Date().toISOString(),
        placeId,
        sourceImageUris: sourceUris,
        lines: snapshotLines,
      });

      setWriteDone(true);
      alertAck(
        t('sheetImportDoneTitle'),
        t('sheetImportDoneBody')
          .replace('{written}', String(written))
          .replace('{created}', String(created)),
        goHomeAfterWrite,
      );
    } finally {
      writingRef.current = false;
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
              ['priceAsc', t('sheetImportSortPriceAsc')],
              ['priceDesc', t('sheetImportSortPriceDesc')],
              ['totalAsc', t('sheetImportSortTotalAsc')],
              ['totalDesc', t('sheetImportSortTotalDesc')],
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
        <Text style={styles.metaHint}>{t('sheetImportMatchHint')}</Text>
      </View>

      <ScrollView
        horizontal={!wide}
        style={styles.tableScroll}
        contentContainerStyle={{ minWidth: wide ? undefined : 860 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View style={styles.tableHead}>
            <Pressable
              onPress={toggleSelectAll}
              style={styles.colCheck}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: stats.allSelected }}
              accessibilityLabel={
                stats.allSelected
                  ? t('sheetImportUnselectAll')
                  : t('sheetImportSelectAll')
              }
              hitSlop={6}
            >
              <Text style={styles.checkText}>
                {stats.allSelected ? '☑' : '☐'}
              </Text>
            </Pressable>
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
                onBlur={() => normalizeNameField(d.key, d.name)}
                style={[styles.input, styles.colName]}
              />
              <SheetUnitSelect
                value={d.unit}
                onChange={(unit) => patch(d.key, { unit })}
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
              <View style={styles.colMatch}>
                <CatalogMatchPicker
                  products={products}
                  row={d}
                  onConfirm={(match) => patch(d.key, { match })}
                  onReject={() => patch(d.key, { match: null })}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          disabled={busy || writeDone}
          onPress={() => writeInventory(false)}
          style={({ pressed }) => [
            styles.writeBtn,
            pressed && { opacity: 0.9 },
            (busy || writeDone) && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.writeBtnText}>
            {writeDone ? t('sheetImportDoneTitle') : t('sheetImportWrite')}
          </Text>
          <Text style={styles.writeBtnSub}>
            {writeDone
              ? t('sheetImportAlreadyBody')
              : t('sheetImportWriteSub')}
          </Text>
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
  metaHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
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
  colUnit: { width: 118 },
  unitWrap: { width: 118, marginHorizontal: 2 },
  unitTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    minHeight: 36,
  },
  unitTriggerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  colQty: { width: 72 },
  colPrice: { width: 72 },
  colMatch: { flex: 1.4, minWidth: 160, paddingLeft: 6 },
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
  matchWrap: { flex: 1 },
  matchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    minHeight: 36,
  },
  matchTriggerWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  matchTriggerOk: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  matchTriggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  matchWarnText: { color: colors.warning },
  matchChevron: { fontSize: 12, color: colors.inkMuted },
  weakHint: {
    marginTop: 2,
    fontSize: 10,
    color: colors.inkFaint,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  sheetSub: {
    marginTop: 4,
    marginBottom: spacing.sm,
    fontSize: 14,
    color: colors.inkMuted,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  optionsScroll: { maxHeight: 320 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
    backgroundColor: colors.bg,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionReject: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  optionRejectText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.warning,
  },
  optionName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  optionMeta: { marginTop: 2, fontSize: 12, color: colors.inkMuted },
  optionScore: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cancelBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.inkMuted },
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
