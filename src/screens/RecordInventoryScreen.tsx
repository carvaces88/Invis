import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import type { ProductMatch, RootStackParamList } from '../data/types';
import {
  COMMON_UNIT_OPTIONS,
  MORE_UNIT_OPTIONS,
  friendlyOptionForCode,
  type FriendlyUnitOption,
} from '../data/units';
import { useChefNudge } from '../components/ChefNudge';
import { DidYouMeanModal } from '../components/DidYouMeanModal';
import { PackCheckModal } from '../components/PackCheckModal';
import { PhotoCaptureTip } from '../components/PhotoCaptureTip';
import { PlaceSelect } from '../components/PlaceSelect';
import { VoiceDictationBar } from '../components/VoiceDictationBar';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import { confirmIfRecentAdd } from '../lib/confirmIfRecentAdd';
import {
  exactProductMatch,
  searchProducts,
  similarProductCandidates,
} from '../lib/fuzzyMatch';
import {
  baseUnitLabelEn,
  baseUnitLabelFi,
  friendlyOptionForBaseUnit,
  isPackUnit,
  packUnitLabelEn,
  packUnitLabelFi,
  prefersBunchLabel,
  resolvePackBaseUnit,
  resolveUnitsPerPack,
  shouldShowPackCheck,
  type PackCheckInfo,
  type PackCheckResolve,
} from '../lib/packUnits';
import { formatClockTime } from '../lib/relativeTime';
import { useUnitSystem } from '../lib/unitSystem';
import {
  analyzeFridgePanoramaImage,
  analyzeInventoryImage,
  isLiveVisionEnabled,
  isRealImageUri,
} from '../lib/vision';
import { resolveDemoShelfUri } from '../data/seedKruoka';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordInventory'>;
type PhotoMode = 'single' | 'fridge';

