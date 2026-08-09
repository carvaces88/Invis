import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { ImageZoomModal, type ImageZoomTarget } from '../components/ImageZoomModal';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { PackCheckModal } from '../components/PackCheckModal';
import { PlaceSelect } from '../components/PlaceSelect';
import { ProductThumb } from '../components/ProductThumb';
import {
  COMMON_UNIT_OPTIONS,
  MORE_UNIT_OPTIONS,
  friendlyOptionForCode,
  type FriendlyUnitOption,
} from '../data/units';
import { productImageSource } from '../data/seedKruoka';
import { getStockQty, useInventory } from '../data/store';
import type {
  Product,
  ProductMatch,
  RootStackParamList,
  UnitCode,
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
  visionCatalogTokenOverlap,
  visionContradictsProduct,
} from '../lib/fuzzyMatch';
import {
  friendlyOptionForBaseUnit,
  shouldShowPackCheck,
  type PackCheckInfo,
  type PackCheckResolve,
} from '../lib/packUnits';
import {
  enrichFromExtractAsync,
  enrichmentToExtract,
} from '../lib/productEnrichment';
import { formatClockTime } from '../lib/relativeTime';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, spacing } from '../theme/colors';

function unitOptionForProduct(
  product: Product | null,
  extractUnit?: UnitCode | null,
): FriendlyUnitOption {
  // Prefer vision/extract unit over catalog when staff photo says KPL etc.
  if (extractUnit) {
    const fromExtract = friendlyOptionForCode(extractUnit);
    if (fromExtract) return fromExtract;
  }
  if (product) {
    const fromProduct = friendlyOptionForCode(product.unit);
    if (fromProduct) return fromProduct;
  }
  return COMMON_UNIT_OPTIONS.find((o) => o.id === 'piece')!;
}

