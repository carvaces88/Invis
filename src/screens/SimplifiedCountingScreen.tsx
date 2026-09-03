import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GamifiedCountingView } from '../components/GamifiedCountingView';
import { CalcIcon } from '../components/CalcIcon';
import {
  alsoKnownAsLabel,
  categoryTotal,
  findItemCategory,
  flattenAllItems,
  isItemCategoryId,
  itemMatchesQuery,
  ITEM_CATEGORY_IDS,
  lineTotal,
  PLACEHOLDER_BY_CATEGORY,
  SIMPLIFIED_CATEGORIES,
  type SimplifiedCategoryId,
  type SimplifiedCountItem,
  type SimplifiedItemCategoryId,
} from '../data/simplifiedCountingSeed';
import type { RootStackParamList, UnitCode } from '../data/types';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import {
  persistPickerAsset,
  visionPickerOptions,
} from '../lib/persistImageUri';
import { analyzePriorStockListImages } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

type ExtraProduct = {
  categoryId: SimplifiedItemCategoryId;
  item: SimplifiedCountItem;
};

const LIST_SCAN_MAX_PHOTOS = 8;
const HIDDEN_STORAGE_KEY = 'invis.simpCount.hiddenIds.v1';

type Props = NativeStackScreenProps<RootStackParamList, 'SimplifiedCounting'>;

const NEO_BG = '#E8ECF1';
const NEO_CARD = '#EEF1F5';
const GRADIENT_TEAL = '#B8E8D8';
const GRADIENT_PINK = '#F5C6D0';
const SWIPE_THRESHOLD = 56;
const DAIRY_FIRST_ID = 'dairy-milk-red';

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTHS_FI = [
  'Tammikuu',
  'Helmikuu',
  'Maaliskuu',
  'Huhtikuu',
  'Toukokuu',
  'Kesäkuu',
  'Heinäkuu',
  'Elokuu',
  'Syyskuu',
  'Lokakuu',
  'Marraskuu',
  'Joulukuu',
] as const;

function formatMoney(n: number): string {
  return n.toFixed(2);
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace(/\.?0+$/, '') || '0';
}

function emptyByCategory(): Record<SimplifiedCategoryId, SimplifiedCountItem[]> {
  const out = {} as Record<SimplifiedCategoryId, SimplifiedCountItem[]>;
  for (const cat of SIMPLIFIED_CATEGORIES) {
    out[cat.id] = [];
  }
  return out;
}

function cloneSeed(
  extras: ExtraProduct[] = [],
): Record<SimplifiedCategoryId, SimplifiedCountItem[]> {
  const out = emptyByCategory();
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = (PLACEHOLDER_BY_CATEGORY[cid] ?? []).map((row) => ({ ...row }));
  }
  for (const extra of extras) {
    if (!isItemCategoryId(extra.categoryId)) continue;
    const list = out[extra.categoryId] ?? [];
    if (list.some((row) => row.id === extra.item.id)) continue;
    out[extra.categoryId] = [...list, { ...extra.item }];
  }
  return out;
}

function slugId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöå]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `custom-${base || 'item'}-${Date.now().toString(36)}`;
}

type CountRowProps = {
  item: SimplifiedCountItem;
  name: string;
  alsoAs: string | null;
  selected: boolean;
  recorded: boolean;
  recordedLabel: string;
  missingLabel: string;
  editMode: boolean;
  hideLabel: string;
  onHide: () => void;
  onLongPressEdit: () => void;
  onSelect: () => void;
  onDelta: (delta: number) => void;
};

function hasRecordedValue(item: SimplifiedCountItem): boolean {
  return item.quantity > 0;
}

function webTitleProps(title: string | null | undefined) {
  if (Platform.OS !== 'web' || !title) return undefined;
  return { title } as { title: string };
}

