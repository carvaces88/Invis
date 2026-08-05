import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DidYouMeanModal } from '../components/DidYouMeanModal';
import { useInventory } from '../data/store';
import type {
  IngredientType,
  ProductMatch,
  RootStackParamList,
  UnitCode,
} from '../data/types';
import { INGREDIENT_TYPE_LABELS, UNIT_CODES, UNIT_LABELS } from '../data/units';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import {
  exactProductMatch,
  similarProductCandidates,
} from '../lib/fuzzyMatch';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

export function AddProductScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { products, addProduct, addProductAlias, lastRecordUnit, setLastRecordUnit } =
    useInventory();
  const {
    prefillName,
    unit: prefUnit,
    returnToConfirm,
    extract,
    imageUri,
    returnToBatch,
    document,
    returnToFridge,
    fridgeDocument,
  } = route.params ?? {};

  const [officialName, setOfficialName] = useState(prefillName ?? '');
  const [aliasesText, setAliasesText] = useState(
    prefillName ? prefillName : '',
  );
  const [unit, setUnit] = useState<UnitCode>(
    prefUnit ?? lastRecordUnit ?? 'KPL',
  );
  const [packSize, setPackSize] = useState('');
  const [price, setPrice] = useState('0');
  const [ingredientType, setIngredientType] =
    useState<IngredientType>('other');
  const [didYouMean, setDidYouMean] = useState<{
    name: string;
    candidates: ProductMatch[];
  } | null>(null);

  function navigateAfterSave() {
    if (returnToFridge && fridgeDocument) {
      navigation.replace('FridgeReview', {
        document: fridgeDocument,
        imageUri,
      });
    } else if (returnToBatch && document) {
      navigation.replace('BatchConfirm', { document, imageUri });
    } else if (returnToConfirm && extract) {
      navigation.replace('Confirm', { extract, imageUri });
    } else {
      navigation.goBack();
    }
  }

  function commitNewProduct() {
    const name = officialName.trim();
    if (!name) {
      alertInfo(t('recordNameRequiredTitle'), t('recordNameRequiredBody'));
      return;
    }
    const aliases = aliasesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const product = addProduct({
      officialName: name,
      unit,
      packSize: packSize || undefined,
      unitPriceAlv0: Number(price.replace(',', '.')) || 0,
      aliases: aliases.length ? aliases : [name],
      ingredientType,
    });
    setLastRecordUnit(unit);
    alertAck(t('recordSavedTitle'), product.officialName, navigateAfterSave);
  }

  function save() {
    const name = officialName.trim();
    if (!name) {
      alertInfo(t('recordNameRequiredTitle'), t('recordNameRequiredBody'));
      return;
    }

    const exact = exactProductMatch(products, name);
    if (exact) {
      setDidYouMean({ name, candidates: [exact] });
      return;
    }

    const similar = similarProductCandidates(products, name, 5);
    if (similar.length > 0) {
      setDidYouMean({ name, candidates: similar });
      return;
    }

    commitNewProduct();
  }

  function onMergeUseExisting(match: ProductMatch) {
    if (!didYouMean) return;
    const typed = didYouMean.name;
    const added = addProductAlias(match.product.id, typed);
    setDidYouMean(null);
    const msg = added
      ? t('didYouMeanAliasAdded')
          .replace('{alias}', typed)
          .replace('{product}', match.product.officialName)
      : match.product.officialName;
    alertAck(t('recordSavedTitle'), msg, navigateAfterSave);
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
      <Text style={styles.title}>{t('addProduct')}</Text>
      <Text style={styles.sub}>{t('catalogSub')}</Text>

      <Text style={styles.label}>{t('recordItemName')}</Text>
      <TextInput
        value={officialName}
        onChangeText={setOfficialName}
        style={styles.input}
        placeholder="Figaro Kapris etikkaliemessä 935g/600g"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>{t('alsoAs')}</Text>
      <TextInput
        value={aliasesText}
        onChangeText={setAliasesText}
        style={[styles.input, { minHeight: 72 }]}
        multiline
        placeholder="kapris, capers, figaro kapris"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>{t('unit')}</Text>
      <View style={styles.wrap}>
        {UNIT_CODES.map((u) => (
          <Pressable
            key={u}
            onPress={() => {
              setUnit(u);
              setLastRecordUnit(u);
            }}
            style={[styles.pill, unit === u && styles.pillOn]}
          >
            <Text style={[styles.pillText, unit === u && styles.pillTextOn]}>
              {u}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>{UNIT_LABELS[unit]}</Text>

      <Text style={styles.label}>{t('byIngredient')}</Text>
      <View style={styles.wrap}>
        {(Object.keys(INGREDIENT_TYPE_LABELS) as IngredientType[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setIngredientType(key)}
            style={[styles.pill, ingredientType === key && styles.pillOn]}
          >
            <Text
              style={[
                styles.pillText,
                ingredientType === key && styles.pillTextOn,
              ]}
            >
              {INGREDIENT_TYPE_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Pack size</Text>
      <TextInput
        value={packSize}
        onChangeText={setPackSize}
        style={styles.input}
        placeholder="935g/600g"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>Price (excl. VAT)</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Pressable style={styles.save} onPress={save}>
        <Text style={styles.saveText}>{t('addProduct')}</Text>
      </Pressable>

      <DidYouMeanModal
        visible={didYouMean != null}
        typedName={didYouMean?.name ?? ''}
        candidates={didYouMean?.candidates ?? []}
        onUseExisting={onMergeUseExisting}
        onCreateNew={() => {
          setDidYouMean(null);
          commitNewProduct();
        }}
        onDismiss={() => setDidYouMean(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkMuted, marginTop: 6, marginBottom: spacing.md },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  pillTextOn: { color: '#fff' },
  hint: { marginTop: 6, fontSize: 12, color: colors.inkFaint },
  save: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
