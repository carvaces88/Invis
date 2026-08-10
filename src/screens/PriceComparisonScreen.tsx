import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { ProductThumb } from '../components/ProductThumb';
import { useInventory } from '../data/store';
import type { Product } from '../data/types';
import { useI18n, type MessageKey } from '../i18n';
import { FOOD_ALV_RATE, foodAlvPercentLabel } from '../lib/alv';
import {
  alv0FromRetailShelf,
  compareProductPrices,
  formatEur,
  priceDiffAlv0,
  type CompetitorRow,
  type CompetitorSourceId,
  type PriceComparisonResult,
} from '../lib/priceComparison';
import { colors, radius, spacing } from '../theme/colors';

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
  });
}

function applyManualOverrides(
  base: PriceComparisonResult,
  drafts: Partial<Record<CompetitorSourceId, string>>,
): PriceComparisonResult {
  return {
    ...base,
    rows: base.rows.map((row) => {
      const raw = (drafts[row.id] ?? '').trim().replace(',', '.');
      if (!raw) return row;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return row;
      const unitPriceAlv0 = row.shelfIncludesAlv
        ? alv0FromRetailShelf(n)
        : Math.round(n * 100) / 100;
      return {
        ...row,
        shelfPriceEur: n,
        unitPriceAlv0,
        availability: 'manual' as const,
      };
    }),
  };
}

function DiffLine({
  ourAlv0,
  competitorAlv0,
}: {
  ourAlv0: number;
  competitorAlv0?: number;
}) {
  const { t } = useI18n();
  const diff = priceDiffAlv0(ourAlv0, competitorAlv0);
  if (diff == null) {
    return (
      <Text style={styles.diffMuted}>{t('priceCompareNoCompetitorPrice')}</Text>
    );
  }
  if (Math.abs(diff) < 0.005) {
    return <Text style={styles.diffSame}>{t('priceCompareDiffSame')}</Text>;
  }
  if (diff < 0) {
    return (
      <Text style={styles.diffGood}>
        {t('priceCompareDiffCheaper').replace(
          '{amount}',
          formatEur(Math.abs(diff)),
        )}
      </Text>
    );
  }
  return (
    <Text style={styles.diffBad}>
      {t('priceCompareDiffDearer').replace('{amount}', formatEur(diff))}
    </Text>
  );
}

