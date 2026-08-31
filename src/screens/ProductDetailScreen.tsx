import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceSelect } from '../components/PlaceSelect';
import { ProductThumb } from '../components/ProductThumb';
import { productImageSource } from '../data/seedKruoka';
import { useInventory } from '../data/store';
import type { RootStackParamList } from '../data/types';
import { INGREDIENT_TYPE_LABELS, UNIT_LABELS } from '../data/units';
import { useI18n, type MessageKey } from '../i18n';
import { FOOD_ALV_RATE, foodAlvPercentLabel, withFoodAlv } from '../lib/alv';
import { alertAck, alertInfo } from '../lib/alertAck';
import { enrichCatalogImages } from '../lib/catalogImageEnrichment';
import {
  compareProductPrices,
  formatEur,
  partitionCatalogDistributorRows,
  type CompetitorRow,
  type CompetitorSourceId,
  type PriceComparisonResult,
} from '../lib/priceComparison';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

function sourceTitle(id: CompetitorSourceId, t: (k: MessageKey) => string): string {
  switch (id) {
    case 'kruoka':
      return t('priceCompareSourceKruoka');
    case 'skaupat':
      return t('priceCompareSourceSkaupat');
    case 'lidl':
      return t('priceCompareSourceLidl');
    case 'aimo':
      return t('priceCompareSourceAimo');
    case 'vihannesporssi':
      return t('priceCompareSourceVihannes');
  }
}

function availabilityLabel(
  row: CompetitorRow,
  t: (k: MessageKey) => string,
): string {
  switch (row.availability) {
    case 'live':
      return t('priceCompareAvailLive');
    case 'seed':
      return t('priceCompareAvailSeed');
    case 'manual':
      return t('priceCompareAvailManual');
    default:
      return t('priceCompareAvailLink');
  }
}

function formatAsOfDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'fi' ? 'fi-FI' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function openUrl(url: string) {
  void Linking.openURL(url);
}