function mergeUniqueAliases(
  a?: string[] | null,
  b?: string[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...(a ?? []), ...(b ?? [])]) {
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw.trim());
  }
  return out;
}

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
  const { unitSystem, displayUnit, toStorageQty, formatQty } = useUnitSystem();
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
  const [zoomTarget, setZoomTarget] = useState<ImageZoomTarget>(null);

  // Always show the original vision label in “Model said …” (enrichment must
  // not rewrite cucumbers into a mayo catalog title).
  const visionLabel = routeExtract;

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
        // Always keep vision label fields; only fill gaps from catalog enrich.
        // Prevents “Korsnäs crate” brand sitting on a mayo officialName/EAN.
        setExtract({
          ...next,
          suggestedName: routeExtract.suggestedName,
          brand: routeExtract.brand ?? next.brand,
          containerHint: routeExtract.containerHint ?? next.containerHint,
          packSize: routeExtract.packSize ?? next.packSize,
          unit: routeExtract.unit ?? next.unit,
          ingredientType:
            routeExtract.ingredientType ?? next.ingredientType,
          aliases: mergeUniqueAliases(routeExtract.aliases, next.aliases),
          ean: routeExtract.ean ?? next.ean,
          quantity: routeExtract.quantity ?? next.quantity,
          expiryDate: routeExtract.expiryDate ?? next.expiryDate,
          crop: routeExtract.crop ?? next.crop,
          confidence: routeExtract.confidence,
          unrecognized: routeExtract.unrecognized,
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
    const hit = bestExtractMatch(products, visionLabel);
    if (!hit) return null;
    if (visionContradictsProduct(visionLabel, hit.product)) return null;
    if (
      visionCatalogTokenOverlap(visionLabel, hit.product) < 0.12 &&
      hit.matchedOn !== 'ean'
    ) {
      return null;
    }
    if (visionLabel.unrecognized && hit.score < 0.85) return null;
    return hit;
  }, [products, visionLabel]);
  const suggestions = useMemo(() => {
    const list = matchExtractToCatalog(products, visionLabel, SUGGESTION_LIMIT);
    return list.filter((m) => {
      if (visionContradictsProduct(visionLabel, m.product)) return false;
      if (visionLabel.unrecognized) return m.score >= 0.55;
      return true;
    });
  }, [products, visionLabel]);
  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, SUGGESTIONS_VISIBLE_DEFAULT);
  const hasMoreSuggestions = suggestions.length > SUGGESTIONS_VISIBLE_DEFAULT;

  const [selected, setSelected] = useState<ProductMatch | null>(null);
  const [unitOption, setUnitOption] = useState<FriendlyUnitOption>(() =>
    unitOptionForProduct(null, routeExtract.unit),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setSelected(initialMatch);
  }, [initialMatch]);

  // Default unit when the matched product changes (not on every extract tick).
  const selectedProductId = selected?.product.id;
  useEffect(() => {
    if (!selected) return;
    setUnitOption(unitOptionForProduct(selected.product, extract.unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on product identity
  }, [selectedProductId]);

  const [qty, setQty] = useState(
    routeExtract.quantity != null ? String(routeExtract.quantity) : '1',
  );
  const [expiry, setExpiry] = useState(routeExtract.expiryDate ?? '');
  const [packCheck, setPackCheck] = useState<PackCheckInfo | null>(null);
  const moreIsActive = MORE_UNIT_OPTIONS.some((o) => o.id === unitOption.id);

  function pickUnit(option: FriendlyUnitOption) {
    setUnitOption(option);
    setMoreOpen(false);
  }

  function selectMatch(match: ProductMatch) {
    setSelected(match);
    setUnitOption(unitOptionForProduct(match.product, extract.unit));
  }

  const matchContradicts = Boolean(
    selected && visionContradictsProduct(visionLabel, selected.product),
  );
  const tokenOverlapLow = Boolean(
    selected &&
      visionCatalogTokenOverlap(visionLabel, selected.product) < 0.2 &&
      selected.matchedOn !== 'ean',
  );
  const strongMatch =
    isStrongCatalogMatch(selected, visionLabel) &&
    !matchContradicts &&
    !tokenOverlapLow;
  const identityMatch =
    isIdentityCatalogMatch(selected, visionLabel) &&
    !matchContradicts &&
    !tokenOverlapLow;
  const unmatched = !strongMatch;
  const onHand = selected
    ? getStockQty(session, selected.product.id, activePlaceId)
    : 0;

  const visionSetupNote =
    Boolean(extract.rawNotes) &&
    /live label reading|GEMINI_API_KEY|API key|blocked by the Google/i.test(
      extract.rawNotes ?? '',
    );
  const showRawNotes =
    Boolean(extract.rawNotes) &&
    !isDevOrStubNote(extract.rawNotes ?? '') &&
    (visionSetupNote || (!extract.unrecognized && !unmatched));

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
    const storedQty = toStorageQty(selected.product.unit, n);
    const run = () => {
      const result = addQuantity({
        productId: selected.product.id,
        delta: storedQty,
        placeId: activePlaceId,
        expiryDate: expiry.trim() || null,
      });
      const time = formatClockTime(
        result?.lastUpdatedAt ?? new Date().toISOString(),
      );
      const unitLabel = displayUnit(unitOption.code);
      const body = t('recordAddedSummary')
        .replace('{added}', `${formatQty(n)} ${unitLabel}`)
        .replace(
          '{total}',
          `${formatQty(result?.quantityAfter ?? storedQty)} ${displayUnit(selected.product.unit)}`,
        )
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
      unitOption.code,
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
    const baseUnit = resolved?.packBaseUnit ?? packCheck.baseUnit;
    const baseOpt =
      packCheck.preferBunchLabel && baseUnit === 'KPL'
        ? MORE_UNIT_OPTIONS.find((o) => o.id === 'bunch') ??
          friendlyOptionForBaseUnit(baseUnit)
        : friendlyOptionForBaseUnit(baseUnit);
    if (baseOpt) setUnitOption(baseOpt);
    const n =
      packCheck.needsUnitsPerPack || packCheck.pieceQty == null
        ? packCheck.packQty
        : packCheck.pieceQty;
    setQty(String(n));
    setPackCheck(null);
    commitSave(n);
  }

  /** Entered qty as single retail units (KPL) — no pack × multiplier. */
  function onPackCountAsUnits(resolved?: PackCheckResolve) {
    if (!packCheck || !selected) return;
    const baseUnit = resolved?.packBaseUnit ?? 'KPL';
    const baseOpt =
      friendlyOptionForBaseUnit(baseUnit) ??
      COMMON_UNIT_OPTIONS.find((o) => o.id === 'piece')!;
    setUnitOption(baseOpt);
    const n = packCheck.packQty;
    setQty(String(n));
    setPackCheck(null);
    commitSave(n);
  }

  function onPackEdit() {
    setPackCheck(null);
  }

  function openAddProduct() {
    navigation.navigate('AddProduct', {
      prefillName: visionLabel.suggestedName,
      unit: visionLabel.unit ?? extract.unit ?? undefined,
      packSize: visionLabel.packSize ?? extract.packSize ?? undefined,
      unitPriceAlv0:
        visionLabel.unitPriceAlv0 ?? extract.unitPriceAlv0 ?? undefined,
      aliases: mergeUniqueAliases(visionLabel.aliases, extract.aliases),
      ean: visionLabel.ean ?? undefined,
      sourceUrl: extract.sourceUrl ?? undefined,
      imageUrl: extract.imageUrl ?? undefined,
      ingredientType:
        visionLabel.ingredientType ?? extract.ingredientType ?? undefined,
      brand: visionLabel.brand ?? extract.brand ?? undefined,
      containerHint:
        visionLabel.containerHint ?? extract.containerHint ?? undefined,
      photoUris: imageUri ? [imageUri] : undefined,
      returnToConfirm: true,
      extract: visionLabel,
      imageUri,
    });
  }

  const catalogZoomSource = selected
    ? productImageSource(selected.product)
    : null;

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
          .replace('{name}', visionLabel.suggestedName)
          .replace('{pct}', String(Math.round(visionLabel.confidence * 100)))}
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
          <Pressable
            onPress={() => {
              if (!imageUri) return;
              setZoomTarget({
                source: { uri: imageUri },
                label: t('fridgeDetectedCrop'),
              });
            }}
            disabled={!imageUri}
            accessibilityRole="button"
            accessibilityLabel={`${t('fridgeDetectedCrop')} · ${t('imageZoomTitle')}`}
          >
            <CroppedImage
              uri={imageUri}
              crop={extract.crop ?? visionLabel.crop}
              size={108}
              fallbackColor={
                extract.crop?.previewColor ?? visionLabel.crop?.previewColor
              }
            />
          </Pressable>
          <Text style={styles.matchCap}>{t('fridgeDetectedCrop')}</Text>
        </View>
        <Text style={styles.matchArrow}>→</Text>
        <View style={styles.matchCol}>
          {selected ? (
            <Pressable
              onPress={() => {
                if (!catalogZoomSource) return;
                setZoomTarget({
                  source: catalogZoomSource,
                  label: selected.product.officialName,
                });
              }}
              disabled={!catalogZoomSource}
              accessibilityRole="button"
              accessibilityLabel={`${t('fridgeOfficialPhoto')} · ${t('imageZoomTitle')}`}
            >
              <ProductThumb product={selected.product} size={108} />
            </Pressable>
          ) : (
            <View style={styles.packPlaceholder} />
          )}
          <Text style={styles.matchCap}>{t('fridgeOfficialPhoto')}</Text>
        </View>
      </View>

      {matchContradicts || tokenOverlapLow ? (
        <View
          style={styles.warnBox}
          accessibilityRole="summary"
          accessibilityLabel={t('confirmMismatchWarning')}
        >
          <Text style={styles.warnBody}>{t('confirmMismatchWarning')}</Text>
        </View>
      ) : null}

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
          <Pressable
            style={styles.barcodeGhost}
            onPress={() =>
              navigation.navigate('BarcodeScan', {
                purpose: 'confirm',
                imageUri,
                quantity: routeExtract.quantity,
                expiryDate: expiry.trim() || routeExtract.expiryDate,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={t('barcodeScanForMatch')}
          >
            <Text style={styles.barcodeGhostText}>{t('barcodeScanForMatch')}</Text>
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
                onPress={() => selectMatch(m)}
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
        initialQuery={visionLabel.suggestedName}
        onSelect={(m) => selectMatch(m)}
      />

      {strongMatch ? (
        <Pressable style={styles.addBtnGhost} onPress={openAddProduct}>
          <Text style={styles.addBtnGhostText}>{t('confirmAddDifferent')}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>{t('unit')}</Text>
      <View style={styles.chips}>
        {COMMON_UNIT_OPTIONS.map((option) => {
          const on = unitOption.id === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => pickUnit(option)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {option.id === 'kg' && unitSystem === 'imperial'
                  ? t('unitChipLb')
                  : option.id === 'liter' && unitSystem === 'imperial'
                    ? t('unitChipFloz')
                    : t(option.labelKey)}
              </Text>
              <Text style={[styles.chipCode, on && styles.chipCodeOn]}>
                {displayUnit(option.code)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setMoreOpen(true)}
          style={[styles.chip, moreIsActive && styles.chipOn]}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, moreIsActive && styles.chipTextOn]}>
            {moreIsActive ? t(unitOption.labelKey) : t('recordMoreUnits')}
          </Text>
          {moreIsActive ? (
            <Text style={[styles.chipCode, styles.chipCodeOn]}>
              {unitOption.code}
            </Text>
          ) : null}
        </Pressable>
      </View>
      {selected && selected.product.unit !== unitOption.code ? (
        <Text style={styles.unitNote}>
          {t('recordUnitCatalogNote').replace(
            '{unit}',
            selected.product.unit,
          )}
        </Text>
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

      <Modal
        visible={moreOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          style={styles.moreBackdrop}
          onPress={() => setMoreOpen(false)}
        >
          <Pressable
            style={[
              styles.moreSheet,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.moreTitle}>{t('recordMoreUnits')}</Text>
            <FlatList
              data={MORE_UNIT_OPTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => pickUnit(item)}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalRowText}>{t(item.labelKey)}</Text>
                  <Text style={styles.modalRowCode}>{item.code}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <PackCheckModal
        visible={packCheck != null}
        info={packCheck}
        onYesPacks={onPackYes}
        onChangeToPieces={onPackChangeToPieces}
        onCountAsUnits={onPackCountAsUnits}
        onEdit={onPackEdit}
      />

      <ImageZoomModal
        target={zoomTarget}
        onClose={() => setZoomTarget(null)}
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
  warnBox: {
    marginTop: spacing.md,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#E6A23C',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  warnBody: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  barcodeGhost: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
  },
  barcodeGhostText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipTextOn: { color: colors.primary },
  chipCode: { fontSize: 11, fontWeight: '600', color: colors.inkFaint },
  chipCodeOn: { color: colors.primaryMid },
  unitNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  moreBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  moreSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    maxHeight: '55%',
  },
  moreTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  modalRowText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  modalRowCode: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  save: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
