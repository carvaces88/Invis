import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GamifiedCountingView } from '../components/GamifiedCountingView';
import {
  alsoKnownAsLabel,
  categoryTotal,
  itemMatchesQuery,
  lineTotal,
  PLACEHOLDER_BY_CATEGORY,
  SIMPLIFIED_CATEGORIES,
  type SimplifiedCategoryId,
  type SimplifiedCountItem,
} from '../data/simplifiedCountingSeed';
import type { RootStackParamList, UnitCode } from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

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

function cloneSeed(): Record<SimplifiedCategoryId, SimplifiedCountItem[]> {
  const out = {} as Record<SimplifiedCategoryId, SimplifiedCountItem[]>;
  for (const cat of SIMPLIFIED_CATEGORIES) {
    if (cat.id === 'stock_values') {
      out[cat.id] = [];
      continue;
    }
    const src = PLACEHOLDER_BY_CATEGORY[cat.id] ?? [];
    out[cat.id] = src.map((row) => ({ ...row }));
  }
  return out;
}

type CountRowProps = {
  item: SimplifiedCountItem;
  name: string;
  alsoAs: string | null;
  selected: boolean;
  onSelect: () => void;
  onDelta: (delta: number) => void;
};

function webTitleProps(title: string | null | undefined) {
  if (Platform.OS !== 'web' || !title) return undefined;
  return { title } as { title: string };
}

