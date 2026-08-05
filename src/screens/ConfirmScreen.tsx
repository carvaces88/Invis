import React, { useMemo, useState } from 'react';
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
import { CroppedImage } from '../components/CroppedImage';
import { ProductSearchInput } from '../components/ProductSearchInput';
import { PackCheckModal } from '../components/PackCheckModal';
import { PlaceChips } from '../components/PlaceChips';
import { ProductThumb } from '../components/ProductThumb';
import { useInventory } from '../data/store';
import type { ProductMatch, RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { alertAck, alertInfo } from '../lib/alertAck';
import { confirmIfRecentAdd } from '../lib/confirmIfRecentAdd';
import { bestMatch, searchProducts } from '../lib/fuzzyMatch';
import {
  shouldShowPackCheck,
  type PackCheckInfo,
  type PackCheckResolve,
} from '../lib/packUnits';
import { formatClockTime } from '../lib/relativeTime';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirm'>;

export function ConfirmScreen({ route, navigation }: Props) {
  const { extract, imageUri } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    products,
    addQuantity,
    getRecentAddWarning,
    places,
    activePlaceId,
    setActivePlaceId,
    siteName,
    setProductPackInfo,
  } = useInventory();

  const initialMatch = useMemo(
    () => bestMatch(products, extract.suggestedName),
    [products, extract.suggestedName],
  );
  const suggestions = useMemo(
    () => searchProducts(products, extract.suggestedName, 5),
    [products, extract.suggestedName],
  );

  const [selected, setSelected] = useState<ProductMatch | null>(initialMatch);
  const [qty, setQty] = useState(
    extract.quantity != null ? String(extract.quantity) : '1',
  );
  const [expiry, setExpiry] = useState(extract.expiryDate ?? '');
  const [packCheck, setPackCheck] = useState<PackCheckInfo | null>(null);

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
      alertInfo(
        'Pick a product',
        'Select a catalog match or add to database first.',
      );
      return;
    }
    const n = Number(qty.replace(',', '.'));
    if (Number.isNaN(n) || n < 0) {
      alertInfo('Quantity', 'Enter a valid quantity.');
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
      <Text style={styles.kicker}>Confirm before write</Text>
      <Text style={styles.title}>{t('fridgeIsThisProduct')}</Text>
      <Text style={styles.sub}>
        Model said “{extract.suggestedName}” (
        {Math.round(extract.confidence * 100)}%). Match to catalog, then save.
      </Text>

      {places.length > 0 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Text style={styles.label}>
            {t('placesCountingAt')}
            {siteName ? ` · ${siteName}` : ''}
          </Text>
          <PlaceChips
            places={places}
            selectedId={activePlaceId}
            onSelect={(id) => {
              if (id !== 'all') setActivePlaceId(id);
            }}
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

      {extract.rawNotes ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{extract.rawNotes}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Suggested matches</Text>
      {suggestions.length === 0 ? (
        <Text style={styles.empty}>No catalog hit for that name.</Text>
      ) : (
        suggestions.map((m) => {
          const on = selected?.product.id === m.product.id;
          return (
            <Pressable
              key={m.product.id}
              onPress={() => setSelected(m)}
              style={[styles.matchRow, on && styles.matchRowOn]}
            >
              <ProductThumb product={m.product} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.matchName}>{m.product.officialName}</Text>
                <Text style={styles.matchMeta}>
                  {m.product.unit}
                  {m.product.packSize ? ` · ${m.product.packSize}` : ''} · via “
                  {m.matchedTerm}” ({Math.round(m.score * 100)}%)
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>
        Search / change match
      </Text>
      <ProductSearchInput
        products={products}
        initialQuery={extract.suggestedName}
        onSelect={(m) => setSelected(m)}
      />

      <Pressable
        style={styles.addBtn}
        onPress={() =>
          navigation.navigate('AddProduct', {
            prefillName: extract.suggestedName,
            unit: extract.unit ?? undefined,
            returnToConfirm: true,
            extract,
            imageUri,
          })
        }
      >
        <Text style={styles.addBtnText}>Add to database</Text>
      </Pressable>

      <Text style={styles.label}>Quantity</Text>
      <TextInput
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Expiry (optional YYYY-MM-DD)</Text>
      <TextInput
        value={expiry}
        onChangeText={setExpiry}
        autoCapitalize="none"
        style={styles.input}
        placeholder="2026-08-15"
        placeholderTextColor={colors.inkFaint}
      />

      <Pressable style={styles.save} onPress={confirm}>
        <Text style={styles.saveText}>{t('fridgeYes')} · confirm stock</Text>
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
  addBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: colors.primary, fontWeight: '700' },
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
