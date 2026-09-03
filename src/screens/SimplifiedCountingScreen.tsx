import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  CameraIcon,
  CategoryIcon,
  EditIcon,
  FlameIcon,
  PlusFiveBadge,
} from '../components/SimpCountDockIcons';
import {
  alsoKnownAsLabel,
  categoryTotal,
  findItemCategory,
  flattenAllItems,
  isItemCategoryId,
  itemMatchesQuery,
  ITEM_CATEGORY_IDS,
  lineTotal,
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
import {
  buildPriceHistoryExportHtml,
  loadSupplierPriceHistory,
  monthKeyFromIndex,
  monthPriceRows,
  type MonthPriceRow,
} from '../lib/supplierPriceHistory';
import {
  categoryTotalsForMonth,
  inventoryForMonthIndex,
  SIMP_COUNT_LIVE_MONTH_INDEX,
} from '../lib/simpCountMonthInventories';
import {
  buildSimpCountExportHtml,
  buildSimpExportRows,
  exportSimpCountExcel,
  exportSimpCountPdf,
  type SimpExportFormat,
  type SimpExportScope,
} from '../lib/simpCountExport';
import { printHtmlOrSharePdf } from '../lib/export/download';
import { analyzePriorStockListImages } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';
import * as Print from 'expo-print';

type ExtraProduct = {
  categoryId: SimplifiedItemCategoryId;
  item: SimplifiedCountItem;
};

const LIST_SCAN_MAX_PHOTOS = 8;
const HIDDEN_STORAGE_KEY = 'invis.simpCount.hiddenIds.v1';
const EXTRAS_STORAGE_KEY = 'invis.simpCount.extraProducts.v1';
const ADD_UNIT_CHOICES: UnitCode[] = [
  'KG',
  'L',
  'KPL',
  'PSS',
  'PKT',
  'PRK',
  'PL',
];

type ProductEditorState =
  | { mode: 'add' }
  | { mode: 'edit'; itemId: string };

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
  monthIndex: number,
  extras: ExtraProduct[] = [],
): Record<SimplifiedCategoryId, SimplifiedCountItem[]> {
  const out = emptyByCategory();
  const monthInv = inventoryForMonthIndex(monthIndex);
  for (const cid of ITEM_CATEGORY_IDS) {
    out[cid] = (monthInv[cid] ?? []).map((row) => ({ ...row }));
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
  /** Long-press armed: reddish hue + hide/edit fabs (no wiggle). */
  armed: boolean;
  hideLabel: string;
  editDetailsLabel: string;
  onHide: () => void;
  onEditDetails: () => void;
  onLongPress: () => void;
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
  armed,
  hideLabel,
  editDetailsLabel,
  onHide,
  onEditDetails,
  onLongPress,
  onSelect,
  onDelta,
}: CountRowProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

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
          !armed &&
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
    [armed, onDelta, onSelect, pan],
  );

  const tint = flash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['rgba(180,35,24,0.12)', 'transparent', 'rgba(31,122,77,0.14)'],
  });

  const total = lineTotal(item);
  const statusLabel = recorded ? recordedLabel : missingLabel;

  return (
    <Animated.View
      style={[
        styles.rowCard,
        selected && styles.rowCardSelected,
        armed && styles.rowCardEdit,
        { transform: [{ translateX: pan }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint, borderRadius: radius.lg },
        ]}
      />
      {armed ? (
        <View style={styles.rowActionFabs} pointerEvents="box-none">
          <Pressable
            style={styles.hideFab}
            onPress={onHide}
            accessibilityRole="button"
            accessibilityLabel={hideLabel}
            hitSlop={8}
          >
            <Text style={styles.hideFabGlyph}>−</Text>
          </Pressable>
          <Pressable
            style={styles.editFab}
            onPress={onEditDetails}
            accessibilityRole="button"
            accessibilityLabel={editDetailsLabel}
            hitSlop={8}
          >
            <Text style={styles.editFabGlyph}>✎</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={onSelect}
        onLongPress={onLongPress}
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

  const [monthIndex, setMonthIndex] = useState(SIMP_COUNT_LIVE_MONTH_INDEX);
  const [categoryId, setCategoryId] =
    useState<SimplifiedCategoryId>('dairy');
  const [byCategory, setByCategory] = useState(() =>
    cloneSeed(SIMP_COUNT_LIVE_MONTH_INDEX),
  );
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
  const [listScanKind, setListScanKind] = useState<
    null | 'count' | 'supplier'
  >(null);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistoryRows, setPriceHistoryRows] = useState<MonthPriceRow[]>(
    [],
  );
  const [priceHistoryMonthKey, setPriceHistoryMonthKey] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);
  const [productEditor, setProductEditor] = useState<ProductEditorState | null>(
    null,
  );
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameFi, setEditNameFi] = useState('');
  const [editUnit, setEditUnit] = useState<UnitCode>('KPL');
  const [editPrice, setEditPrice] = useState('');
  const [editCategoryId, setEditCategoryId] =
    useState<SimplifiedItemCategoryId>('dairy');
  const [editAliases, setEditAliases] = useState('');
  const [extras, setExtras] = useState<ExtraProduct[]>([]);
  const [extrasHydrated, setExtrasHydrated] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [hiddenSheetOpen, setHiddenSheetOpen] = useState(false);
  const [hiddenHydrated, setHiddenHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportScope, setExportScope] = useState<SimpExportScope>('category');
  const [exportFormat, setExportFormat] = useState<SimpExportFormat>('pdf');
  const [exportBusy, setExportBusy] = useState(false);

  const isOverview = categoryId === 'stock_values';

  const goToMore = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'More' });
  }, [navigation]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [hiddenRaw, extrasRaw] = await Promise.all([
          AsyncStorage.getItem(HIDDEN_STORAGE_KEY),
          AsyncStorage.getItem(EXTRAS_STORAGE_KEY),
        ]);
        if (!alive) return;
        if (hiddenRaw) {
          const parsed = JSON.parse(hiddenRaw) as unknown;
          if (Array.isArray(parsed)) {
            setHiddenIds(
              parsed.filter((x): x is string => typeof x === 'string'),
            );
          }
        }
        let cleanedExtras: ExtraProduct[] = [];
        if (extrasRaw) {
          const parsed = JSON.parse(extrasRaw) as unknown;
          if (Array.isArray(parsed)) {
            cleanedExtras = parsed.filter(
              (row): row is ExtraProduct =>
                !!row &&
                typeof row === 'object' &&
                typeof (row as ExtraProduct).categoryId === 'string' &&
                !!(row as ExtraProduct).item?.id,
            );
            setExtras(cleanedExtras);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) {
          setHiddenHydrated(true);
          setExtrasHydrated(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Swap inventory lines when the selected month changes (Jul/Aug samples vs Sept live).
  useEffect(() => {
    if (!extrasHydrated) return;
    setByCategory(cloneSeed(monthIndex, extras));
    setSelectedId(null);
    setArmedItemId(null);
    setGameMode(false);
    // Intentional: don't re-run on every extras edit — only month / hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthIndex, extrasHydrated]);

  useEffect(() => {
    if (!hiddenHydrated) return;
    void AsyncStorage.setItem(
      HIDDEN_STORAGE_KEY,
      JSON.stringify(hiddenIds),
    ).catch(() => {});
  }, [hiddenIds, hiddenHydrated]);

  useEffect(() => {
    if (!extrasHydrated) return;
    void AsyncStorage.setItem(
      EXTRAS_STORAGE_KEY,
      JSON.stringify(extras),
    ).catch(() => {});
  }, [extras, extrasHydrated]);

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
      selectedItem.quantity > 0 ? formatQty(selectedItem.quantity) : '0',
    );
    setCalcOpen(true);
  };

  const evalCalcExpr = (raw: string): number | null => {
    const cleaned = raw
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/,/g, '.')
      .trim();
    if (!cleaned || cleaned === '.') return 0;
    if (!/^[\d.\s+\-*/()]+$/.test(cleaned)) return null;
    try {
      // eslint-disable-next-line no-new-func -- tiny local calculator, input sanitized above
      const n = Function(`"use strict"; return (${cleaned})`)() as unknown;
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const pushCalcKey = (key: string) => {
    setCalcDigits((prev) => {
      const cur = prev === '' ? '0' : prev;
      if (key === 'C') return '0';
      if (key === '⌫') {
        const next = cur.slice(0, -1);
        return next === '' ? '0' : next;
      }
      if (key === '=') {
        const n = evalCalcExpr(cur);
        if (n == null) return cur;
        return formatQty(Math.round(n * 1000) / 1000);
      }
      if (key === '.') {
        // Allow decimal on the current number segment only
        const parts = cur.split(/[+\-×÷]/);
        const last = parts[parts.length - 1] ?? '';
        if (last.includes('.')) return cur;
        return cur === '0' ? '0.' : `${cur}.`;
      }
      if (/[+\-×÷]/.test(key)) {
        if (/[+\-×÷]$/.test(cur)) return `${cur.slice(0, -1)}${key}`;
        return `${cur}${key}`;
      }
      if (cur === '0' && /[0-9]/.test(key)) return key;
      if (cur.replace(/[^0-9]/g, '').length >= 12) return cur;
      return `${cur}${key}`;
    });
  };

  const applyCalculator = () => {
    if (!selectedId) return;
    const n = evalCalcExpr(calcDigits.trim() || '0');
    if (n == null || n < 0) return;
    setQuantity(selectedId, Math.round(n * 100) / 100);
    setCalcOpen(false);
  };

  const scanListPhotos = useCallback(
    async (fromCamera: boolean, kind: 'count' | 'supplier') => {
      setListScanOpen(false);
      setListScanKind(null);
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
        if (kind === 'supplier') {
          navigation.navigate('SupplierOrderReview', {
            document,
            imageUri: uris[0],
            imageUris: uris,
            monthIndex,
          });
        } else {
          navigation.navigate('SheetImportReview', {
            document,
            imageUri: uris[0],
            imageUris: uris,
          });
        }
      } catch (err) {
        alertInfo(
          t('simpCountScanList'),
          err instanceof Error ? err.message : t('sheetImportFailed'),
        );
      } finally {
        setListScanBusy(false);
      }
    },
    [monthIndex, navigation, t],
  );

  const openPriceHistory = useCallback(async () => {
    setListScanOpen(false);
    setListScanKind(null);
    const key = monthKeyFromIndex(monthIndex);
    const all = await loadSupplierPriceHistory();
    // Selected month only — prior months stay stored for export, not mixed in.
    setPriceHistoryMonthKey(key);
    setPriceHistoryRows(monthPriceRows(all, key));
    setPriceHistoryOpen(true);
  }, [monthIndex]);

  const exportPriceHistoryMonth = useCallback(async () => {
    const html = buildPriceHistoryExportHtml({
      title: t('simpCountPriceHistory'),
      monthLabel: months[monthIndex] ?? priceHistoryMonthKey,
      monthKey: priceHistoryMonthKey || monthKeyFromIndex(monthIndex),
      rows: priceHistoryRows,
      emptyNote: t('simpCountPriceHistoryEmptyMonth').replace(
        '{month}',
        months[monthIndex] ?? '',
      ),
    });
    try {
      await printHtmlOrSharePdf({
        html,
        filename: `invis-prices-${priceHistoryMonthKey || monthKeyFromIndex(monthIndex)}.pdf`,
        nativePrint: () => Print.printToFileAsync({ html }),
      });
    } catch (err) {
      alertInfo(
        t('simpCountPriceHistory'),
        err instanceof Error ? err.message : t('supplierOrderFailed'),
      );
    }
  }, [monthIndex, months, priceHistoryMonthKey, priceHistoryRows, t]);

  const stockOverview = useMemo(() => {
    const priorTotals =
      monthIndex > 0 ? categoryTotalsForMonth(monthIndex - 1) : null;
    const rows = ITEM_CATEGORY_IDS.map((cid) => {
      const meta = SIMPLIFIED_CATEGORIES.find((c) => c.id === cid);
      const catRows = (byCategory[cid] ?? []).filter(
        (row) => !hiddenSet.has(row.id),
      );
      const total = categoryTotal(catRows);
      const prior = priorTotals ? priorTotals[cid] ?? 0 : null;
      return {
        id: cid,
        label: t(meta?.labelKey ?? 'simpCountCatOther'),
        total,
        prior,
        count: catRows.length,
      };
    });
    const foodTotal =
      Math.round(rows.reduce((sum, r) => sum + r.total, 0) * 100) / 100;
    return {
      rows: rows.map((r) => ({
        ...r,
        pct:
          foodTotal > 0
            ? Math.round((r.total / foodTotal) * 100)
            : 0,
        delta:
          r.prior == null ? null : Math.round((r.total - r.prior) * 100) / 100,
      })),
      foodTotal,
    };
  }, [byCategory, hiddenSet, monthIndex, t]);

  const runExport = useCallback(async () => {
    setExportBusy(true);
    try {
      const blank = exportScope === 'blank';
      const nameOf = (item: SimplifiedCountItem) =>
        locale === 'fi' ? item.nameFi || item.nameEn : item.nameEn || item.nameFi;
      let items: SimplifiedCountItem[] = [];
      if (exportScope === 'all') {
        items = flattenAllItems(byCategory).filter((r) => !hiddenSet.has(r.id));
      } else {
        const cid: SimplifiedItemCategoryId = isItemCategoryId(categoryId)
          ? categoryId
          : 'dairy';
        items = (byCategory[cid] ?? []).filter((r) => !hiddenSet.has(r.id));
      }
      const headers = {
        product: t('simpCountColProduct'),
        qty: t('simpCountColQty'),
        unit: t('simpCountColUnit'),
        unitPrice: t('simpCountColUnitPrice'),
        lineTotal: t('simpCountColTotalPrice'),
      };
      const rows = buildSimpExportRows(items, { blank, nameOf });
      const scopeLabel =
        exportScope === 'all'
          ? t('simpCountExportScopeAll')
          : exportScope === 'blank'
            ? t('simpCountExportScopeBlank')
            : categoryLabel;
      const monthLabel = months[monthIndex] ?? '';
      const baseName = `invis-${monthLabel.toLowerCase()}-${exportScope}`;
      if (exportFormat === 'pdf') {
        const html = buildSimpCountExportHtml({
          title: `${t('simpCountBrand')} · ${scopeLabel}`,
          subtitle: `${monthLabel} · ${blank ? t('simpCountExportScopeBlankSub') : t('simpCountExportTitle')}`,
          headers,
          rows,
        });
        await exportSimpCountPdf({
          html,
          filename: `${baseName}.pdf`,
        });
      } else {
        await exportSimpCountExcel({
          rows,
          sheetName: scopeLabel,
          filename: `${baseName}.xlsx`,
          headers,
          dialogTitle: t('simpCountExportTitle'),
        });
      }
      alertInfo(t('simpCountExportTitle'), t('simpCountExportDone'));
      setSettingsOpen(false);
    } catch (err) {
      alertInfo(
        t('simpCountExportTitle'),
        err instanceof Error ? err.message : t('simpCountExportFailed'),
      );
    } finally {
      setExportBusy(false);
    }
  }, [
    byCategory,
    categoryId,
    categoryLabel,
    exportFormat,
    exportScope,
    hiddenSet,
    locale,
    monthIndex,
    months,
    t,
  ]);

  const hideItem = useCallback((id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSelectedId((cur) => (cur === id ? null : cur));
    setArmedItemId((cur) => (cur === id ? null : cur));
  }, []);

  const unhideItem = useCallback((id: string) => {
    setHiddenIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const openProductEditor = useCallback(
    (state: ProductEditorState) => {
      if (state.mode === 'add') {
        const fallbackCat: SimplifiedItemCategoryId =
          isItemCategoryId(categoryId) ? categoryId : 'other';
        setEditCategoryId(fallbackCat);
        setEditNameEn('');
        setEditNameFi('');
        setEditUnit('KPL');
        setEditPrice('');
        setEditAliases('');
        setProductEditor(state);
        setEditMode(true);
        setArmedItemId(null);
        return;
      }
      const home = findItemCategory(byCategory, state.itemId);
      const item =
        flattenAllItems(byCategory).find((r) => r.id === state.itemId) ?? null;
      if (!item || !home) return;
      setEditCategoryId(home);
      setEditNameEn(item.nameEn);
      setEditNameFi(item.nameFi);
      setEditUnit(item.unit);
      setEditPrice(
        item.unitPriceAlv0 > 0 ? formatMoney(item.unitPriceAlv0) : '',
      );
      setEditAliases((item.aliases ?? []).join(', '));
      setSelectedId(item.id);
      setProductEditor(state);
      setEditMode(true);
      setArmedItemId(null);
    },
    [byCategory, categoryId],
  );

  const saveProductEditor = useCallback(() => {
    if (!productEditor) return;
    const nameEn = editNameEn.trim();
    const nameFi = editNameFi.trim() || nameEn;
    if (!nameEn && !nameFi) {
      alertInfo(t('simpCountAddProduct'), t('simpCountAddNeedName'));
      return;
    }
    const priceRaw = editPrice.trim().replace(',', '.');
    const price =
      priceRaw === '' ? 0 : Math.max(0, Math.round(Number(priceRaw) * 100) / 100);
    if (!Number.isFinite(price)) {
      alertInfo(t('simpCountAddProduct'), t('simpCountAddNeedPrice'));
      return;
    }
    const aliases = editAliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (productEditor.mode === 'add') {
      const item: SimplifiedCountItem = {
        id: slugId(nameEn || nameFi),
        nameEn: nameEn || nameFi,
        nameFi: nameFi || nameEn,
        quantity: 0,
        unit: editUnit,
        unitPriceAlv0: price,
        aliases: aliases.length ? aliases : undefined,
      };
      const extra: ExtraProduct = {
        categoryId: editCategoryId,
        item,
      };
      setExtras((prev) => [...prev, extra]);
      setByCategory((prev) => ({
        ...prev,
        [editCategoryId]: [...(prev[editCategoryId] ?? []), item],
      }));
      setSelectedId(item.id);
      setCategoryId(editCategoryId);
      setProductEditor(null);
      return;
    }

    const id = productEditor.itemId;
    const home = findItemCategory(byCategory, id);
    if (!home) return;
    const updated: SimplifiedCountItem = {
      id,
      nameEn: nameEn || nameFi,
      nameFi: nameFi || nameEn,
      quantity:
        flattenAllItems(byCategory).find((r) => r.id === id)?.quantity ?? 0,
      unit: editUnit,
      unitPriceAlv0: price,
      aliases: aliases.length ? aliases : undefined,
    };

    if (home === editCategoryId) {
      setByCategory((prev) => ({
        ...prev,
        [home]: (prev[home] ?? []).map((row) =>
          row.id === id ? updated : row,
        ),
      }));
    } else {
      setByCategory((prev) => ({
        ...prev,
        [home]: (prev[home] ?? []).filter((row) => row.id !== id),
        [editCategoryId]: [...(prev[editCategoryId] ?? []), updated],
      }));
    }

    setExtras((prev) => {
      const without = prev.filter((e) => e.item.id !== id);
      if (id.startsWith('custom-') || prev.some((e) => e.item.id === id)) {
        return [...without, { categoryId: editCategoryId, item: updated }];
      }
      return without;
    });
    setSelectedId(id);
    setProductEditor(null);
  }, [
    byCategory,
    editAliases,
    editCategoryId,
    editNameEn,
    editNameFi,
    editPrice,
    editUnit,
    productEditor,
    t,
  ]);

  const toggleEditMode = () => {
    if (isOverview) return;
    setEditMode((v) => {
      if (v) {
        setProductEditor(null);
        setArmedItemId(null);
      }
      return !v;
    });
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
          onPress={goToMore}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountBackToMore')}
          hitSlop={8}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.brand} numberOfLines={1}>
          {t('simpCountBrand')}
        </Text>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountExtraSettings')}
          hitSlop={8}
        >
          <Text style={styles.settingsGlyph}>⚙</Text>
        </Pressable>
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

      {editMode && !isOverview ? (
        <View style={styles.editBar}>
          <Pressable
            style={styles.editBarBtn}
            onPress={() => openProductEditor({ mode: 'add' })}
            accessibilityRole="button"
          >
            <Text style={styles.editBarBtnText}>
              {t('simpCountAddProduct')}
            </Text>
          </Pressable>
          <Pressable
            style={styles.editBarBtnDone}
            onPress={() => {
              setEditMode(false);
              setProductEditor(null);
              setArmedItemId(null);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.editBarBtnDoneText}>
              {t('simpCountEditDone')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {categoryId === 'stock_values' ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stockHeadRow}>
            <Text style={[styles.stockHeadCell, { flex: 1.4 }]}>
              {t('simpCountStockColCategory')}
            </Text>
            <Text style={[styles.stockHeadCell, styles.stockHeadRight]}>
              {t('simpCountStockColTotal')}
            </Text>
            <Text style={[styles.stockHeadCell, styles.stockHeadPct]}>
              {t('simpCountStockColShare')}
            </Text>
          </View>
          {stockOverview.rows.map((row) => {
            const priorLine =
              row.prior == null
                ? t('simpCountStockPriorNone')
                : row.delta == null || row.delta === 0
                  ? t('simpCountStockPriorFlat')
                  : row.delta > 0
                    ? t('simpCountStockPriorUp').replace(
                        '{amount}',
                        formatMoney(row.delta),
                      )
                    : t('simpCountStockPriorDown').replace(
                        '{amount}',
                        formatMoney(Math.abs(row.delta)),
                      );
            const priorAmt =
              row.prior == null
                ? null
                : t('simpCountStockPrior').replace(
                    '{amount}',
                    formatMoney(row.prior),
                  );
            return (
              <Pressable
                key={row.id}
                style={styles.overviewCard}
                onPress={() => setCategoryId(row.id)}
              >
                <View style={{ flex: 1.4, minWidth: 0 }}>
                  <Text style={styles.overviewTitle}>{row.label}</Text>
                  <Text style={styles.overviewSub}>
                    {t('simpCountItemsCount').replace(
                      '{count}',
                      String(row.count),
                    )}
                  </Text>
                  {priorAmt ? (
                    <Text style={styles.overviewPrior}>{priorAmt}</Text>
                  ) : null}
                  <Text
                    style={[
                      styles.overviewDelta,
                      row.delta != null && row.delta > 0
                        ? styles.overviewDeltaUp
                        : row.delta != null && row.delta < 0
                          ? styles.overviewDeltaDown
                          : null,
                    ]}
                  >
                    {priorLine}
                  </Text>
                </View>
                <Text style={styles.overviewTotal}>
                  {row.total > 0
                    ? `${formatMoney(row.total)} €`
                    : t('simpCountStockEmptyDash')}
                </Text>
                <Text style={styles.overviewPct}>
                  {t('simpCountStockSharePct').replace('{pct}', String(row.pct))}
                </Text>
              </Pressable>
            );
          })}
          <View style={[styles.overviewCard, styles.overviewFoodTotal]}>
            <Text style={[styles.overviewTitle, { flex: 1.4 }]}>
              {t('simpCountStockFoodValue')}
            </Text>
            <Text style={styles.overviewTotal}>
              {formatMoney(stockOverview.foodTotal)} €
            </Text>
            <Text style={styles.overviewPct}>100 %</Text>
          </View>
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
                    armed={armedItemId === item.id}
                    hideLabel={t('simpCountHideProduct')}
                    editDetailsLabel={t('simpCountEditDetails')}
                    onHide={() => hideItem(item.id)}
                    onEditDetails={() =>
                      openProductEditor({ mode: 'edit', itemId: item.id })
                    }
                    onLongPress={() => {
                      setSelectedId(item.id);
                      setArmedItemId(item.id);
                      setEditMode(true);
                    }}
                    onSelect={() => {
                      setSelectedId(item.id);
                      if (armedItemId && armedItemId !== item.id) {
                        setArmedItemId(null);
                      }
                    }}
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
          style={styles.dockBtn}
          onPress={() => setPicker('category')}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountPickCategory')}
        >
          <CategoryIcon size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          style={[styles.dockBtn, editMode && styles.dockBtnOn]}
          onPress={toggleEditMode}
          disabled={isOverview}
          accessibilityRole="button"
          accessibilityState={{ selected: editMode }}
          accessibilityLabel={t('simpCountEdit')}
        >
          <EditIcon
            size={22}
            color={editMode ? colors.primaryMid : colors.primary}
          />
        </Pressable>
        <Pressable
          style={styles.dockBtn}
          onPress={() => {
            setListScanKind(null);
            setListScanOpen(true);
          }}
          disabled={listScanBusy}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountScanList')}
        >
          <CameraIcon size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          style={styles.dockBtn}
          onPress={() => nudgeSelected(5)}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountPlus5')}
        >
          <PlusFiveBadge size={22} color={colors.primary} />
        </Pressable>

        <Pressable
          style={[
            styles.dockBtn,
            styles.dockBtnAccent,
            (!selectedItem || isOverview || editMode) && styles.dockBtnDisabled,
          ]}
          onPress={openCalculator}
          disabled={!selectedItem || isOverview || editMode}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountCalculator')}
        >
          <CalcIcon size={22} color={colors.primary} />
        </Pressable>

        <Pressable
          style={[
            styles.dockBtn,
            styles.dockBtnAccent,
            (filteredItems.length === 0 || isOverview || editMode) &&
              styles.dockBtnDisabled,
          ]}
          onPress={enterGameMode}
          disabled={filteredItems.length === 0 || isOverview || editMode}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameMode')}
        >
          <FlameIcon size={22} color={colors.primary} />
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
              <Text style={styles.calcDisplayText} numberOfLines={1}>
                {calcDigits === '' ? '0' : calcDigits}
              </Text>
              <Text style={styles.calcUnit}>
                {selectedItem?.unit ?? ''}
              </Text>
            </View>
            <View style={styles.calcPad}>
              {(
                [
                  ['7', '8', '9', '÷'],
                  ['4', '5', '6', '×'],
                  ['1', '2', '3', '−'],
                  ['C', '0', '.', '+'],
                ] as const
              ).map((row) => (
                <View key={row.join('-')} style={styles.calcPadRow}>
                  {row.map((key) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.calcKey,
                        /[+\−×÷]/.test(key) && styles.calcKeyOp,
                        key === 'C' && styles.calcKeyClear,
                      ]}
                      onPress={() =>
                        pushCalcKey(key === '−' ? '-' : key)
                      }
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
                  style={[styles.calcKey, styles.calcKeyEq]}
                  onPress={() => pushCalcKey('=')}
                  accessibilityRole="button"
                  accessibilityLabel="="
                >
                  <Text style={styles.calcKeyText}>=</Text>
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
        onRequestClose={() => {
          setListScanOpen(false);
          setListScanKind(null);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setListScanOpen(false);
            setListScanKind(null);
          }}
        >
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
          >
            {listScanKind == null ? (
              <>
                <Text style={styles.sheetTitle}>
                  {t('simpCountScanKindTitle')}
                </Text>
                <Text style={styles.sheetSub}>{t('simpCountScanListSub')}</Text>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => setListScanKind('count')}
                >
                  <Text style={styles.sheetRowText}>
                    {t('simpCountScanKindCount')}
                  </Text>
                  <Text style={styles.sheetRowMuted}>
                    {t('simpCountScanKindCountSub')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => setListScanKind('supplier')}
                >
                  <Text style={styles.sheetRowText}>
                    {t('simpCountScanKindSupplier')}
                  </Text>
                  <Text style={styles.sheetRowMuted}>
                    {t('simpCountScanKindSupplierSub')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => void openPriceHistory()}
                >
                  <Text style={styles.sheetRowText}>
                    {t('simpCountPriceHistory')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => {
                    setListScanOpen(false);
                    setListScanKind(null);
                  }}
                >
                  <Text style={styles.sheetRowMuted}>
                    {t('simpCountAddCancel')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>
                  {listScanKind === 'supplier'
                    ? t('simpCountScanKindSupplier')
                    : t('simpCountScanKindCount')}
                </Text>
                <Text style={styles.sheetSub}>
                  {listScanKind === 'supplier'
                    ? t('simpCountScanKindSupplierSub')
                    : t('simpCountScanKindCountSub')}
                </Text>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => void scanListPhotos(true, listScanKind)}
                >
                  <Text style={styles.sheetRowText}>
                    {t('simpCountScanCamera')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => void scanListPhotos(false, listScanKind)}
                >
                  <Text style={styles.sheetRowText}>
                    {t('simpCountScanLibrary')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.sheetRow}
                  onPress={() => setListScanKind(null)}
                >
                  <Text style={styles.sheetRowMuted}>
                    {t('simpCountAddCancel')}
                  </Text>
                </Pressable>
              </>
            )}
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
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSettingsOpen(false)}
        >
          <Pressable
            style={[styles.sheet, styles.hiddenSheet]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>{t('simpCountExtraSettings')}</Text>
            <Text style={styles.sheetSub}>{t('simpCountExportSub')}</Text>

            <Text style={styles.editFieldLabel}>{t('simpCountExportTitle')}</Text>
            {(
              [
                {
                  id: 'category' as const,
                  label: t('simpCountExportScopeCategory'),
                },
                { id: 'all' as const, label: t('simpCountExportScopeAll') },
                {
                  id: 'blank' as const,
                  label: t('simpCountExportScopeBlank'),
                },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  styles.sheetRow,
                  exportScope === opt.id && styles.sheetRowOn,
                ]}
                onPress={() => setExportScope(opt.id)}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    exportScope === opt.id && styles.sheetRowTextOn,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            {exportScope === 'blank' ? (
              <Text style={styles.sheetSub}>
                {t('simpCountExportScopeBlankSub')}
              </Text>
            ) : null}

            <View style={styles.editChipRow}>
              {(
                [
                  { id: 'pdf' as const, label: t('simpCountExportPdf') },
                  { id: 'excel' as const, label: t('simpCountExportExcel') },
                ] as const
              ).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[
                    styles.editChip,
                    exportFormat === opt.id && styles.editChipOn,
                  ]}
                  onPress={() => setExportFormat(opt.id)}
                >
                  <Text
                    style={[
                      styles.editChipText,
                      exportFormat === opt.id && styles.editChipTextOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.editPopupSave, exportBusy && { opacity: 0.6 }]}
              onPress={() => void runExport()}
              disabled={exportBusy}
            >
              <Text style={styles.editPopupSaveText}>
                {exportBusy ? t('simpCountExportBusy') : t('simpCountExportGo')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => setSettingsOpen(false)}
            >
              <Text style={styles.sheetRowMuted}>{t('simpCountAddCancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={priceHistoryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceHistoryOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPriceHistoryOpen(false)}
        >
          <Pressable
            style={[styles.sheet, styles.hiddenSheet]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>{t('simpCountPriceHistory')}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {priceHistoryRows.length === 0 ? (
                <Text style={styles.sheetRowMuted}>
                  {t('simpCountPriceHistoryEmptyMonth').replace(
                    '{month}',
                    months[monthIndex] ?? priceHistoryMonthKey,
                  )}
                </Text>
              ) : (
                priceHistoryRows.map((group) => {
                  const prev = group.previous;
                  const delta =
                    prev &&
                    t('simpCountPriceHistoryDelta')
                      .replace('{from}', prev.unitPriceAlv0.toFixed(2))
                      .replace('{to}', group.current.unitPriceAlv0.toFixed(2));
                  return (
                    <View key={group.productKey} style={styles.hiddenRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.hiddenRowName} numberOfLines={2}>
                          {group.name}
                        </Text>
                        <Text style={styles.sheetRowMuted}>
                          {group.current.monthKey} ·{' '}
                          {group.current.unitPriceAlv0.toFixed(2)} €
                          {delta ? ` · ${delta}` : ''}
                          {group.current.appliedToInventory ? ` · ✓` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.sheetRow} onPress={exportPriceHistoryMonth}>
              <Text style={styles.sheetRowText}>
                {t('simpCountPriceHistoryExport')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.sheetRow}
              onPress={() => setPriceHistoryOpen(false)}
            >
              <Text style={styles.sheetRowMuted}>{t('simpCountAddCancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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
      <Modal
        visible={productEditor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setProductEditor(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setProductEditor(null)}
        >
          <Pressable
            style={[styles.sheet, styles.productEditorSheet]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.sheetTitle}>
              {productEditor?.mode === 'edit'
                ? t('simpCountEditDetails')
                : t('simpCountAddProduct')}
            </Text>
            <Text style={styles.sheetSub}>{t('simpCountEditPopupSub')}</Text>
            <ScrollView
              style={{ maxHeight: 420 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.editFieldLabel}>{t('simpCountAddName')}</Text>
              <TextInput
                value={editNameEn}
                onChangeText={setEditNameEn}
                style={styles.editFieldInput}
                placeholder={t('simpCountAddName')}
                placeholderTextColor={colors.inkFaint}
              />
              <Text style={styles.editFieldLabel}>
                {t('simpCountAddNameFi')}
              </Text>
              <TextInput
                value={editNameFi}
                onChangeText={setEditNameFi}
                style={styles.editFieldInput}
                placeholder={t('simpCountAddNameFi')}
                placeholderTextColor={colors.inkFaint}
              />
              <Text style={styles.editFieldLabel}>
                {t('simpCountAddCategory')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.editChipRow}
              >
                {ITEM_CATEGORY_IDS.map((cid) => {
                  const meta = SIMPLIFIED_CATEGORIES.find((c) => c.id === cid);
                  const on = editCategoryId === cid;
                  return (
                    <Pressable
                      key={cid}
                      style={[styles.editChip, on && styles.editChipOn]}
                      onPress={() => setEditCategoryId(cid)}
                    >
                      <Text
                        style={[
                          styles.editChipText,
                          on && styles.editChipTextOn,
                        ]}
                      >
                        {t(meta?.labelKey ?? 'simpCountCatOther')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.editFieldLabel}>{t('simpCountAddUnit')}</Text>
              <View style={styles.editChipRow}>
                {ADD_UNIT_CHOICES.map((u) => {
                  const on = editUnit === u;
                  return (
                    <Pressable
                      key={u}
                      style={[styles.editChip, on && styles.editChipOn]}
                      onPress={() => setEditUnit(u)}
                    >
                      <Text
                        style={[
                          styles.editChipText,
                          on && styles.editChipTextOn,
                        ]}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.editFieldLabel}>
                {t('simpCountAddPrice')}
              </Text>
              <TextInput
                value={editPrice}
                onChangeText={setEditPrice}
                style={styles.editFieldInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.inkFaint}
              />
              <Text style={styles.editFieldLabel}>
                {t('simpCountAddAliases')}
              </Text>
              <TextInput
                value={editAliases}
                onChangeText={setEditAliases}
                style={styles.editFieldInput}
                placeholder={t('simpCountAddAliasesPh')}
                placeholderTextColor={colors.inkFaint}
              />
            </ScrollView>
            <View style={styles.editPopupActions}>
              <Pressable
                style={styles.editPopupCancel}
                onPress={() => setProductEditor(null)}
              >
                <Text style={styles.sheetRowMuted}>
                  {t('simpCountAddCancel')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.editPopupSave}
                onPress={saveProductEditor}
              >
                <Text style={styles.editPopupSaveText}>
                  {productEditor?.mode === 'edit'
                    ? t('simpCountEditSave')
                    : t('simpCountAddSave')}
                </Text>
              </Pressable>
            </View>
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
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: '#000000',
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
    borderWidth: 1.5,
    borderColor: 'rgba(180,35,24,0.35)',
    backgroundColor: 'rgba(253,236,236,0.95)',
  },
  rowActionFabs: {
    position: 'absolute',
    top: -10,
    left: -8,
    zIndex: 5,
    flexDirection: 'row',
    gap: 6,
  },
  hideFab: {
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
  editFab: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...neoShadow,
  },
  editFabGlyph: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  editBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  editBarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(11,79,138,0.18)',
  },
  editBarBtnDisabled: { opacity: 0.45 },
  editBarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  editBarBtnDone: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  editBarBtnDoneText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  productEditorSheet: {
    maxHeight: '88%',
  },
  editFieldLabel: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  editFieldInput: {
    backgroundColor: NEO_BG,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  editChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  editChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: NEO_BG,
  },
  editChipOn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  editChipTextOn: {
    color: colors.primary,
    fontWeight: '800',
  },
  editPopupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  editPopupCancel: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  editPopupSave: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editPopupSaveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: NEO_CARD,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    gap: 8,
    ...neoShadow,
  },
  overviewFoodTotal: {
    backgroundColor: 'rgba(168,197,240,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(11,79,138,0.18)',
    alignItems: 'center',
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
  overviewPrior: {
    marginTop: 4,
    fontSize: 11,
    color: colors.inkMuted,
  },
  overviewDelta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  overviewDeltaUp: {
    color: '#1B7A4A',
  },
  overviewDeltaDown: {
    color: '#B42318',
  },
  overviewTotal: {
    minWidth: 78,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  overviewPct: {
    minWidth: 44,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  stockHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  stockHeadCell: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  stockHeadRight: {
    minWidth: 78,
    textAlign: 'right',
  },
  stockHeadPct: {
    minWidth: 44,
    textAlign: 'right',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    marginRight: 8,
  },
  settingsGlyph: {
    fontSize: 16,
    color: colors.primary,
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
  dockBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    ...neoShadow,
  },
  dockBtnAccent: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(11,79,138,0.18)',
  },
  dockBtnOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dockBtnDisabled: {
    opacity: 0.4,
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
  calcKeyOp: {
    backgroundColor: 'rgba(184,232,216,0.55)',
  },
  calcKeyClear: {
    backgroundColor: 'rgba(245,198,208,0.55)',
  },
  calcKeyEq: {
    backgroundColor: 'rgba(168,197,240,0.55)',
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
    gap: 4,
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