function CountRow({
  item,
  name,
  alsoAs,
  selected,
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
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
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
    [onDelta, onSelect, pan, flash],
  );

  const tint = flash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['rgba(180,35,24,0.12)', 'transparent', 'rgba(31,122,77,0.14)'],
  });

  const total = lineTotal(item);

  return (
    <Animated.View
      style={[
        styles.rowCard,
        selected && styles.rowCardSelected,
        { transform: [{ translateX: pan }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: radius.lg }]}
      />
      <Pressable onPress={onSelect} style={styles.rowInner}>
        <Text
          style={[styles.colProduct, styles.cellText]}
          numberOfLines={2}
          accessibilityLabel={alsoAs ? `${name}. ${alsoAs}` : name}
          {...webTitleProps(alsoAs)}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.colQty,
            styles.cellText,
            item.quantity === 0 && styles.colQtyZero,
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

  const items =
    categoryId === 'stock_values' ? [] : (byCategory[categoryId] ?? []);

  const filteredItems = useMemo(
    () => items.filter((row) => itemMatchesQuery(row, searchQuery)),
    [items, searchQuery],
  );

  const selectedItem = useMemo(
    () => items.find((row) => row.id === selectedId) ?? null,
    [items, selectedId],
  );

  const total = useMemo(() => {
    if (categoryId === 'stock_values') {
      return SIMPLIFIED_CATEGORIES.filter((c) => c.id !== 'stock_values').reduce(
        (sum, c) => sum + categoryTotal(byCategory[c.id] ?? []),
        0,
      );
    }
    return categoryTotal(items);
  }, [byCategory, categoryId, items]);

  const categoryLabel = t(
    SIMPLIFIED_CATEGORIES.find((c) => c.id === categoryId)?.labelKey ??
      'simpCountCatDairy',
  );

  const applyDelta = useCallback(
    (id: string, delta: number) => {
      if (categoryId === 'stock_values') return;
      setByCategory((prev) => {
        const list = prev[categoryId] ?? [];
        return {
          ...prev,
          [categoryId]: list.map((row) => {
            if (row.id !== id) return row;
            const next = Math.max(0, Math.round((row.quantity + delta) * 100) / 100);
            return { ...row, quantity: next };
          }),
        };
      });
      setSelectedId(id);
    },
    [categoryId],
  );

  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      if (categoryId === 'stock_values') return;
      const next = Math.max(0, Math.round(quantity * 100) / 100);
      setByCategory((prev) => {
        const list = prev[categoryId] ?? [];
        return {
          ...prev,
          [categoryId]: list.map((row) =>
            row.id === id ? { ...row, quantity: next } : row,
          ),
        };
      });
      setSelectedId(id);
    },
    [categoryId],
  );

  const setUnit = useCallback(
    (id: string, unit: UnitCode) => {
      if (categoryId === 'stock_values') return;
      setByCategory((prev) => {
        const list = prev[categoryId] ?? [];
        return {
          ...prev,
          [categoryId]: list.map((row) =>
            row.id === id ? { ...row, unit } : row,
          ),
        };
      });
      setSelectedId(id);
    },
    [categoryId],
  );

  const enterGameMode = () => {
    if (items.length === 0 || categoryId === 'stock_values') return;
    const start = selectedId
      ? Math.max(
          0,
          items.findIndex((row) => row.id === selectedId),
        )
      : 0;
    setGameIndex(start === -1 ? 0 : start);
    setGameMode(true);
  };

  const nudgeSelected = (delta: number) => {
    if (!selectedId || categoryId === 'stock_values') return;
    applyDelta(selectedId, delta);
  };

  const openCalculator = () => {
    if (!selectedItem || categoryId === 'stock_values') return;
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

  const stockOverview = useMemo(() => {
    return SIMPLIFIED_CATEGORIES.filter((c) => c.id !== 'stock_values').map(
      (c) => ({
        id: c.id,
        label: t(c.labelKey),
        total: categoryTotal(byCategory[c.id] ?? []),
        count: (byCategory[c.id] ?? []).length,
      }),
    );
  }, [byCategory, t]);

  if (gameMode) {
    return (
      <GamifiedCountingView
        items={items}
        index={gameIndex}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onIndexChange={setGameIndex}
        onSetQuantity={setQuantity}
        onSetUnit={setUnit}
        onExit={() => {
          const current = items[gameIndex];
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
        </View>
      ) : null}

      <View style={styles.banner}>
        <View style={styles.bannerWash} />
        <Text style={styles.bannerTitle}>{categoryLabel.toUpperCase()}</Text>
        <Text style={styles.bannerTotal}>
          {t('simpCountTotal').replace('{amount}', formatMoney(total))}
        </Text>
        <Text style={styles.bannerHint}>{t('simpCountSwipeHint')}</Text>
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
            {items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('simpCountEmptyTitle')}</Text>
                <Text style={styles.emptySub}>{t('simpCountEmptySub')}</Text>
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('simpCountSearchEmpty')}</Text>
                <Text style={styles.emptySub}>{t('simpCountSearchEmptySub')}</Text>
              </View>
            ) : (
              filteredItems.map((item) => {
                const name = locale === 'fi' ? item.nameFi : item.nameEn;
                const alsoAs = alsoKnownAsLabel(item, locale, t('alsoAs'));
                return (
                  <CountRow
                    key={item.id}
                    item={item}
                    name={name}
                    alsoAs={alsoAs}
                    selected={selectedId === item.id}
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
          style={styles.dockIcon}
          onPress={() => setByCategory(cloneSeed())}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountReset')}
        >
          <Text style={styles.dockIconGlyph}>↻</Text>
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
            (!selectedItem || categoryId === 'stock_values') &&
              styles.dockCalcDisabled,
          ]}
          onPress={openCalculator}
          disabled={!selectedItem || categoryId === 'stock_values'}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountCalculator')}
        >
          <Text style={styles.dockCalcGlyph}>123</Text>
          <Text style={styles.dockCalcLabel}>{t('simpCountCalculator')}</Text>
        </Pressable>

        <Pressable
          style={[
            styles.dockGame,
            (items.length === 0 || categoryId === 'stock_values') &&
              styles.dockCalcDisabled,
          ]}
          onPress={enterGameMode}
          disabled={items.length === 0 || categoryId === 'stock_values'}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameMode')}
        >
          <Text style={styles.dockGameGlyph}>▶</Text>
          <Text style={styles.dockGameLabel}>{t('simpCountGameMode')}</Text>
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
    paddingHorizontal: spacing.md,
    marginBottom: 12,
  },
  searchInput: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 132,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: GRADIENT_TEAL,
    ...neoShadow,
  },
  dockCalcDisabled: {
    opacity: 0.45,
  },
  dockCalcGlyph: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  dockCalcLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  dockGame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 118,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
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
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  dockGameLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
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
});
