import React, { useMemo, useState } from 'react';
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
import type { IngredientType, RootStackParamList } from '../data/types';
import { INGREDIENT_TYPE_LABELS } from '../data/units';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

const TYPES = Object.keys(INGREDIENT_TYPE_LABELS) as IngredientType[];

export function CatalogScreen() {
  const insets = useSafeAreaInsets();
  const { products } = useInventory();
  const { t } = useI18n();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [typeFilter, setTypeFilter] = useState<IngredientType | 'all'>('all');
  const [browseMode, setBrowseMode] = useState<'type' | 'az'>('type');

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
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <ProductSearchInput
          products={products}
          onSelect={() => {}}
          placeholder={t('catalogSearchPlaceholder')}
        />
      </View>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setBrowseMode('type')}
          style={[styles.chip, browseMode === 'type' && styles.chipOn]}
        >
          <Text
            style={[styles.chipText, browseMode === 'type' && styles.chipTextOn]}
          >
            {t('byIngredient')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setBrowseMode('az')}
          style={[styles.chip, browseMode === 'az' && styles.chipOn]}
        >
          <Text
            style={[styles.chipText, browseMode === 'az' && styles.chipTextOn]}
          >
            {t('azName')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            navigation.navigate('AddProduct', { prefillName: '' })
          }
          style={[styles.chip, styles.addChip]}
        >
          <Text style={[styles.chipText, styles.addChipText]}>
            {t('addToDb')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        <Pressable
          onPress={() => setTypeFilter('all')}
          style={[styles.typePill, typeFilter === 'all' && styles.typePillOn]}
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
        {TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTypeFilter(t)}
            style={[styles.typePill, typeFilter === t && styles.typePillOn]}
          >
            <Text
              style={[
                styles.typePillText,
                typeFilter === t && styles.typePillTextOn,
              ]}
            >
              {INGREDIENT_TYPE_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 100,
        }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <ProductThumb product={item} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.officialName}</Text>
                <Text style={styles.cardMeta}>
                  {INGREDIENT_TYPE_LABELS[item.ingredientType]} · {item.unit}
                  {item.packSize ? ` · ${item.packSize}` : ''} ·{' '}
                  {item.unitPriceAlv0.toFixed(2)} €
                </Text>
                <Text style={styles.aliases} numberOfLines={2}>
                  Aliases: {item.aliases.join(', ')}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  credit: { color: colors.inkFaint, marginTop: 6, fontSize: 11 },
  modeRow: {
    flexDirection: 'row',
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
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  addChip: { marginLeft: 'auto', borderColor: colors.primarySoft },
  addChipText: { color: colors.primary },
  typeRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  typePillOn: { backgroundColor: colors.primaryMid },
  typePillText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  typePillTextOn: { color: '#fff' },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 4 },
  aliases: { fontSize: 12, color: colors.accent, marginTop: 8 },
});