function DistributorCard({
  row,
  comparedAt,
  showWithAlv,
  alvPct,
  locale,
  t,
}: {
  row: CompetitorRow;
  comparedAt?: string;
  showWithAlv: boolean;
  alvPct: string;
  locale: string;
  t: (k: MessageKey) => string;
}) {
  const displayAlv0 = row.unitPriceAlv0;
  const displayAmount =
    displayAlv0 != null && displayAlv0 > 0
      ? withFoodAlv(displayAlv0, showWithAlv)
      : undefined;

  return (
    <View style={styles.compCard}>
      <View style={styles.compHead}>
        <Text style={styles.compTitle}>{sourceTitle(row.id, t)}</Text>
        <Text style={styles.compAvail}>{availabilityLabel(row, t)}</Text>
      </View>

      {row.matchedName ? (
        <Text style={styles.matched}>
          {t('priceCompareMatchedAs').replace('{name}', row.matchedName)}
          {row.packSize ? ` · ${row.packSize}` : ''}
        </Text>
      ) : (
        <Text style={styles.matchedMuted}>
          {row.id === 'aimo' || row.id === 'vihannesporssi'
            ? t('priceCompareWholesaleHint')
            : row.id === 'lidl'
              ? t('priceCompareRetailLinkHint')
              : t('priceCompareNoLiveMatch')}
        </Text>
      )}

      {displayAmount != null ? (
        <>
          <Text style={styles.compPrice}>
            {formatEur(displayAmount)}{' '}
            <Text style={styles.ourSuffix}>
              {showWithAlv ? t('alvWith') : t('priceCompareAlv0')}
            </Text>
          </Text>
          {row.shelfPriceEur != null && !showWithAlv ? (
            <Text style={styles.compShelf}>
              {row.shelfIncludesAlv
                ? t('priceCompareRetailInclAlv')
                    .replace('{pct}', alvPct)
                    .replace('{amount}', formatEur(row.shelfPriceEur))
                : t('priceCompareWholesaleNet').replace(
                    '{amount}',
                    formatEur(row.shelfPriceEur),
                  )}
            </Text>
          ) : null}
          {comparedAt ? (
            <Text style={styles.lastUpdated}>
              {t('catalogDetailLastUpdated').replace(
                '{date}',
                formatAsOfDate(comparedAt, locale),
              )}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.placeholder}>
          {t('catalogDetailNoDistributorPrice')}
        </Text>
      )}

      <Pressable
        style={styles.linkBtn}
        onPress={() => openUrl(row.sourceUrl)}
        accessibilityRole="link"
      >
        <Text style={styles.linkBtnText}>{t('priceCompareOpenLink')}</Text>
      </Pressable>
    </View>
  );
}

export function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const insets = useSafeAreaInsets();
  const {
    products,
    places,
    activePlaceId,
    setActivePlaceId,
    addQuantity,
    updateProductCatalogFields,
  } = useInventory();
  const { t, locale } = useI18n();
  const product = products.find((p) => p.id === productId);

  const [result, setResult] = useState<PriceComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showWithAlv, setShowWithAlv] = useState(false);
  const [packSizeDraft, setPackSizeDraft] = useState('');
  const [qtyDraft, setQtyDraft] = useState('1');
  const [placeId, setPlaceId] = useState(activePlaceId);
  const [imageBusy, setImageBusy] = useState(false);

  const alvPct = foodAlvPercentLabel();

  useEffect(() => {
    if (!product) return;
    setPackSizeDraft(product.packSize ?? '');
  }, [product?.id, product?.packSize]);

  useEffect(() => {
    setPlaceId(activePlaceId);
  }, [activePlaceId]);

  // Pull a retail packshot when this SKU still has none.
  useEffect(() => {
    if (!product || productImageSource(product)) return;
    const signal = { cancelled: false };
    setImageBusy(true);
    void enrichCatalogImages([product], updateProductCatalogFields, {
      delayMs: 0,
      limit: 1,
      signal,
    }).finally(() => {
      if (!signal.cancelled) setImageBusy(false);
    });
    return () => {
      signal.cancelled = true;
    };
  }, [product?.id, product?.imageUrl, updateProductCatalogFields]);

  const loadPrices = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    setError(null);
    try {
      const next = await compareProductPrices(
        product,
        undefined,
        refreshNonce > 0 ? { forceRefresh: true } : undefined,
      );
      setResult(next);
    } catch {
      setError(t('priceCompareRefreshError'));
    } finally {
      setLoading(false);
    }
  }, [product, refreshNonce, t]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    if (product) {
      navigation.setOptions({ title: product.officialName });
    }
  }, [navigation, product]);

  const partitioned = useMemo(
    () =>
      result
        ? partitionCatalogDistributorRows(result.rows)
        : { primary: [], other: [] },
    [result],
  );

  function savePackSize() {
    if (!product) return;
    const next = packSizeDraft.trim();
    if (next === (product.packSize ?? '').trim()) return;
    updateProductCatalogFields(product.id, { packSize: next || null });
  }

  function addToInventory() {
    if (!product) return;
    const n = Number(qtyDraft.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      alertInfo(t('catalogDetailTitle'), t('catalogDetailAddNeedQty'));
      return;
    }
    setActivePlaceId(placeId);
    addQuantity({
      productId: product.id,
      delta: n,
      placeId,
      notes: 'Catalog detail',
      source: 'manual',
    });
    const placeName =
      places.find((p) => p.id === placeId)?.name ?? placeId;
    alertAck(
      t('catalogDetailAddToInventory'),
      t('catalogDetailAddDone')
        .replace('{qty}', String(n).replace('.', ','))
        .replace('{unit}', product.unit)
        .replace('{place}', placeName),
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.missing}>{t('catalogDetailMissing')}</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.linkBtn}
          accessibilityRole="button"
        >
          <Text style={styles.linkBtnText}>{t('catalogDetailBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const ourDisplay = withFoodAlv(product.unitPriceAlv0, showWithAlv);
  const withAlvShelf =
    Math.round(product.unitPriceAlv0 * (1 + FOOD_ALV_RATE) * 100) / 100;
  const place = places.find((p) => p.id === placeId);
  const betaTitle =
    Platform.OS === 'web'
      ? ({ title: t('catalogImageBetaDisclaimer') } as Record<string, string>)
      : {};

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View {...betaTitle}>
          <ProductThumb product={product} size={120} />
          {imageBusy && !productImageSource(product) ? (
            <Text style={styles.imageBusy}>
              {t('catalogDetailFetchingImage')}
            </Text>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{product.officialName}</Text>
          <Text style={styles.heroMeta}>
            {INGREDIENT_TYPE_LABELS[product.ingredientType]} · {product.unit}
            {product.packSize ? ` · ${product.packSize}` : ''}
          </Text>
          <Text style={styles.betaHint} {...betaTitle}>
            {t('catalogImageBeta')} · {t('catalogImageBetaBanner')}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.quickTitle}>{t('catalogDetailAddToInventory')}</Text>
        {places.length > 0 ? (
          <PlaceSelect
            places={places}
            selectedId={placeId}
            onSelect={setPlaceId}
            label={t('placesCountingAt')}
            flush
            compact
          />
        ) : null}
        <View style={styles.quickRow}>
          <View style={styles.quickField}>
            <Text style={styles.metaLabel}>{t('catalogDetailAmount')}</Text>
            <TextInput
              value={qtyDraft}
              onChangeText={setQtyDraft}
              keyboardType="decimal-pad"
              placeholder={t('catalogDetailAmountPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              style={styles.quickInput}
            />
          </View>
          <View style={styles.quickField}>
            <Text style={styles.metaLabel}>
              {t('catalogDetailPackSizeEdit')}
            </Text>
            <TextInput
              value={packSizeDraft}
              onChangeText={setPackSizeDraft}
              onBlur={savePackSize}
              placeholder={t('catalogDetailPackSizePlaceholder')}
              placeholderTextColor={colors.inkFaint}
              style={styles.quickInput}
            />
          </View>
        </View>
        <Pressable
          onPress={addToInventory}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>
            {t('catalogDetailAddToInventory')}
            {place ? ` · ${place.name}` : ''}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <MetaRow
          label={t('catalogDetailUnit')}
          value={UNIT_LABELS[product.unit]}
        />
        <MetaRow
          label={t('catalogDetailPackSize')}
          value={product.packSize?.trim() || t('catalogDetailEmDash')}
        />
        <MetaRow
          label={t('catalogDetailEan')}
          value={product.ean?.trim() || t('catalogDetailEmDash')}
        />
        <MetaRow
          label={t('catalogDetailProductCode')}
          value={product.productCode?.trim() || t('catalogDetailEmDash')}
        />
        <MetaRow
          label={t('catalogDetailAliases')}
          value={
            product.aliases.length > 0
              ? product.aliases.join(', ')
              : t('catalogDetailEmDash')
          }
        />
        {product.sourceUrl ? (
          <Pressable
            onPress={() => openUrl(product.sourceUrl!)}
            style={styles.sourceLink}
            accessibilityRole="link"
          >
            <Text style={styles.sourceLinkText}>
              {t('catalogDetailOpenSource')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.alvRow}>
        <Pressable
          style={[styles.alvChip, !showWithAlv && styles.alvChipOn]}
          onPress={() => setShowWithAlv(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !showWithAlv }}
        >
          <Text
            style={[styles.alvChipText, !showWithAlv && styles.alvChipTextOn]}
          >
            {t('alvZero')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.alvChip, showWithAlv && styles.alvChipOn]}
          onPress={() => setShowWithAlv(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: showWithAlv }}
          accessibilityHint={t('catalogDetailAlvToggleHint').replace(
            '{rate}',
            alvPct,
          )}
        >
          <Text
            style={[styles.alvChipText, showWithAlv && styles.alvChipTextOn]}
          >
            {t('alvWith')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('catalogDetailOurPrice')}</Text>
        <Text style={styles.ourPrice}>
          {formatEur(ourDisplay)}{' '}
          <Text style={styles.ourSuffix}>
            {showWithAlv ? t('alvWith') : t('priceCompareAlv0')}
          </Text>
        </Text>
        {!showWithAlv ? (
          <Text style={styles.ourRetail}>
            {t('priceCompareOurPriceWithAlv')
              .replace('{pct}', alvPct)
              .replace('{amount}', formatEur(withAlvShelf))}
          </Text>
        ) : null}
        <Text style={styles.priceNote}>{t('catalogDetailPriceNote')}</Text>
      </View>

      <View style={styles.distribHead}>
        <Text style={styles.sectionTitle}>{t('catalogDetailDistributors')}</Text>
        <Text style={styles.distribSub}>{t('catalogDetailDistributorsSub')}</Text>
        <View style={styles.refreshRow}>
          {result?.comparedAt ? (
            <Text style={styles.asOf}>
              {t('priceCompareAsOf').replace(
                '{date}',
                formatAsOfDate(result.comparedAt, locale),
              )}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
            onPress={() => setRefreshNonce((n) => n + 1)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('priceCompareRefresh')}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.refreshBtnText}>
                {t('priceCompareRefresh')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {loading && !result ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('priceCompareLookingUp')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => setRefreshNonce((n) => n + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.errorRetry}>{t('priceCompareRefresh')}</Text>
          </Pressable>
        </View>
      ) : null}

      {result ? (
        <>
          <Text style={styles.groupTitle}>{t('catalogDetailPrimaryCols')}</Text>
          {partitioned.primary.map((row) => (
            <DistributorCard
              key={row.id}
              row={row}
              comparedAt={result.comparedAt}
              showWithAlv={showWithAlv}
              alvPct={alvPct}
              locale={locale}
              t={t}
            />
          ))}

          {partitioned.other.length > 0 ? (
            <>
              <Text style={styles.groupTitle}>
                {t('catalogDetailOtherSources')}
              </Text>
              {partitioned.other.map((row) => (
                <DistributorCard
                  key={row.id}
                  row={row}
                  comparedAt={result.comparedAt}
                  showWithAlv={showWithAlv}
                  alvPct={alvPct}
                  locale={locale}
                  t={t}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <Text style={styles.footerNote}>{t('catalogDetailFooter')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  missing: { color: colors.inkMuted, fontSize: 15, textAlign: 'center' },
  hero: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  heroMeta: { marginTop: 4, fontSize: 13, color: colors.inkMuted },
  betaHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkFaint,
  },
  imageBusy: {
    marginTop: 6,
    fontSize: 11,
    color: colors.inkFaint,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickField: { flex: 1 },
  quickInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  addBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  metaRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    marginTop: 4,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 20,
  },
  sourceLink: { marginTop: spacing.md, alignSelf: 'flex-start' },
  sourceLinkText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  alvRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  alvChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  alvChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  alvChipText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  alvChipTextOn: { color: '#fff' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  ourPrice: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  ourSuffix: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  ourRetail: { marginTop: 4, fontSize: 13, color: colors.inkMuted },
  priceNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.inkFaint,
    lineHeight: 17,
  },
  distribHead: { marginBottom: spacing.sm },
  distribSub: {
    marginTop: 4,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  refreshRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  asOf: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  refreshBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    minWidth: 120,
    alignItems: 'center',
  },
  refreshBtnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  loading: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: { color: colors.inkMuted, fontSize: 14 },
  errorBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  errorRetry: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  groupTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  compCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  compHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1 },
  compAvail: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  matched: { marginTop: 6, fontSize: 13, color: colors.inkMuted },
  matchedMuted: { marginTop: 6, fontSize: 13, color: colors.inkFaint },
  compPrice: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  compShelf: { marginTop: 2, fontSize: 13, color: colors.inkMuted },
  lastUpdated: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  placeholder: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  linkBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  linkBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  footerNote: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.inkFaint,
    lineHeight: 17,
  },
});
