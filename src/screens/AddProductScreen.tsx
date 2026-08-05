import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { DidYouMeanModal } from '../components/DidYouMeanModal';
import { useInventory } from '../data/store';
import type {
  IngredientType,
  ProductEnrichment,
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
import {
  enrichFromExtract,
  enrichProductFromPhotos,
} from '../lib/productEnrichment';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

const MAX_PHOTOS = 8;

function initialPhotos(params: Props['route']['params']): string[] {
  const fromSeries = params?.photoUris?.filter(Boolean) ?? [];
  if (fromSeries.length) return fromSeries.slice(0, MAX_PHOTOS);
  if (params?.imageUri) return [params.imageUri];
  return [];
}

export function AddProductScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { products, addProduct, addProductAlias, lastRecordUnit, setLastRecordUnit } =
    useInventory();
  const {
    prefillName,
    unit: prefUnit,
    packSize: prefPack,
    unitPriceAlv0: prefPrice,
    aliases: prefAliases,
    ean: prefEan,
    sourceUrl: prefSourceUrl,
    imageUrl: prefImageUrl,
    ingredientType: prefIngredient,
    brand: prefBrand,
    containerHint: prefContainer,
    returnToConfirm,
    extract,
    imageUri,
    returnToBatch,
    document,
    returnToFridge,
    fridgeDocument,
  } = route.params ?? {};

  const [photoUris, setPhotoUris] = useState<string[]>(() =>
    initialPhotos(route.params),
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [enrichNotes, setEnrichNotes] = useState<string | null>(null);
  const [officialName, setOfficialName] = useState(prefillName ?? '');
  const [aliasesText, setAliasesText] = useState(
    prefAliases?.length
      ? prefAliases.join(', ')
      : prefillName
        ? prefillName
        : '',
  );
  const [unit, setUnit] = useState<UnitCode>(
    prefUnit ?? lastRecordUnit ?? 'KPL',
  );
  const [packSize, setPackSize] = useState(prefPack ?? '');
  const [price, setPrice] = useState(
    prefPrice != null ? String(prefPrice) : '0',
  );
  const [ean, setEan] = useState(prefEan ?? '');
  const [sourceUrl, setSourceUrl] = useState(prefSourceUrl ?? '');
  const [imageUrl, setImageUrl] = useState(prefImageUrl ?? '');
  const [brand, setBrand] = useState(prefBrand ?? '');
  const [containerHint, setContainerHint] = useState(prefContainer ?? '');
  const [ingredientType, setIngredientType] = useState<IngredientType>(
    prefIngredient ?? 'other',
  );
  const [didYouMean, setDidYouMean] = useState<{
    name: string;
    candidates: ProductMatch[];
  } | null>(null);

  function applyEnrichment(e: ProductEnrichment) {
    setOfficialName(e.officialName);
    setAliasesText(
      e.aliases.length ? e.aliases.join(', ') : e.officialName,
    );
    setUnit(e.unit);
    setLastRecordUnit(e.unit);
    setPackSize(e.packSize ?? '');
    setPrice(
      e.unitPriceAlv0 != null && e.unitPriceAlv0 > 0
        ? String(e.unitPriceAlv0)
        : '0',
    );
    setEan(e.ean ?? '');
    setSourceUrl(e.sourceUrl ?? '');
    setImageUrl(e.imageUrl ?? '');
    setBrand(e.brand ?? '');
    setContainerHint(e.containerHint ?? '');
    if (e.ingredientType) setIngredientType(e.ingredientType);
    setEnrichNotes(e.notes);
  }

  // Prefill from upstream scan extract once on mount
  useEffect(() => {
    if (!extract) return;
    applyEnrichment(enrichFromExtract(extract, products));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from route
  }, []);

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

  async function pickPhotos(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const remaining = MAX_PHOTOS - photoUris.length;
    if (remaining <= 0) {
      alertInfo(t('addPhotoLimitTitle'), t('addPhotoLimitBody'));
      return;
    }

    if (fromCamera) {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.75,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
        setEnrichNotes(null);
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.75,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets.length) {
      setPhotoUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS),
      );
      setEnrichNotes(null);
    }
  }

  function removePhoto(uri: string) {
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
    setEnrichNotes(null);
  }

  async function analyzePhotos() {
    setAnalyzing(true);
    try {
      const enrichment = await enrichProductFromPhotos(
        photoUris.length ? photoUris : ['demo'],
        products,
        officialName.trim() || undefined,
      );
      applyEnrichment(enrichment);
    } finally {
      setAnalyzing(false);
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
    const brandTrim = brand.trim();
    if (
      brandTrim &&
      !aliases.some((a) => a.toLowerCase() === brandTrim.toLowerCase())
    ) {
      aliases.push(brandTrim);
    }
    const product = addProduct({
      officialName: name,
      unit,
      packSize: packSize || undefined,
      unitPriceAlv0: Number(price.replace(',', '.')) || 0,
      aliases: aliases.length ? aliases : [name],
      ingredientType,
      ean: ean.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      imageUrl: imageUrl.trim() || photoUris[0] || undefined,
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
      <Text style={styles.sub}>{t('addProductPhotoSub')}</Text>

      <Text style={styles.label}>{t('addProductPhotos')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoStrip}
      >
        {photoUris.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable
              style={styles.thumbRemove}
              onPress={() => removePhoto(uri)}
              hitSlop={8}
            >
              <Text style={styles.thumbRemoveText}>×</Text>
            </Pressable>
          </View>
        ))}
        {photoUris.length < MAX_PHOTOS ? (
          <View style={styles.addPhotoCol}>
            <Pressable
              style={styles.addPhotoBtn}
              onPress={() => pickPhotos(true)}
            >
              <Text style={styles.addPhotoBtnText}>{t('camera')}</Text>
            </Pressable>
            <Pressable
              style={[styles.addPhotoBtn, styles.addPhotoGhost]}
              onPress={() => pickPhotos(false)}
            >
              <Text style={styles.addPhotoGhostText}>{t('library')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <Text style={styles.hint}>{t('addProductPhotosHint')}</Text>

      <Pressable
        style={[styles.analyze, analyzing && { opacity: 0.7 }]}
        disabled={analyzing}
        onPress={analyzePhotos}
      >
        {analyzing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeText}>
            {photoUris.length
              ? t('addProductAnalyze')
              : t('addProductAnalyzeDemo')}
          </Text>
        )}
      </Pressable>

      {enrichNotes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>{t('addProductEnrichNotes')}</Text>
          <Text style={styles.notesBody}>{enrichNotes}</Text>
        </View>
      ) : null}

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

      <Text style={styles.label}>{t('addProductBrand')}</Text>
      <TextInput
        value={brand}
        onChangeText={setBrand}
        style={styles.input}
        placeholder="Figaro"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>{t('addProductContainer')}</Text>
      <TextInput
        value={containerHint}
        onChangeText={setContainerHint}
        style={styles.input}
        placeholder="Purkki (can / jar)"
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

      <Text style={styles.label}>{t('addProductPackSize')}</Text>
      <TextInput
        value={packSize}
        onChangeText={setPackSize}
        style={styles.input}
        placeholder="935g/600g"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>{t('addProductPrice')}</Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.label}>{t('addProductEan')}</Text>
      <TextInput
        value={ean}
        onChangeText={setEan}
        keyboardType="number-pad"
        style={styles.input}
        placeholder="6411300002355"
        placeholderTextColor={colors.inkFaint}
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
  photoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  addPhotoCol: { gap: 8 },
  addPhotoBtn: {
    minWidth: 88,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  addPhotoBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addPhotoGhost: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  addPhotoGhostText: { color: colors.inkMuted, fontWeight: '700', fontSize: 13 },
  analyze: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryMid,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyzeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  notesBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesBody: { fontSize: 13, color: colors.ink, lineHeight: 18 },
  save: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
