import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { ProductThumb } from '../components/ProductThumb';
import { useInventory } from '../data/store';
import type { IngredientType, Product, RootStackParamList } from '../data/types';
import { INGREDIENT_TYPE_LABELS } from '../data/units';
import { useI18n, type MessageKey } from '../i18n';
import { enrichCatalogImages } from '../lib/catalogImageEnrichment';
import {
  formatEur,
  peekCatalogListPrices,
  type CatalogListPriceCell,
  type CatalogPriceColumnId,
} from '../lib/priceComparison';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

const TYPES = Object.keys(INGREDIENT_TYPE_LABELS) as IngredientType[];

function columnHeaderKey(id: CatalogPriceColumnId): MessageKey {
  switch (id) {
    case 'kruoka':
      return 'catalogColKruoka';
    case 'skaupat':
      return 'catalogColSkaupat';
    case 'lidl':
      return 'catalogColLidl';
  }
}

function PriceCell({
  cell,
  emptyLabel,
  inventoryHint,
}: {
  cell: CatalogListPriceCell;
  emptyLabel: string;
  inventoryHint: string;
}) {
  if (cell.unitPriceAlv0 == null || cell.unitPriceAlv0 <= 0) {
    return <Text style={styles.priceEmpty}>{emptyLabel}</Text>;
  }
  return (
    <View>
      <Text style={styles.priceValue} numberOfLines={1}>
        {formatEur(cell.unitPriceAlv0)}
      </Text>
      {cell.fromInventory ? (
        <Text style={styles.priceHint}>{inventoryHint}</Text>
      ) : null}
    </View>
  );
}

function CatalogPriceRow({ product }: { product: Product }) {
  const { t } = useI18n();
  const cells = peekCatalogListPrices(product);
  return (
    <View style={styles.priceCols}>
      {cells.map((cell) => (
        <View key={cell.id} style={styles.priceCol}>
          <PriceCell
            cell={cell}
            emptyLabel={t('catalogPriceEmpty')}
            inventoryHint={t('catalogPriceInventoryHint')}
          />
        </View>
      ))}
    </View>
  );
}

