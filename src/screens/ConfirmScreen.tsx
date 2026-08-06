import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ProductSearchInput } from '../components/ProductSearchInput';
import { PackCheckModal } from '../components/PackCheckModal';
import { PlaceSelect } from '../components/PlaceSelect';
import { ProductThumb } from '../components/ProductThumb';
import { getStockQty, useInventory } from '../data/store';
import type {
  ProductMatch,
  RootStackParamList,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import { confirmIfRecentAdd } from '../lib/confirmIfRecentAdd';
import {
  bestExtractMatch,
  isIdentityCatalogMatch,
  isStrongCatalogMatch,
  matchExtractToCatalog,
} from '../lib/fuzzyMatch';
import {
  shouldShowPackCheck,
  type PackCheckInfo,
  type PackCheckResolve,
} from '../lib/packUnits';
import {
  enrichFromExtractAsync,
  enrichmentToExtract,
} from '../lib/productEnrichment';
import { formatClockTime } from '../lib/relativeTime';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirm'>;

const SUGGESTION_LIMIT = 8;
const SUGGESTIONS_VISIBLE_DEFAULT = 3;

function isDevOrStubNote(note: string): boolean {
  const n = note.toLowerCase();
  return (
    n.includes('stub') ||
    n.includes('offline demo') ||
    n.includes('gemini_api_key') ||
    n.includes('expo_public_') ||
    n.includes('not configured')
  );
}

export function ConfirmScreen({ route, navigation }: Props) {
  const { extract: routeExtract, imageUri } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    products,
    session,
    addQuantity,
    getRecentAddWarning,
    places,
    activePlaceId,
    setActivePlaceId,
    siteName,
    setProductPackInfo,
  } = useInventory();

  const [extract, setExtract] = useState<VisionExtract>(routeExtract);
  const [enriching, setEnriching] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Unrecognized / low-confidence photos: don't invent Figaro via seed lookup
        if (
          routeExtract.unrecognized &&
          !routeExtract.ean &&
          routeExtract.confidence < 0.45
        ) {
          if (!cancelled) setEnriching(false);
          return;
        }
        const enrichment = await enrichFromExtractAsync(routeExtract, products);
        if (cancelled) return;
        const next = enrichmentToExtract(enrichment);
        setExtract({
          ...next,
          quantity: routeExtract.quantity ?? next.quantity,
          expiryDate: routeExtract.expiryDate ?? next.expiryDate,
          crop: routeExtract.crop ?? next.crop,
          confidence: Math.max(routeExtract.confidence, next.confidence),
          unrecognized: routeExtract.unrecognized || next.unrecognized,
          rawNotes: [routeExtract.rawNotes, enrichment.notes]
            .filter(Boolean)
            .join(' · '),
        });
      } finally {
        if (!cancelled) setEnriching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot catalog enrich
  }, []);

  const initialMatch = useMemo(() => {
    const hit = bestExtractMatch(products, extract);
    if (!hit) return null;
    if (extract.unrecognized && hit.score < 0.85) return null;
    return hit;
  }, [products, extract]);
  const suggestions = useMemo(() => {
    const list = matchExtractToCatalog(products, extract, SUGGESTION_LIMIT);
    if (extract.unrecognized) {
      return list.filter((m) => m.score >= 0.55);
    }
    return list;
  }, [products, extract]);
  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, SUGGESTIONS_VISIBLE_DEFAULT);
  const hasMoreSuggestions = suggestions.length > SUGGESTIONS_VISIBLE_DEFAULT;

  const [selected, setSelected] = useState<ProductMatch | null>(null);
  useEffect(() => {
    setSelected(initialMatch);
  }, [initialMatch]);

  const [qty, setQty] = useState(
    routeExtract.quantity != null ? String(routeExtract.quantity) : '1',
  );
  const [expiry, setExpiry] = useState(routeExtract.expiryDate ?? '');
  const [packCheck, setPackCheck] = useState<PackCheckInfo | null>(null);

  const strongMatch = isStrongCatalogMatch(selected);
  const identityMatch = isIdentityCatalogMatch(selected);
  const unmatched = !strongMatch;
  const onHand = selected
    ? getStockQty(session, selected.product.id, activePlaceId)
    : 0;

  const showRawNotes =
    Boolean(extract.rawNotes) &&
    !extract.unrecognized &&
    !unmatched &&
    !isDevOrStubNote(extract.rawNotes ?? '');

  const extractMeta = [
    extract.brand ? `${t('addProductBrand')}: ${extract.brand}` : null,
    extract.containerHint
      ? `${t('addProductContainer')}: ${extract.containerHint}`
      : null,
    extract.packSize
      ? `${t('addProductPackSize')}: ${extract.packSize}`
      : null,
    extract.ean ? `${t('addProductEan')}: ${extract.ean}` : null,
    extract.aliases?.length
      ? `${t('alsoAs')} ${extract.aliases.slice(0, 6).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  function commitSave(n: number) {
    if (!selected) return;
    const run = () => {
      const result = addQuantity({
        productId: selected.product.id,
        delta: n,
        placeId: activePlaceId,
        expiryDate: expiry.trim() || null,
      });
      const time = formatClockTime(
        result?.lastUpdatedAt ?? new Date().toISOString(),
      );
      const body = t('recordAddedSummary')
        .replace('{added}', String(n))
        .replace('{total}', String(result?.quantityAfter ?? n))
        .replace('{time}', time);
      alertAck(t('recordSavedTitle'), body, () => navigation.popToTop());
    };
    confirmIfRecentAdd(
      getRecentAddWarning(selected.product.id, activePlaceId),
      t,
      run,
    );
  }

  function confirm() {
    if (!selected) {
      alertInfo(t('confirmPickProductTitle'), t('confirmPickProductBody'));
      return;
    }
    const n = Number(qty.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) {
      alertInfo(t('qty'), t('confirmInvalidQty'));
      return;
    }
    const check = shouldShowPackCheck(
      selected.product,
      selected.product.unit,
      n,
    );
    if (check) {
      setPackCheck(check);
      return;
    }
    commitSave(n);
  }

  function onPackYes(resolved?: PackCheckResolve) {
    if (!packCheck || !selected) return;
    if (resolved?.unitsPerPack != null && resolved.unitsPerPack > 1) {
      setProductPackInfo(
        selected.product.id,
        resolved.unitsPerPack,
        resolved.packBaseUnit,
      );
    }
    const n = packCheck.packQty;
    setPackCheck(null);
    commitSave(n);
  }

  function onPackChangeToPieces(resolved?: PackCheckResolve) {
    if (!packCheck || !selected) return;
    if (resolved?.unitsPerPack != null && resolved.unitsPerPack > 1) {
      setProductPackInfo(
        selected.product.id,
        resolved.unitsPerPack,
        resolved.packBaseUnit,
      );
    }
    const n =
      packCheck.needsUnitsPerPack || packCheck.pieceQty == null
        ? packCheck.packQty
        : packCheck.pieceQty;
    setQty(String(n));
    setPackCheck(null);
    commitSave(n);
  }

  function openAddProduct() {
    navigation.navigate('AddProduct', {
      prefillName: extract.suggestedName,
      unit: extract.unit ?? undefined,
      packSize: extract.packSize ?? undefined,
      unitPriceAlv0: extract.unitPriceAlv0 ?? undefined,
      aliases: extract.aliases,
      ean: extract.ean ?? undefined,
      sourceUrl: extract.sourceUrl ?? undefined,
      imageUrl: extract.imageUrl ?? undefined,
      ingredientType: extract.ingredientType ?? undefined,
      brand: extract.brand ?? undefined,
      containerHint: extract.containerHint ?? undefined,
      photoUris: imageUri ? [imageUri] : undefined,
      returnToConfirm: true,
      extract,
      imageUri,
    });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.kicker}>{t('confirmBeforeWrite')}</Text>
      <Text style={styles.title}>{t('fridgeIsThisProduct')}</Text>
      <Text style={styles.sub}>
        {t('confirmModelSaid')
          .replace('{name}', extract.suggestedName)
          .replace('{pct}', String(Math.round(extract.confidence * 100)))}
      </Text>

      {enriching ? (
        <View style={styles.enrichRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.enrichText}>{t('confirmEnriching')}</Text>
        </View>
      ) : null}

      {places.length > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
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

      <View style={styles.matchPair}>
        <View style={styles.matchCol}>
          <CroppedImage
            uri={imageUri}
            crop={extract.crop}
            size={108}
            fallbackColor={extract.crop?.previewColor}
          />
          <Text style={styles.matchCap}>{t('fridgeDetectedCrop')}</Text>
        </View>
        <Text style={styles.matchArrow}>→</Text>
        <View style={styles.matchCol}>
          {selected ? (
            <ProductThumb product={selected.product} size={108} />
          ) : (
            <View style={styles.packPlaceholder} />
          )}
          <Text style={styles.matchCap}>{t('fridgeOfficialPhoto')}</Text>
        </View>
      </View>

      {strongMatch && selected ? (
        <View
          style={styles.alreadyBox}
          accessibilityRole="summary"
          accessibilityLabel={t('confirmAlreadyHaveTitle')}
        >
          <Text style={styles.alreadyTitle}>
            {identityMatch
              ? t('confirmAlreadyHaveTitle')
              : t('confirmStrongMatchTitle')}
          </Text>
          <Text style={styles.alreadyBody}>
            {t('confirmAlreadyHaveBody')
              .replace('{name}', selected.product.officialName)
              .replace('{pct}', String(Math.round(selected.score * 100)))
              .replace('{qty}', String(onHand))
              .replace('{unit}', selected.product.unit)}
          </Text>
        </View>
      ) : (
        <View
          style={styles.notHaveBox}
          accessibilityRole="summary"
          accessibilityLabel={t('confirmNotHaveTitle')}
        >
          <Text style={styles.notHaveTitle}>{t('confirmNotHaveTitle')}</Text>
          <Text style={styles.notHaveBody}>{t('confirmNotHaveBody')}</Text>
          <Pressable
            style={styles.addPrimary}
            onPress={openAddProduct}
            accessibilityRole="button"
            accessibilityLabel={t('confirmAddToCatalog')}
          >
            <Text style={styles.addPrimaryText}>{t('confirmAddToCatalog')}</Text>
          </Pressable>
        </View>
      )}

      {extractMeta ? (
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>{t('confirmExtractMeta')}</Text>
          <Text style={styles.metaBody}>{extractMeta}</Text>
        </View>
      ) : null}

      {showRawNotes ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{extract.rawNotes}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>{t('confirmSuggestedMatches')}</Text>
      {suggestions.length === 0 ? (
        <Text style={styles.empty}>{t('confirmNoCatalogHit')}</Text>
      ) : (
        <>
          {visibleSuggestions.map((m) => {
            const on = selected?.product.id === m.product.id;
            const stock = getStockQty(session, m.product.id, activePlaceId);
            return (
              <Pressable
                key={m.product.id}
                onPress={() => setSelected(m)}
                style={[styles.matchRow, on && styles.matchRowOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <ProductThumb product={m.product} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchName}>{m.product.officialName}</Text>
                  <Text style={styles.matchMeta}>
                    {m.product.unit}
                    {m.product.packSize ? ` · ${m.product.packSize}` : ''} · via “
                    {m.matchedTerm}” ({Math.round(m.score * 100)}%)
                    {stock > 0
                      ? ` · ${t('confirmOnHand').replace('{qty}', String(stock))}`
                      : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {hasMoreSuggestions ? (
            <Pressable
              onPress={() => setShowAllSuggestions((v) => !v)}
              style={styles.seeMore}
              accessibilityRole="button"
              accessibilityLabel={
                showAllSuggestions
                  ? t('confirmSeeFewerSuggestions')
                  : t('confirmSeeMoreSuggestions')
              }
            >
              <Text style={styles.seeMoreText}>
                {showAllSuggestions
                  ? t('confirmSeeFewerSuggestions')
                  : t('confirmSeeMoreSuggestions')}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>
        {t('confirmSearchChange')}
      </Text>
      <ProductSearchInput
        products={products}
        initialQuery={extract.suggestedName}
        onSelect={(m) => setSelected(m)}
      />

      {strongMatch ? (
        <Pressable style={styles.addBtnGhost} onPress={openAddProduct}>
          <Text style={styles.addBtnGhostText}>{t('confirmAddDifferent')}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>{t('qty')}</Text>
      <TextInput
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.label}>{t('confirmExpiryOptional')}</Text>
      <TextInput
        value={expiry}
        onChangeText={setExpiry}
        autoCapitalize="none"
        style={styles.input}
        placeholder="2026-08-15"
        placeholderTextColor={colors.inkFaint}
      />

      <Pressable style={styles.save} onPress={confirm}>
        <Text style={styles.saveText}>
          {strongMatch
            ? t('confirmUseExisting')
            : `${t('fridgeYes')} · ${t('confirmStock')}`}
        </Text>
      </Pressable>

      <PackCheckModal
        visible={packCheck != null}
        info={packCheck}
        onYesPacks={onPackYes}
        onChangeToPieces={onPackChangeToPieces}
        onEdit={() => setPackCheck(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: { color: colors.inkMuted, marginTop: 6, fontSize: 14, lineHeight: 20 },
  enrichRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  enrichText: { color: colors.inkMuted, fontSize: 13 },
  matchPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    width: 108,
    height: 108,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.primarySoft,
  },
  alreadyBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  alreadyTitle: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  alreadyBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  notHaveBox: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  notHaveTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  notHaveBody: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  addPrimary: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  metaBox: {
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaBody: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  note: {
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noteText: { color: colors.warning, fontSize: 13, lineHeight: 18 },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  empty: { color: colors.inkMuted },
  matchRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  matchRowOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  matchName: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  matchMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  seeMore: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  seeMoreText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  addBtnGhost: {
    marginTop: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnGhostText: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  save: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