function CountRow({
  item,
  name,
  alsoAs,
  selected,
  recorded,
  recordedLabel,
  missingLabel,
  editMode,
  hideLabel,
  onHide,
  onLongPressEdit,
  onSelect,
  onDelta,
}: CountRowProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!editMode) {
      wobble.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, {
          toValue: 1,
          duration: 90,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(wobble, {
          toValue: -1,
          duration: 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(wobble, {
          toValue: 0,
          duration: 90,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => {
      anim.stop();
      wobble.setValue(0);
    };
  }, [editMode, wobble]);

  const bumpFlash = (dir: 1 | -1) => {
    flash.setValue(dir);
    Animated.timing(flash, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !editMode &&
          Math.abs(g.dx) > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => onSelect(),
        onPanResponderMove: (_, g) => {
          pan.setValue(Math.max(-90, Math.min(90, g.dx * 0.45)));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) {
            onDelta(1);
            bumpFlash(1);
          } else if (g.dx < -SWIPE_THRESHOLD) {
            onDelta(-1);
            bumpFlash(-1);
          }
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        },
      }),
    [editMode, onDelta, onSelect, pan],
  );

  const tint = flash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['rgba(180,35,24,0.12)', 'transparent', 'rgba(31,122,77,0.14)'],
  });

  const rotate = wobble.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.8deg', '1.8deg'],
  });

  const total = lineTotal(item);
  const statusLabel = recorded ? recordedLabel : missingLabel;

  return (
    <Animated.View
      style={[
        styles.rowCard,
        selected && styles.rowCardSelected,
        editMode && styles.rowCardEdit,
        {
          transform: [{ translateX: pan }, { rotate }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: radius.lg }]}
      />
      {editMode ? (
        <Pressable
          style={styles.hideFab}
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={hideLabel}
          hitSlop={8}
        >
          <Text style={styles.hideFabGlyph}>−</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onSelect}
        onLongPress={onLongPressEdit}
        delayLongPress={420}
        style={styles.rowInner}
      >
        <View style={styles.colProduct}>
          <View style={styles.productNameRow}>
            <Text
              style={[
                styles.statusMark,
                recorded ? styles.statusMarkOk : styles.statusMarkMissing,
              ]}
              accessibilityLabel={statusLabel}
            >
              {recorded ? '✓' : '!'}
            </Text>
            <View style={styles.productTextCol}>
              <Text
                style={[styles.cellText, styles.productName]}
                numberOfLines={2}
                accessibilityLabel={
                  alsoAs
                    ? `${name}. ${alsoAs}. ${statusLabel}`
                    : `${name}. ${statusLabel}`
                }
                {...webTitleProps(alsoAs)}
              >
                {name}
              </Text>
              {alsoAs ? (
                <Text
                  style={styles.alsoAsLine}
                  numberOfLines={2}
                  {...webTitleProps(alsoAs)}
                >
                  {alsoAs}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <Text
          style={[
            styles.colQty,
            styles.cellText,
            !recorded && styles.colQtyZero,
          ]}
        >
          {formatQty(item.quantity)}
        </Text>
        <Text style={[styles.colUnit, styles.cellText]}>{item.unit}</Text>
        <Text style={[styles.colPrice, styles.cellText]}>
          {formatMoney(item.unitPriceAlv0)}
        </Text>
        <Text style={[styles.colTotal, styles.cellText]}>
          {formatMoney(total)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SimplifiedCountingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const months = locale === 'fi' ? MONTHS_FI : MONTHS_EN;

  const [monthIndex, setMonthIndex] = useState(7); // August draft
  const [categoryId, setCategoryId] =
    useState<SimplifiedCategoryId>('dairy');
  const [byCategory, setByCategory] = useState(cloneSeed);
  const [selectedId, setSelectedId] = useState<string | null>(
    DAIRY_FIRST_ID,
  );
  const [picker, setPicker] = useState<'month' | 'category' | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcDigits, setCalcDigits] = useState('');
  const [gameMode, setGameMode] = useState(false);
  const [gameIndex, setGameIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAlpha, setSortAlpha] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const [listScanOpen, setListScanOpen] = useState(false);
  const [listScanBusy, setListScanBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [hiddenSheetOpen, setHiddenSheetOpen] = useState(false);
  const [hiddenHydrated, setHiddenHydrated] = useState(false);

  const isOverview = categoryId === 'stock_values';

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(HIDDEN_STORAGE_KEY);
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setHiddenIds(parsed.filter((x): x is string => typeof x === 'string'));
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setHiddenHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hiddenHydrated) return;
    void AsyncStorage.setItem(
      HIDDEN_STORAGE_KEY,
      JSON.stringify(hiddenIds),
    ).catch(() => {});
  }, [hiddenIds, hiddenHydrated]);

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const items = useMemo(() => {
    if (categoryId === 'stock_values') return [];
    if (categoryId === 'all_items') return flattenAllItems(byCategory);
    return byCategory[categoryId] ?? [];
  }, [byCategory, categoryId]);

  const visibleItems = useMemo(
    () => items.filter((row) => !hiddenSet.has(row.id)),
    [items, hiddenSet],
  );

  const allHiddenItems = useMemo(
    () => flattenAllItems(byCategory).filter((row) => hiddenSet.has(row.id)),
    [byCategory, hiddenSet],
  );

  const filteredItems = useMemo(() => {
    let filtered = visibleItems.filter((row) =>
      itemMatchesQuery(row, searchQuery),
    );
    if (missingOnly) {
      filtered = filtered.filter((row) => !hasRecordedValue(row));
    }
    if (!sortAlpha) return filtered;
    const collator = new Intl.Collator(locale === 'fi' ? 'fi' : 'en', {
      sensitivity: 'base',
      numeric: true,
    });
    return [...filtered].sort((a, b) => {
      const na = locale === 'fi' ? a.nameFi : a.nameEn;
      const nb = locale === 'fi' ? b.nameFi : b.nameEn;
      return collator.compare(na, nb);
    });
  }, [visibleItems, searchQuery, sortAlpha, locale, missingOnly]);

  const missingCount = useMemo(
    () => visibleItems.filter((row) => !hasRecordedValue(row)).length,
    [visibleItems],
  );

  const selectedItem = useMemo(
    () => visibleItems.find((row) => row.id === selectedId) ?? null,
    [visibleItems, selectedId],
  );

  const total = useMemo(() => {
    const sumVisible = (cid: SimplifiedItemCategoryId) =>
      categoryTotal(
        (byCategory[cid] ?? []).filter((row) => !hiddenSet.has(row.id)),
      );
    if (categoryId === 'stock_values' || categoryId === 'all_items') {
      return ITEM_CATEGORY_IDS.reduce((sum, cid) => sum + sumVisible(cid), 0);
    }
    return categoryTotal(visibleItems);
  }, [byCategory, categoryId, hiddenSet, visibleItems]);

  const categoryLabel = t(
    SIMPLIFIED_CATEGORIES.find((c) => c.id === categoryId)?.labelKey ??
      'simpCountCatDairy',
  );

  const patchItem = useCallback(
    (id: string, map: (row: SimplifiedCountItem) => SimplifiedCountItem) => {
      setByCategory((prev) => {
        const home = findItemCategory(prev, id);
        if (!home) return prev;
        return {
          ...prev,
          [home]: (prev[home] ?? []).map((row) =>
            row.id === id ? map(row) : row,
          ),
        };
      });
      setSelectedId(id);
    },
    [],
  );

  const applyDelta = useCallback(
    (id: string, delta: number) => {
      if (isOverview) return;
      patchItem(id, (row) => {
        const next = Math.max(0, Math.round((row.quantity + delta) * 100) / 100);
        return { ...row, quantity: next };
      });
    },
    [isOverview, patchItem],
  );

  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      if (isOverview) return;
      const next = Math.max(0, Math.round(quantity * 100) / 100);
      patchItem(id, (row) => ({ ...row, quantity: next }));
    },
    [isOverview, patchItem],
  );

  const setUnit = useCallback(
    (id: string, unit: UnitCode) => {
      if (isOverview) return;
      patchItem(id, (row) => ({ ...row, unit }));
    },
    [isOverview, patchItem],
  );

  const enterGameMode = () => {
    if (filteredItems.length === 0 || isOverview) return;
    const start = selectedId
      ? filteredItems.findIndex((row) => row.id === selectedId)
      : 0;
    setGameIndex(start < 0 ? 0 : start);
    setGameMode(true);
  };

  const nudgeSelected = (delta: number) => {
    if (!selectedId || isOverview) return;
    applyDelta(selectedId, delta);
  };

  const openCalculator = () => {
    if (!selectedItem || isOverview) return;
    setCalcDigits(
      selectedItem.quantity > 0 ? formatQty(selectedItem.quantity) : '',
    );
    setCalcOpen(true);
  };

  const pushCalcKey = (key: string) => {
    setCalcDigits((prev) => {
      if (key === 'C') return '';
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : `${prev}.`;
      }
      if (prev === '0' && key !== '.') return key;
      if (prev.replace('.', '').length >= 8) return prev;
      return `${prev}${key}`;
    });
  };

  const applyCalculator = () => {
    if (!selectedId) return;
    const raw = calcDigits.trim().replace(',', '.');
    const n = raw === '' || raw === '.' ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setQuantity(selectedId, n);
    setCalcOpen(false);
  };

  const scanListPhotos = useCallback(
    async (fromCamera: boolean) => {
      setListScanOpen(false);
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        alertInfo(t('simpCountScanList'), t('simpCountScanNeedPermission'));
        return;
      }

      let uris: string[] = [];
      if (fromCamera) {
        const result = await ImagePicker.launchCameraAsync(
          visionPickerOptions({ quality: 0.85 }),
        );
        if (result.canceled || !result.assets[0]) return;
        uris = [await persistPickerAsset(result.assets[0])];
      } else {
        const result = await ImagePicker.launchImageLibraryAsync(
          visionPickerOptions({
            quality: 0.85,
            allowsMultipleSelection: true,
            selectionLimit: LIST_SCAN_MAX_PHOTOS,
          }),
        );
        if (result.canceled || !result.assets.length) return;
        for (const asset of result.assets) {
          uris.push(await persistPickerAsset(asset));
        }
        uris = uris.slice(0, LIST_SCAN_MAX_PHOTOS);
      }

      if (!uris.length) return;

      setListScanBusy(true);
      try {
        const document = await analyzePriorStockListImages(uris);
        if (!document.lines.length) {
          alertInfo(t('simpCountScanList'), t('sheetImportEmpty'));
          return;
        }
        navigation.navigate('SheetImportReview', {
          document,
          imageUri: uris[0],
          imageUris: uris,
        });
      } catch (err) {
        alertInfo(
          t('simpCountScanList'),
          err instanceof Error ? err.message : t('sheetImportFailed'),
        );
      } finally {
        setListScanBusy(false);
      }
    },
    [navigation, t],
  );

  const stockOverview = useMemo(() => {
    return ITEM_CATEGORY_IDS.map((cid) => {
      const meta = SIMPLIFIED_CATEGORIES.find((c) => c.id === cid);
      const rows = (byCategory[cid] ?? []).filter((row) => !hiddenSet.has(row.id));
      return {
        id: cid,
        label: t(meta?.labelKey ?? 'simpCountCatOther'),
        total: categoryTotal(rows),
        count: rows.length,
      };
    });
  }, [byCategory, hiddenSet, t]);

  const hideItem = useCallback((id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const unhideItem = useCallback((id: string) => {
    setHiddenIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const toggleEditMode = () => {
    if (isOverview) return;
    setEditMode((v) => !v);
  };

  if (gameMode) {
    return (
      <GamifiedCountingView
        items={filteredItems}
        index={gameIndex}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onIndexChange={setGameIndex}
        onSetQuantity={setQuantity}
        onSetUnit={setUnit}
        onExit={() => {
          const current = filteredItems[gameIndex];
          if (current) setSelectedId(current.id);
          setGameMode(false);
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
          hitSlop={8}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.brand} numberOfLines={1}>
          {t('simpCountBrand')}
        </Text>
        <Pressable
          style={styles.monthPill}
          onPress={() => setPicker('month')}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountMonth')}
        >
          <Text style={styles.monthText}>{months[monthIndex]}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
      </View>

      <View style={styles.categoryRow}>
        <Pressable
          style={styles.categoryPill}
          onPress={() => setPicker('category')}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountPickCategory')}
        >
          <Text style={styles.categoryPillText} numberOfLines={1}>
            {categoryLabel}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
      </View>

      {categoryId !== 'stock_values' ? (
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('simpCountSearchPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel={t('simpCountSearchPlaceholder')}
          />
          <Pressable
            style={[styles.sortPill, sortAlpha && styles.sortPillOn]}
            onPress={() => setSortAlpha((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: sortAlpha }}
            accessibilityLabel={t('simpCountSortAlpha')}
          >
            <Text style={[styles.sortPillText, sortAlpha && styles.sortPillTextOn]}>
              A–Z
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sortPill, missingOnly && styles.missingPillOn]}
            onPress={() => setMissingOnly((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: missingOnly }}
            accessibilityLabel={t('simpCountMissingOnly')}
          >
            <Text
              style={[
                styles.sortPillText,
                missingOnly && styles.sortPillTextOn,
              ]}
            >
              {t('simpCountMissingToggle').replace(
                '{count}',
                String(missingCount),
              )}
            </Text>
          </Pressable>
          {hiddenIds.length > 0 ? (
            <Pressable
              style={[styles.sortPill, styles.hiddenPill]}
              onPress={() => setHiddenSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('simpCountShowHidden').replace(
                '{count}',
                String(hiddenIds.length),
              )}
            >
              <Text style={[styles.sortPillText, styles.sortPillTextOn]}>
                {t('simpCountShowHidden').replace(
                  '{count}',
                  String(hiddenIds.length),
                )}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.banner}>
        <View style={styles.bannerWash} />
        <Text style={styles.bannerTitle}>{categoryLabel.toUpperCase()}</Text>
        <Text style={styles.bannerTotal}>
          {t('simpCountTotal').replace('{amount}', formatMoney(total))}
        </Text>
        <Text style={styles.bannerHint}>
          {editMode
            ? t('simpCountEditHint')
            : t('simpCountSwipeHint')}
        </Text>
      </View>

      {categoryId === 'stock_values' ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          {stockOverview.map((row) => (
            <Pressable
              key={row.id}
              style={styles.overviewCard}
              onPress={() => setCategoryId(row.id)}
            >
              <View>
                <Text style={styles.overviewTitle}>{row.label}</Text>
                <Text style={styles.overviewSub}>
                  {t('simpCountItemsCount').replace(
                    '{count}',
                    String(row.count),
                  )}
                </Text>
              </View>
              <Text style={styles.overviewTotal}>
                {formatMoney(row.total)} €
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <>
          <View style={styles.colHead}>
            <Text style={[styles.headCell, styles.colProduct]}>
              {t('simpCountColProduct')}
              {` (${filteredItems.length})`}
            </Text>
            <Text style={[styles.headCell, styles.colQty]}>
              {t('simpCountColQty')}
            </Text>
            <Text style={[styles.headCell, styles.colUnit]}>
              {t('simpCountColUnit')}
            </Text>
            <Text style={[styles.headCell, styles.colPrice]}>
              {t('simpCountColUnitPrice')}
            </Text>
            <Text style={[styles.headCell, styles.colTotal]}>
              {t('simpCountColTotalPrice')}
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 100,
              paddingHorizontal: spacing.md,
              gap: 10,
            }}
            showsVerticalScrollIndicator={false}
          >
            {visibleItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {items.length > 0
                    ? t('simpCountAllHiddenTitle')
                    : t('simpCountEmptyTitle')}
                </Text>
                <Text style={styles.emptySub}>
                  {items.length > 0
                    ? t('simpCountAllHiddenSub')
                    : t('simpCountEmptySub')}
                </Text>
                {items.length > 0 && hiddenIds.length > 0 ? (
                  <Pressable
                    style={styles.emptyAction}
                    onPress={() => setHiddenSheetOpen(true)}
                  >
                    <Text style={styles.emptyActionText}>
                      {t('simpCountShowHidden').replace(
                        '{count}',
                        String(hiddenIds.length),
                      )}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {missingOnly
                    ? t('simpCountMissingEmptyTitle')
                    : t('simpCountSearchEmpty')}
                </Text>
                <Text style={styles.emptySub}>
                  {missingOnly
                    ? t('simpCountMissingEmptySub')
                    : t('simpCountSearchEmptySub')}
                </Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const name = locale === 'fi' ? item.nameFi : item.nameEn;
                const alsoAs = alsoKnownAsLabel(item, locale, t('alsoAs'));
                const recorded = hasRecordedValue(item);
                return (
                  <CountRow
                    key={item.id}
                    item={item}
                    name={name}
                    alsoAs={alsoAs}
                    selected={selectedId === item.id}
                    recorded={recorded}
                    recordedLabel={t('simpCountStatusRecorded')}
                    missingLabel={t('simpCountStatusMissing')}
                    editMode={editMode}
                    hideLabel={t('simpCountHideProduct')}
                    onHide={() => hideItem(item.id)}
                    onLongPressEdit={() => {
                      setSelectedId(item.id);
                      setEditMode(true);
                    }}
                    onSelect={() => setSelectedId(item.id)}
                    onDelta={(d) => applyDelta(item.id, d)}
                  />
                );
              })
            )}
          </ScrollView>
        </>
      )}

      <View
        style={[
          styles.dock,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          style={styles.dockIcon}
          onPress={() => setPicker('category')}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountPickCategory')}
        >
          <Text style={styles.dockIconGlyph}>⚙</Text>
        </Pressable>
        <Pressable
          style={[styles.dockIcon, editMode && styles.dockIconOn]}
          onPress={toggleEditMode}
          disabled={isOverview}
          accessibilityRole="button"
          accessibilityState={{ selected: editMode }}
          accessibilityLabel={t('simpCountEdit')}
        >
          <Text style={styles.dockIconGlyph}>✎</Text>
        </Pressable>
        <Pressable
          style={styles.dockIcon}
          onPress={() => setListScanOpen(true)}
          disabled={listScanBusy}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountScanList')}
        >
          <Text style={styles.dockIconGlyph}>📷</Text>
        </Pressable>
        <Pressable
          style={styles.dockIcon}
          onPress={() => nudgeSelected(5)}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountPlus5')}
        >
          <Text style={styles.dockPlus5}>+5</Text>
        </Pressable>

        <Pressable
          style={[
            styles.dockCalc,
            (!selectedItem || isOverview || editMode) && styles.dockCalcDisabled,
          ]}
          onPress={openCalculator}
          disabled={!selectedItem || isOverview || editMode}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountCalculator')}
        >
          <CalcIcon size={24} color={colors.ink} />
        </Pressable>

        <Pressable
          style={[
            styles.dockGame,
            (filteredItems.length === 0 || isOverview || editMode) &&
              styles.dockCalcDisabled,
          ]}
          onPress={enterGameMode}
          disabled={filteredItems.length === 0 || isOverview || editMode}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameMode')}
        >
          <Text style={styles.dockGameGlyph}>🔥</Text>
        </Pressable>
      </View>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {picker === 'month'
                ? t('simpCountMonth')
                : t('simpCountPickCategory')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {picker === 'month'
                ? months.map((label, idx) => (
                    <Pressable
                      key={label}
                      style={[
                        styles.sheetRow,
                        idx === monthIndex && styles.sheetRowOn,
                      ]}
                      onPress={() => {
                        setMonthIndex(idx);
                        setPicker(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.sheetRowText,
                          idx === monthIndex && styles.sheetRowTextOn,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))
                : SIMPLIFIED_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.sheetRow,
                        c.id === categoryId && styles.sheetRowOn,
                      ]}
                      onPress={() => {
                        setCategoryId(c.id);
                        setSelectedId(null);
                        setEditMode(false);
                        setPicker(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.sheetRowText,
                          c.id === categoryId && styles.sheetRowTextOn,
                        ]}
                      >
                        {t(c.labelKey)}
                      </Text>
                    </Pressable>
                  ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={calcOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalcOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCalcOpen(false)}
        >
          <Pressable
            style={styles.calcSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>{t('simpCountCalculator')}</Text>
            <Text style={styles.calcProduct} numberOfLines={2}>
              {selectedItem
                ? locale === 'fi'
                  ? selectedItem.nameFi
                  : selectedItem.nameEn
                : '—'}
            </Text>
            <View style={styles.calcDisplay}>
              <Text style={styles.calcDisplayText}>
                {calcDigits === '' ? '0' : calcDigits}
              </Text>
              <Text style={styles.calcUnit}>
                {selectedItem?.unit ?? ''}
              </Text>
            </View>
            <View style={styles.calcPad}>
              {(
                [
                  ['7', '8', '9'],
                  ['4', '5', '6'],
                  ['1', '2', '3'],
                  ['C', '0', '.'],
                ] as const
              ).map((row) => (
                <View key={row.join('-')} style={styles.calcPadRow}>
                  {row.map((key) => (
                    <Pressable
                      key={key}
                      style={styles.calcKey}
                      onPress={() => pushCalcKey(key)}
                      accessibilityRole="button"
                      accessibilityLabel={key}
                    >
                      <Text style={styles.calcKeyText}>{key}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={styles.calcPadRow}>
                <Pressable
                  style={styles.calcKey}
                  onPress={() => pushCalcKey('⌫')}
                  accessibilityRole="button"
                  accessibilityLabel={t('simpCountCalcBackspace')}
                >
                  <Text style={styles.calcKeyText}>⌫</Text>
                </Pressable>
                <Pressable
                  style={[styles.calcKey, styles.calcApply]}
                  onPress={applyCalculator}
                  accessibilityRole="button"
                  accessibilityLabel={t('simpCountCalcApply')}
                >
                  <Text style={styles.calcApplyText}>
                    {t('simpCountCalcApply')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={listScanOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setListScanOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setListScanOpen(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>{t('simpCountScanList')}</Text>
            <Text style={styles.sheetSub}>{t('simpCountScanListSub')}</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => void scanListPhotos(true)}
            >
              <Text style={styles.sheetRowText}>{t('simpCountScanCamera')}</Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => void scanListPhotos(false)}
            >
              <Text style={styles.sheetRowText}>
                {t('simpCountScanLibrary')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => setListScanOpen(false)}
            >
              <Text style={styles.sheetRowMuted}>{t('simpCountAddCancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={listScanBusy} transparent animationType="fade">
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.busyText}>{t('simpCountScanBusy')}</Text>
        </View>
      </Modal>

      <Modal
        visible={hiddenSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHiddenSheetOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setHiddenSheetOpen(false)}
        >
          <Pressable
            style={[styles.sheet, styles.hiddenSheet]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>
              {t('simpCountShowHidden').replace(
                '{count}',
                String(allHiddenItems.length),
              )}
            </Text>
            <Text style={styles.sheetSub}>{t('simpCountHideHint')}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {allHiddenItems.length === 0 ? (
                <Text style={styles.sheetRowMuted}>
                  {t('simpCountHiddenEmpty')}
                </Text>
              ) : (
                allHiddenItems.map((item) => {
                  const name = locale === 'fi' ? item.nameFi : item.nameEn;
                  return (
                    <View key={item.id} style={styles.hiddenRow}>
                      <Text style={styles.hiddenRowName} numberOfLines={2}>
                        {name}
                      </Text>
                      <Pressable
                        style={styles.unhideBtn}
                        onPress={() => unhideItem(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('simpCountUnhideProduct')}
                      >
                        <Text style={styles.unhideBtnText}>
                          {t('simpCountUnhideProduct')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
            {allHiddenItems.length > 0 ? (
              <Pressable
                style={styles.sheetRow}
                onPress={() => {
                  setHiddenIds([]);
                  setHiddenSheetOpen(false);
                }}
              >
                <Text style={styles.sheetRowText}>
                  {t('simpCountUnhideAll')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.sheetRow}
              onPress={() => setHiddenSheetOpen(false)}
            >
              <Text style={styles.sheetRowMuted}>{t('simpCountAddCancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const neoShadow = Platform.select({
  web: {
    boxShadow:
      '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
  } as object,
  default: {
    shadowColor: '#9AA8B8',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEO_BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_CARD,
    ...neoShadow,
  },
  backGlyph: {
    fontSize: 28,
    lineHeight: 30,
    color: colors.ink,
    marginTop: -2,
  },
  brand: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      web: 'Georgia, "Times New Roman", serif',
      default: undefined,
    }),
    letterSpacing: -0.2,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NEO_CARD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    ...neoShadow,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  chevron: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  categoryRow: {
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: NEO_CARD,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 15,
    color: colors.ink,
    ...Platform.select({
      web: {
        boxShadow:
          '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
        outlineStyle: 'none',
      } as object,
      default: {
        shadowColor: '#9AA8B8',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: NEO_CARD,
    ...Platform.select({
      web: {
        boxShadow:
          '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
      } as object,
      default: {
        shadowColor: '#9AA8B8',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  sortPillOn: {
    backgroundColor: 'rgba(184,232,216,0.85)',
  },
  missingPillOn: {
    backgroundColor: 'rgba(245,198,208,0.9)',
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.inkMuted,
    letterSpacing: 0.3,
  },
  sortPillTextOn: {
    color: colors.ink,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  productTextCol: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    flexShrink: 1,
  },
  alsoAsLine: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    color: colors.inkFaint,
    fontWeight: '500',
  },
  statusMark: {
    marginTop: 1,
    width: 16,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusMarkOk: {
    color: colors.success,
  },
  statusMarkMissing: {
    color: colors.warning,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: NEO_CARD,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...neoShadow,
  },
  categoryPillText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.1,
  },
  banner: {
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: GRADIENT_TEAL,
    ...neoShadow,
  },
  bannerWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GRADIENT_PINK,
    opacity: 0.55,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(90deg, ${GRADIENT_TEAL} 0%, ${GRADIENT_PINK} 100%)`,
          opacity: 1,
          backgroundColor: 'transparent',
        } as object)
      : null),
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.6,
  },
  bannerTotal: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    opacity: 0.85,
  },
  bannerHint: {
    marginTop: 6,
    fontSize: 11,
    color: colors.inkMuted,
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md + 4,
    marginBottom: 8,
    gap: 4,
  },
  headCell: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  list: { flex: 1 },
  rowCard: {
    backgroundColor: NEO_CARD,
    borderRadius: radius.lg,
    ...neoShadow,
  },
  rowCardSelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(11,79,138,0.28)',
  },
  rowCardEdit: {
    borderWidth: 1,
    borderColor: 'rgba(180,35,24,0.22)',
  },
  hideFab: {
    position: 'absolute',
    top: -8,
    left: -8,
    zIndex: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
    ...neoShadow,
  },
  hideFabGlyph: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
    lineHeight: 24,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  colProduct: { flex: 1.35, minWidth: 0 },
  colQty: { width: 42, textAlign: 'center', fontWeight: '700' },
  colQtyZero: { color: colors.inkFaint, fontWeight: '500' },
  colUnit: { width: 36, textAlign: 'center', color: colors.inkMuted },
  colPrice: { width: 52, textAlign: 'right', color: colors.inkMuted },
  colTotal: {
    width: 58,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.ink,
  },
  cellText: {
    fontSize: 12,
    color: colors.ink,
  },
  emptyCard: {
    backgroundColor: NEO_CARD,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...neoShadow,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  emptyAction: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(184,232,216,0.9)',
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  hiddenPill: {
    backgroundColor: 'rgba(163,177,198,0.55)',
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NEO_CARD,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    ...neoShadow,
  },
  overviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  overviewSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.inkMuted,
  },
  overviewTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    backgroundColor: NEO_BG,
    gap: 10,
  },
  dockIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_CARD,
    ...neoShadow,
  },
  dockIconOn: {
    backgroundColor: 'rgba(245,198,208,0.95)',
  },
  dockIconGlyph: {
    fontSize: 18,
    color: colors.ink,
  },
  dockPlus5: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  dockCalc: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GRADIENT_TEAL,
    ...Platform.select({
      web: {
        boxShadow:
          '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
      } as object,
      default: {
        shadowColor: '#9AA8B8',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  dockCalcDisabled: {
    opacity: 0.45,
  },
  dockGame: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GRADIENT_PINK,
    ...Platform.select({
      web: {
        boxShadow:
          '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
      } as object,
      default: {
        shadowColor: '#9AA8B8',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  dockGameGlyph: {
    fontSize: 22,
  },
  calcSheet: {
    backgroundColor: NEO_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  calcProduct: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: 10,
  },
  calcDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 8,
    backgroundColor: NEO_BG,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    ...neoShadow,
  },
  calcDisplayText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  calcUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  calcPad: {
    gap: 10,
  },
  calcPadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calcKey: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_BG,
    ...neoShadow,
  },
  calcKeyText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  calcApply: {
    flex: 2,
    backgroundColor: GRADIENT_TEAL,
  },
  calcApplyText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,51,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NEO_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  sheetSub: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
  sheetRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  sheetRowOn: {
    backgroundColor: 'rgba(184,232,216,0.55)',
  },
  sheetRowText: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '500',
  },
  sheetRowTextOn: {
    fontWeight: '700',
  },
  sheetRowMuted: {
    fontSize: 14,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  busyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,51,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  busyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  hiddenSheet: {
    maxHeight: '80%',
  },
  hiddenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11,31,51,0.12)',
  },
  hiddenRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  unhideBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(184,232,216,0.9)',
  },
  unhideBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
});