export function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { products, updateProductCatalogFields } = useInventory();
  const { t } = useI18n();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [typeFilter, setTypeFilter] = useState<IngredientType | 'all'>('all');
  const [browseMode, setBrowseMode] = useState<'type' | 'az'>('type');

  // Slowly fill missing packshots from K-Ruoka / OFF (Beta images).
  // Batches continue while the Catalog tab stays mounted.
  const productsRef = useRef(products);
  productsRef.current = products;

  useEffect(() => {
    const signal = { cancelled: false };
    let timer: ReturnType<typeof setTimeout> | undefined;

    const runBatch = async () => {
      const updated = await enrichCatalogImages(
        productsRef.current,
        updateProductCatalogFields,
        { delayMs: 400, limit: 25, signal },
      );
      if (signal.cancelled) return;
      // Keep going: more SKUs may still lack images (or just joined the catalog).
      timer = setTimeout(() => {
        void runBatch();
      }, updated > 0 ? 800 : 12_000);
    };

    void runBatch();
    return () => {
      signal.cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [updateProductCatalogFields]);

  const openProduct = (productId: string) => {
    navigation.navigate('ProductDetail', { productId });
  };

  const filtered = useMemo(() => {
    let list =
      typeFilter === 'all'
        ? products
        : products.filter((p) => p.ingredientType === typeFilter);
    if (browseMode === 'az') {
      list = [...list].sort((a, b) =>
        a.officialName.localeCompare(b.officialName, 'fi'),
      );
    } else {
      list = [...list].sort((a, b) => {
        const ta = INGREDIENT_TYPE_LABELS[a.ingredientType];
        const tb = INGREDIENT_TYPE_LABELS[b.ingredientType];
        if (ta !== tb) return ta.localeCompare(tb);
        return a.officialName.localeCompare(b.officialName, 'fi');
      });
    }
    return list;
  }, [products, typeFilter, browseMode]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('catalog')}</Text>
        <Text style={styles.sub}>{t('catalogSub')}</Text>
        <Text style={styles.credit}>{t('kruokaPhotoCredit')}</Text>
        <Text style={styles.betaNote}>{t('catalogImageBetaBanner')}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <ProductSearchInput
          products={products}
          onSelect={(match) => openProduct(match.product.id)}
          placeholder={t('catalogSearchPlaceholder')}
        />
      </View>

      <View style={styles.filtersBlock}>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setBrowseMode('type')}
            style={[styles.chip, browseMode === 'type' && styles.chipOn]}
          >
            <Text
              style={[
                styles.chipText,
                browseMode === 'type' && styles.chipTextOn,
              ]}
            >
              {t('byIngredient')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBrowseMode('az')}
            style={[styles.chip, browseMode === 'az' && styles.chipOn]}
          >
            <Text
              style={[
                styles.chipText,
                browseMode === 'az' && styles.chipTextOn,
              ]}
            >
              {t('azName')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              navigation.navigate('AddProduct', { prefillName: '' })
            }
            style={[styles.chip, styles.addChip]}
            accessibilityRole="button"
            accessibilityLabel={t('addToDb')}
          >
            <Text style={[styles.chipText, styles.addChipText]}>
              {t('addToDb')}
            </Text>
          </Pressable>
        </View>

        {/*
          Keep chips in a non-flex sibling above the list. On web, FlatList
          (VirtualizedList) absolutely fills its parent and would cover this
          row if it shared the root without a dedicated listWrap below.
        */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
          contentContainerStyle={styles.typeRow}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => setTypeFilter('all')}
            style={[styles.typePill, typeFilter === 'all' && styles.typePillOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: typeFilter === 'all' }}
          >
            <Text
              style={[
                styles.typePillText,
                typeFilter === 'all' && styles.typePillTextOn,
              ]}
            >
              {t('all')}
            </Text>
          </Pressable>
          {TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setTypeFilter(type)}
              style={[
                styles.typePill,
                typeFilter === type && styles.typePillOn,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: typeFilter === type }}
            >
              <Text
                style={[
                  styles.typePillText,
                  typeFilter === type && styles.typePillTextOn,
                ]}
              >
                {INGREDIENT_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.colHeaderBlock}>
          <Text style={styles.colHint}>{t('catalogPriceColsHint')}</Text>
          <View style={styles.colHeaderRow}>
            <View style={styles.colHeaderFlex} />
            <View style={styles.priceCols}>
              {(['kruoka', 'skaupat', 'lidl'] as const).map((id) => (
                <View key={id} style={styles.priceCol}>
                  <Text style={styles.colHeaderText} numberOfLines={1}>
                    {t(columnHeaderKey(id))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.listWrap}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 100,
          }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => openProduct(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.officialName}
            >
              <View style={styles.cardRow}>
                <ProductThumb product={item} size={48} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {item.officialName}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.unit}
                    {item.packSize ? ` · ${item.packSize}` : ''}
                  </Text>
                </View>
                <CatalogPriceRow product={item} />
              </View>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  credit: { color: colors.inkFaint, marginTop: 6, fontSize: 11 },
  betaNote: {
    color: colors.inkMuted,
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
  },
  filtersBlock: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: colors.bg,
    paddingBottom: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    ...shadows.soft,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  addChip: { marginLeft: 'auto', backgroundColor: colors.primarySoft },
  addChipText: { color: colors.primary },
  typeScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingBottom: spacing.sm,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  typePillOn: { backgroundColor: colors.primary },
  typePillText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  typePillTextOn: { color: '#fff' },
  colHeaderBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  colHint: {
    fontSize: 11,
    color: colors.inkFaint,
    marginBottom: 6,
  },
  colHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  colHeaderFlex: { flex: 1 },
  colHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  /** Scopes FlatList absolute-fill so it cannot cover filters above. */
  listWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 0,
  },
  list: { flex: 1 },
  card: {
    ...surfaces.cardTight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardPressed: { opacity: 0.88 },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  priceCols: {
    flexDirection: 'row',
    width: 168,
    flexShrink: 0,
  },
  priceCol: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  priceEmpty: {
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'right',
  },
  priceHint: {
    fontSize: 9,
    color: colors.inkFaint,
    textAlign: 'right',
    marginTop: 1,
  },
});