export function RecordInventoryScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { thinkingChef, yesChef } = useChefNudge();
  const { unitSystem, displayUnit, toStorageQty, toDisplayQty, formatQty } =
    useUnitSystem();
  const {
    products,
    addQuantity,
    getRecentAddWarning,
    addProduct,
    addProductAlias,
    setProductPackInfo,
    places,
    activePlaceId,
    setActivePlaceId,
    siteName,
    lastRecordUnit,
    setLastRecordUnit,
  } = useInventory();

  const heroFridge = route.params?.heroFridge === true;
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoMode, setPhotoMode] = useState<PhotoMode>(
    heroFridge ? 'fridge' : 'single',
  );

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ProductMatch | null>(null);
  const [unitOption, setUnitOption] = useState<FriendlyUnitOption>(() => {
    return (
      friendlyOptionForCode(lastRecordUnit) ??
      COMMON_UNIT_OPTIONS.find((o) => o.id === 'piece')!
    );
  });
  const [qty, setQty] = useState('1');
  const [qtyOther, setQtyOther] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [packCheck, setPackCheck] = useState<PackCheckInfo | null>(null);
  const [didYouMean, setDidYouMean] = useState<{
    name: string;
    candidates: ProductMatch[];
  } | null>(null);

  const QTY_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

  const results = useMemo(
    () => searchProducts(products, query, 8),
    [products, query],
  );

  const showSuggestions = query.trim().length >= 2 && !selected;
  const moreIsActive = MORE_UNIT_OPTIONS.some((o) => o.id === unitOption.id);

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          allowsEditing: false,
        });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  }

  async function analyzePhoto(demoKind: 'default' | 'fresh' = 'default') {
    if (
      photoMode !== 'fridge' &&
      isLiveVisionEnabled() &&
      !isRealImageUri(uri)
    ) {
      alertInfo(
        t('addProductNeedPhotoTitle'),
        t('addProductNeedPhotoBody'),
      );
      return;
    }
    setBusy(true);
    thinkingChef(true);
    try {
      if (photoMode === 'fridge') {
        const shelfUri =
          uri ??
          (demoKind === 'fresh' ? 'demo-fresh' : resolveDemoShelfUri('mayo1'));
        const document = await analyzeFridgePanoramaImage(shelfUri);
        thinkingChef(false);
        yesChef();
        navigation.navigate('FridgeReview', {
          document,
          imageUri: shelfUri,
        });
        return;
      }
      const hint =
        demoKind === 'fresh'
          ? query.trim() || 'cilantro'
          : query.trim() || undefined;
      const extract = await analyzeInventoryImage(uri ?? 'demo', hint);
      thinkingChef(false);
      yesChef();
      navigation.navigate('Confirm', {
        extract,
        imageUri: uri ?? undefined,
      });
    } catch (e) {
      thinkingChef(false);
      alertInfo(
        t('addProductAnalyzeFailedTitle'),
        e instanceof Error ? e.message : t('addProductAnalyzeFailedBody'),
      );
    } finally {
      thinkingChef(false);
      setBusy(false);
    }
  }

  function selectMatch(match: ProductMatch) {
    setSelected(match);
    setQuery(match.product.officialName);
    const mapped = friendlyOptionForCode(match.product.unit);
    if (mapped) setUnitOption(mapped);
  }

  function onQueryChange(text: string) {
    setQuery(text);
    if (selected && text !== selected.product.officialName) {
      setSelected(null);
    }
  }

  function pickUnit(option: FriendlyUnitOption) {
    setUnitOption(option);
    setLastRecordUnit(option.code);
    setMoreOpen(false);
  }

  function pickQtyPreset(n: number) {
    setQtyOther(false);
    setQty(String(n));
  }

  function pickQtyOther() {
    setQtyOther(true);
    setQty('');
  }

  function defaultUnitOption(): FriendlyUnitOption {
    return (
      friendlyOptionForCode(lastRecordUnit) ??
      COMMON_UNIT_OPTIONS.find((o) => o.id === 'piece')!
    );
  }

  function resetFormAfterSave() {
    setSelected(null);
    setQuery('');
    setQty('1');
    setQtyOther(false);
    setUri(null);
    setUnitOption(defaultUnitOption());
    setPackCheck(null);
    setDidYouMean(null);
  }

  function parseQty(): number | null {
    const n = Number(qty.replace(',', '.'));
    if (Number.isNaN(n) || n < 0 || qty.trim() === '') return null;
    return n;
  }

  function commitSave(match: ProductMatch, displayQty: number, afterMsg?: string) {
    const storedQty = toStorageQty(match.product.unit, displayQty);
    const run = () => {
      const result = addQuantity({
        productId: match.product.id,
        delta: storedQty,
        placeId: activePlaceId,
      });
      setLastRecordUnit(match.product.unit);
      yesChef();
      const unitLabel = displayUnit(match.product.unit);
      const addedDisp = formatQty(displayQty);
      const totalDisp = result
        ? formatQty(toDisplayQty(match.product.unit, result.quantityAfter))
        : addedDisp;
      const time = formatClockTime(
        result?.lastUpdatedAt ?? new Date().toISOString(),
      );
      const summary = t('recordAddedSummary')
        .replace('{added}', `${addedDisp} ${unitLabel}`)
        .replace('{total}', `${totalDisp} ${unitLabel}`)
        .replace('{time}', time);
      const body = afterMsg ? `${afterMsg}\n${summary}` : summary;
      alertAck(t('recordSavedTitle'), body, () => {
        resetFormAfterSave();
      });
    };
    confirmIfRecentAdd(
      getRecentAddWarning(match.product.id, activePlaceId),
      t,
      run,
    );
  }

  function trySaveWithMatch(match: ProductMatch) {
    const n = parseQty();
    if (n == null) {
      alertInfo(t('qty'), t('recordInvalidQty'));
      return;
    }
    const check = shouldShowPackCheck(match.product, unitOption.code, n);
    if (check) {
      setSelected(match);
      setQuery(match.product.officialName);
      setPackCheck(check);
      return;
    }
    commitSave(match, n);
  }

  function createNewAndSave(name: string) {
    const n = parseQty();
    if (n == null) {
      alertInfo(t('qty'), t('recordInvalidQty'));
      return;
    }
    const unit = unitOption.code;
    const storedQty = toStorageQty(unit, n);
    addProduct({
      officialName: name,
      unit,
      aliases: [name],
      initialQuantity: storedQty,
    });
    yesChef();
    alertAck(
      t('recordSavedTitle'),
      t('didYouMeanCreated').replace('{name}', name),
      resetFormAfterSave,
    );
  }

  function addToInventory() {
    const name = query.trim();
    if (!name) {
      alertInfo(t('recordNameRequiredTitle'), t('recordNameRequiredBody'));
      return;
    }

    if (selected) {
      trySaveWithMatch(selected);
      return;
    }

    const exact = exactProductMatch(products, name);
    if (exact) {
      selectMatch(exact);
      trySaveWithMatch(exact);
      return;
    }

    const similar = similarProductCandidates(products, name, 5);
    if (similar.length > 0) {
      setDidYouMean({ name, candidates: similar });
      return;
    }

    createNewAndSave(name);
  }

  function onMergeUseExisting(match: ProductMatch) {
    if (!didYouMean) return;
    const typed = didYouMean.name;
    addProductAlias(match.product.id, typed);
    setDidYouMean(null);
    selectMatch(match);
    const n = parseQty();
    if (n == null) {
      alertInfo(t('qty'), t('recordInvalidQty'));
      return;
    }
    const aliasMsg = t('didYouMeanAliasAdded')
      .replace('{alias}', typed)
      .replace('{product}', match.product.officialName);
    const check = shouldShowPackCheck(match.product, unitOption.code, n);
    if (check) {
      setPackCheck(check);
      return;
    }
    commitSave(match, n, aliasMsg);
  }

  function onCreateFromDidYouMean() {
    if (!didYouMean) return;
    const name = didYouMean.name;
    setDidYouMean(null);
    createNewAndSave(name);
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
    commitSave(selected, n);
  }

  function onPackChangeToPieces(resolved?: PackCheckResolve) {
    if (!packCheck || !selected) return;
    const info = packCheck;
    if (resolved?.unitsPerPack != null && resolved.unitsPerPack > 1) {
      setProductPackInfo(
        selected.product.id,
        resolved.unitsPerPack,
        resolved.packBaseUnit,
      );
    }
    const baseUnit = resolved?.packBaseUnit ?? info.baseUnit;
    const baseOpt =
      info.preferBunchLabel && baseUnit === 'KPL'
        ? MORE_UNIT_OPTIONS.find((o) => o.id === 'bunch') ??
          friendlyOptionForBaseUnit(baseUnit)
        : friendlyOptionForBaseUnit(baseUnit);
    if (baseOpt) setUnitOption(baseOpt);
    // Known pack → converted piece qty; unknown → same number as base units.
    const n =
      info.needsUnitsPerPack || info.pieceQty == null
        ? info.packQty
        : info.pieceQty;
    setQty(String(n));
    setQtyOther(true);
    setPackCheck(null);
    commitSave(selected, n);
  }

  const packHintText = (() => {
    if (!selected) return null;
    const per = resolveUnitsPerPack(selected.product);
    if (per == null) return null;
    const base = resolvePackBaseUnit(selected.product);
    const preferBunch = prefersBunchLabel(selected.product);
    const packCode = isPackUnit(unitOption.code)
      ? unitOption.code
      : isPackUnit(selected.product.unit)
        ? selected.product.unit
        : 'LTK';
    const packWord =
      locale === 'fi'
        ? packUnitLabelFi(packCode).replace(/aa$/, 'a').replace(/oa$/, 'o')
        : packUnitLabelEn(packCode).replace(/s$/, '') || 'box';
    const baseWord =
      locale === 'fi'
        ? baseUnitLabelFi(base, preferBunch)
        : baseUnitLabelEn(base, preferBunch);
    return t('packHint')
      .replace('{pack}', packWord)
      .replace('{per}', String(per))
      .replace('{base}', baseWord);
  })();

  function openFullList() {
    navigation.navigate('MainTabs', { screen: 'Inventaario' });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.kicker}>{t('appBrand')}</Text>
      <Text style={styles.title}>
        {heroFridge
          ? t('recordInventoryHeroTitle')
          : t('recordInventoryTitle')}
      </Text>
      <Text style={styles.sub}>
        {heroFridge
          ? t('recordInventoryHeroSub')
          : t('recordInventorySub')}
      </Text>

      {places.length > 0 ? (
        <View style={styles.placeBlock}>
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

      <Text style={styles.label}>{t('recordPhoto')}</Text>
      <View style={styles.modeRow}>
        {(heroFridge
          ? (['fridge', 'single'] as const)
          : (['single', 'fridge'] as const)
        ).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setPhotoMode(mode)}
            style={[
              styles.modeChip,
              photoMode === mode && styles.modeChipOn,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: photoMode === mode }}
          >
            <Text
              style={[
                styles.modeChipText,
                photoMode === mode && styles.modeChipTextOn,
              ]}
            >
              {mode === 'fridge'
                ? t('recordPhotoModeFridge')
                : t('recordPhotoModeSingle')}
            </Text>
          </Pressable>
        ))}
      </View>
      {photoMode === 'single' ? (
        <PhotoCaptureTip text={t('photoCaptureTip')} />
      ) : (
        <PhotoCaptureTip text={t('recordPhotoFridgeHint')} />
      )}
      <View style={styles.preview}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>
            {photoMode === 'fridge'
              ? t('recordPhotoFridgeHint')
              : t('recordPhotoHint')}
          </Text>
        )}
      </View>
      <View style={styles.row}>
        <Pressable style={styles.btnPrimary} onPress={() => pick(true)}>
          <Text style={styles.btnPrimaryText}>{t('camera')}</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => pick(false)}>
          <Text style={styles.btnGhostText}>{t('library')}</Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.analyze, busy && { opacity: 0.7 }]}
        disabled={busy}
        onPress={() => analyzePhoto('default')}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeText}>
            {photoMode === 'fridge'
              ? uri
                ? t('recordAnalyzeFridge')
                : t('recordAnalyzeFridgeDemo')
              : uri
                ? t('recordAnalyzePhoto')
                : t('recordAnalyzeDemo')}
          </Text>
        )}
      </Pressable>
      {!uri ? (
        <Pressable
          style={[styles.analyzeFresh, busy && { opacity: 0.7 }]}
          disabled={busy}
          onPress={() => analyzePhoto('fresh')}
          accessibilityRole="button"
        >
          <Text style={styles.analyzeFreshText}>
            {photoMode === 'fridge'
              ? t('recordAnalyzeFridgeFreshDemo')
              : t('recordAnalyzeFreshDemo')}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.divider} />

      <VoiceDictationBar onApplyToName={onQueryChange} />

      <Text style={styles.label}>{t('recordItemName')}</Text>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder={t('recordItemPlaceholder')}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {selected ? (
        <View style={styles.selectedBanner}>
          <Text style={styles.selectedName}>{selected.product.officialName}</Text>
          <Text style={styles.selectedMeta}>
            {selected.product.unit}
            {selected.product.packSize
              ? ` · ${selected.product.packSize}`
              : ''}
            {selected.matchedOn === 'alias'
              ? ` · “${selected.matchedTerm}”`
              : ''}
          </Text>
        </View>
      ) : null}
      {showSuggestions ? (
        <View style={styles.dropdown}>
          {results.length === 0 ? (
            <Text style={styles.empty}>{t('recordNoMatch')}</Text>
          ) : (
            results.map((item) => (
              <Pressable
                key={item.product.id}
                style={styles.suggestRow}
                onPress={() => selectMatch(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestName}>
                    {item.product.officialName}
                  </Text>
                  <Text style={styles.suggestMeta}>
                    {item.product.unit}
                    {item.product.packSize
                      ? ` · ${item.product.packSize}`
                      : ''}
                    {item.matchedOn === 'alias'
                      ? ` · via “${item.matchedTerm}”`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.score}>
                  {Math.round(item.score * 100)}%
                </Text>
              </Pressable>
            ))
          )}
        </View>
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
          <Text
            style={[styles.chipText, moreIsActive && styles.chipTextOn]}
          >
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
      {packHintText ? (
        <Text style={styles.packHint}>{packHintText}</Text>
      ) : null}

      <Text style={styles.label}>{t('qty')}</Text>
      <View style={styles.qtyChips}>
        {QTY_PRESETS.map((n) => {
          const on = !qtyOther && qty === String(n);
          return (
            <Pressable
              key={n}
              onPress={() => pickQtyPreset(n)}
              style={[styles.qtyChip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.qtyChipText, on && styles.chipTextOn]}>
                {n}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={pickQtyOther}
          style={[styles.qtyChip, styles.qtyOtherChip, qtyOther && styles.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: qtyOther }}
        >
          <Text style={[styles.qtyChipText, qtyOther && styles.chipTextOn]}>
            {t('recordQtyOther')}
          </Text>
        </Pressable>
      </View>
      {qtyOther ? (
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          placeholder={t('recordQtyOtherPlaceholder')}
          placeholderTextColor={colors.inkFaint}
          style={[styles.input, styles.qtyOtherInput]}
          autoFocus
        />
      ) : null}

      <Pressable style={styles.save} onPress={addToInventory}>
        <Text style={styles.saveText}>{t('recordAddToInventory')}</Text>
        <Text style={styles.saveHint}>{t('recordAddsHint')}</Text>
      </Pressable>

      <Pressable style={styles.linkBtn} onPress={openFullList}>
        <Text style={styles.linkText}>{t('recordOpenFullList')}</Text>
      </Pressable>

      <Pressable
        style={styles.linkBtn}
        onPress={() =>
          navigation.navigate('VerifyAmounts', { mode: 'recent' })
        }
      >
        <Text style={styles.linkText}>{t('verifyAmountsOpen')}</Text>
      </Pressable>

      <Modal
        visible={moreOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMoreOpen(false)}
        >
          <Pressable
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('recordMoreUnits')}</Text>
            <FlatList
              data={MORE_UNIT_OPTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modalRow,
                    unitOption.id === item.id && styles.modalRowOn,
                  ]}
                  onPress={() => pickUnit(item)}
                >
                  <Text style={styles.modalRowLabel}>{t(item.labelKey)}</Text>
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
        onEdit={() => setPackCheck(null)}
      />

      <DidYouMeanModal
        visible={didYouMean != null}
        typedName={didYouMean?.name ?? ''}
        candidates={didYouMean?.candidates ?? []}
        onUseExisting={onMergeUseExisting}
        onCreateNew={onCreateFromDidYouMean}
        onDismiss={() => setDidYouMean(null)}
      />
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
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  sub: {
    color: colors.inkMuted,
    marginTop: 6,
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  placeBlock: {
    marginBottom: spacing.sm,
  },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  modeChipOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  modeChipTextOn: { color: colors.primary },
  preview: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    color: colors.inkMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnGhost: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.ink, fontWeight: '600' },
  analyze: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryMid,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyzeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  analyzeFresh: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primaryMid,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyzeFreshText: {
    color: colors.primaryMid,
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
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
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.sm,
  },
  suggestName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  suggestMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  score: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  empty: {
    padding: spacing.md,
    color: colors.inkMuted,
    fontSize: 14,
  },
  selectedBanner: {
    marginTop: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
  },
  selectedName: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  selectedMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
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
  packHint: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 18,
  },
  qtyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  qtyChip: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyOtherChip: {
    minWidth: 72,
    paddingHorizontal: 14,
  },
  qtyChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  qtyOtherInput: {
    marginTop: spacing.sm,
  },
  save: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  saveHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  linkBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  modalRowOn: { backgroundColor: colors.primarySoft },
  modalRowLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  modalRowCode: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