export function PriceComparisonScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { products } = useInventory();
  const alvPct = foodAlvPercentLabel();

  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [baseResult, setBaseResult] = useState<PriceComparisonResult | null>(
    null,
  );
  const [manualDraft, setManualDraft] = useState<
    Partial<Record<CompetitorSourceId, string>>
  >({});

  useEffect(() => {
    if (!selected) {
      setBaseResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const forceRefresh = refreshNonce > 0;
    compareProductPrices(
      selected,
      undefined,
      forceRefresh ? { forceRefresh: true } : undefined,
    )
      .then((r) => {
        if (!cancelled) setBaseResult(r);
      })
      .catch(() => {
        if (!cancelled) {
          // Keep prior rows if any — never invent replacement prices
          setError(t('priceCompareRefreshError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, refreshNonce, t]);

  const result = useMemo(
    () => (baseResult ? applyManualOverrides(baseResult, manualDraft) : null),
    [baseResult, manualDraft],
  );

  const openUrl = (url: string) => {
    void Linking.openURL(url);
  };

  const onRefresh = () => {
    if (!selected || loading) return;
    setManualDraft({});
    setRefreshNonce((n) => n + 1);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>{t('priceCompareTitle')}</Text>
      <Text style={styles.intro}>{t('priceCompareIntro')}</Text>

      <Text style={styles.label}>{t('priceCompareSearch')}</Text>
      <ProductSearchInput
        products={products}
        placeholder={t('priceCompareSearchPlaceholder')}
        onSelect={(match) => {
          setSelected(match.product);
          setManualDraft({});
          setRefreshNonce(0);
          setError(null);
        }}
      />

      {!selected ? (
        <Text style={styles.hint}>{t('priceComparePickProduct')}</Text>
      ) : (
        <View style={styles.selectedCard}>
          <View style={styles.selectedRow}>
            <ProductThumb product={selected} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName}>{selected.officialName}</Text>
              <Text style={styles.selectedMeta}>
                {selected.unit}
                {selected.packSize ? ` · ${selected.packSize}` : ''}
                {selected.ean ? ` · EAN ${selected.ean}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setSelected(null);
                setBaseResult(null);
                setManualDraft({});
                setRefreshNonce(0);
                setError(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.clear}>{t('priceCompareClear')}</Text>
            </Pressable>
          </View>

          <View style={styles.ourBox}>
            <Text style={styles.ourLabel}>{t('priceCompareOurPrice')}</Text>
            <Text style={styles.ourPrice}>
              {formatEur(selected.unitPriceAlv0)}{' '}
              <Text style={styles.ourSuffix}>{t('priceCompareAlv0')}</Text>
            </Text>
            <Text style={styles.ourRetail}>
              {t('priceCompareOurPriceWithAlv')
                .replace('{pct}', alvPct)
                .replace(
                  '{amount}',
                  formatEur(
                    Math.round(
                      selected.unitPriceAlv0 * (1 + FOOD_ALV_RATE) * 100,
                    ) / 100,
                  ),
                )}
            </Text>
          </View>

          <View style={styles.refreshRow}>
            {baseResult?.comparedAt ? (
              <Text style={styles.asOf}>
                {t('priceCompareAsOf').replace(
                  '{date}',
                  formatAsOfDate(baseResult.comparedAt, locale),
                )}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable
              style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
              onPress={onRefresh}
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
      )}

      {selected && loading && !result ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('priceCompareLookingUp')}</Text>
        </View>
      ) : null}

      {selected && loading && result ? (
        <View style={styles.loadingInline}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('priceCompareRefreshing')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {selected ? (
            <Pressable onPress={onRefresh} accessibilityRole="button">
              <Text style={styles.errorRetry}>{t('priceCompareRefresh')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {result
        ? result.rows.map((row) => (
            <View key={row.id} style={styles.compCard}>
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

              {row.unitPriceAlv0 != null && row.unitPriceAlv0 > 0 ? (
                <>
                  <Text style={styles.compPrice}>
                    {formatEur(row.unitPriceAlv0)}{' '}
                    <Text style={styles.ourSuffix}>{t('priceCompareAlv0')}</Text>
                  </Text>
                  {row.shelfPriceEur != null ? (
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
                  <DiffLine
                    ourAlv0={result.ourAlv0}
                    competitorAlv0={row.unitPriceAlv0}
                  />
                </>
              ) : (
                <Text style={styles.diffMuted}>
                  {t('priceCompareNoCompetitorPrice')}
                </Text>
              )}

              <Text style={styles.pasteLabel}>{t('priceComparePastePrice')}</Text>
              <Text style={styles.pasteHint}>
                {row.shelfIncludesAlv
                  ? t('priceComparePasteHintRetail').replace('{pct}', alvPct)
                  : t('priceComparePasteHintWholesale')}
              </Text>
              <TextInput
                value={manualDraft[row.id] ?? ''}
                onChangeText={(text) =>
                  setManualDraft((prev) => ({ ...prev, [row.id]: text }))
                }
                placeholder={t('priceComparePastePlaceholder')}
                placeholderTextColor={colors.inkFaint}
                keyboardType="decimal-pad"
                style={styles.pasteInput}
              />

              <Pressable
                style={styles.linkBtn}
                onPress={() => openUrl(row.sourceUrl)}
                accessibilityRole="link"
              >
                <Text style={styles.linkBtnText}>{t('priceCompareOpenLink')}</Text>
              </Pressable>
            </View>
          ))
        : null}

      {selected && !loading ? (
        <Text style={styles.footerNote}>{t('priceCompareFooterNote')}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  intro: {
    marginTop: 8,
    marginBottom: spacing.md,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  hint: {
    marginTop: spacing.lg,
    color: colors.inkFaint,
    fontSize: 14,
  },
  selectedCard: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  selectedMeta: { marginTop: 2, fontSize: 12, color: colors.inkMuted },
  clear: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  ourBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  ourLabel: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  ourPrice: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  ourSuffix: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  ourRetail: { marginTop: 4, fontSize: 13, color: colors.inkMuted },
  refreshRow: {
    marginTop: spacing.md,
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
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingInline: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: { color: colors.inkMuted, fontSize: 14 },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  errorRetry: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  compCard: {
    marginTop: spacing.md,
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
  diffMuted: { marginTop: 6, fontSize: 13, color: colors.inkFaint },
  diffSame: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  diffGood: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  diffBad: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  pasteLabel: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  pasteHint: { marginTop: 2, fontSize: 12, color: colors.inkFaint },
  pasteInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
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
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.inkFaint,
    lineHeight: 17,
  },
});
