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
import { PlaceSelect } from '../components/PlaceSelect';
import { useInventory } from '../data/store';
import { UNIT_CODES } from '../data/units';
import type {
  DocumentExtract,
  ProductMatch,
  RootStackParamList,
  UnitCode,
  VisionExtract,
} from '../data/types';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import {
  bestExtractMatch,
  isStrongCatalogMatch,
} from '../lib/fuzzyMatch';
import { formatProductDisplayName } from '../lib/formatProductDisplayName';
import {
  appendSupplierPriceObservations,
  monthKeyFromIndex,
  nameProductKey,
} from '../lib/supplierPriceHistory';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SupplierOrderReview'>;

type DraftRow = {
  key: string;
  extract: VisionExtract;
  match: ProductMatch | null;
  name: string;
  unit: UnitCode;
  price: string;
  qty: string;
  included: boolean;
};

function parseFiNumber(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(raw: string): UnitCode {
  const u = raw.trim().toUpperCase();
  const map: Record<string, UnitCode> = {
    L: 'L',
    KPL: 'KPL',
    PRK: 'PRK',
    RSA: 'RSA',
    PSS: 'PSS',
    PL: 'PL',
    PLO: 'PLO',
    LTK: 'LTK',
    KG: 'KG',
    RAS: 'RAS',
    PKT: 'PKT',
    PK: 'PKT',
  };
  return map[u] ?? (UNIT_CODES.includes(u as UnitCode) ? (u as UnitCode) : 'KPL');
}

function buildDrafts(
  document: DocumentExtract,
  products: Parameters<typeof bestExtractMatch>[0],
): DraftRow[] {
  return document.lines.map((extract, index) => {
    const suggestion = bestExtractMatch(products, extract);
    const match =
      suggestion && isStrongCatalogMatch(suggestion, extract)
        ? suggestion
        : null;
    return {
      key: `sup-${index}-${extract.suggestedName}`,
      extract,
      match,
      name: formatProductDisplayName(
        extract.suggestedName || suggestion?.product.officialName || '',
      ),
      unit: normalizeUnit(String(extract.unit || 'KPL')),
      price:
        extract.unitPriceAlv0 != null && Number.isFinite(extract.unitPriceAlv0)
          ? String(extract.unitPriceAlv0)
          : '',
      qty:
        extract.quantity != null && Number.isFinite(extract.quantity)
          ? String(extract.quantity)
          : '',
      included: true,
    };
  });
}

export function SupplierOrderReviewScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const {
    products,
    places,
    activePlaceId,
    setActivePlaceId,
    importStockListCounts,
  } = useInventory();
  const { document, imageUri, imageUris, monthIndex } = route.params;

  const [placeId, setPlaceId] = useState(activePlaceId);
  const [drafts, setDrafts] = useState<DraftRow[]>(() =>
    buildDrafts(document, products),
  );
  const [busy, setBusy] = useState(false);

  const monthKey = monthKeyFromIndex(
    typeof monthIndex === 'number' ? monthIndex : new Date().getMonth(),
  );

  const withPrice = useMemo(
    () =>
      drafts.filter((d) => d.included && parseFiNumber(d.price) != null),
    [drafts],
  );

  function patch(key: string, next: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...next } : d)),
    );
  }

  async function saveRecords(appliedToInventory: boolean) {
    if (!withPrice.length) {
      alertInfo(t('supplierOrderTitle'), t('supplierOrderNeedPrice'));
      return;
    }
    const additions = withPrice.map((d) => {
      const price = parseFiNumber(d.price)!;
      const productId = d.match?.product.id;
      return {
        productKey: productId ?? nameProductKey(d.name),
        productId,
        name: d.name.trim() || d.extract.suggestedName,
        unit: d.unit,
        unitPriceAlv0: Math.round(price * 100) / 100,
        monthKey,
        source: 'supplier_order' as const,
        supplierHint: document.title || undefined,
        imageUri: imageUri ?? imageUris?.[0],
        appliedToInventory,
      };
    });
    await appendSupplierPriceObservations(additions);
  }

  async function onRecordsOnly() {
    if (busy) return;
    setBusy(true);
    try {
      await saveRecords(false);
      alertInfo(t('supplierOrderSavedTitle'), t('supplierOrderSavedRecords'));
      navigation.goBack();
    } catch (err) {
      alertInfo(
        t('supplierOrderTitle'),
        err instanceof Error ? err.message : t('supplierOrderFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onAddToInventory() {
    if (busy) return;
    if (!withPrice.length) {
      alertInfo(t('supplierOrderTitle'), t('supplierOrderNeedPrice'));
      return;
    }
    setBusy(true);
    try {
      setActivePlaceId(placeId);
      const rows = withPrice.map((d) => ({
        productId: d.match?.product.id ?? null,
        name: d.name.trim() || d.extract.suggestedName,
        unit: d.unit,
        quantity: parseFiNumber(d.qty),
        unitPriceAlv0: parseFiNumber(d.price),
        packSize: d.extract.packSize ?? undefined,
        aliases: d.extract.aliases,
      }));
      const result = importStockListCounts({
        placeId,
        notes: document.title
          ? `Supplier order · ${document.title}`
          : 'Supplier order photo',
        rows,
      });
      await saveRecords(true);
      alertInfo(
        t('supplierOrderSavedTitle'),
        t('supplierOrderSavedInventory')
          .replace('{written}', String(result.written))
          .replace('{created}', String(result.created)),
      );
      navigation.navigate('MainTabs', { screen: 'Inventaario' });
    } catch (err) {
      alertInfo(
        t('supplierOrderTitle'),
        err instanceof Error ? err.message : t('supplierOrderFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.md }]}>
      <Text style={styles.kicker}>{t('supplierOrderKicker')}</Text>
      <Text style={styles.title}>{t('supplierOrderTitle')}</Text>
      <Text style={styles.sub}>{t('supplierOrderSub')}</Text>

      <View style={styles.placeWrap}>
        <PlaceSelect
          places={places}
          selectedId={placeId}
          onSelect={setPlaceId}
        />
      </View>

      <Text style={styles.meta}>
        {t('supplierOrderMeta')
          .replace('{n}', String(drafts.length))
          .replace('{priced}', String(withPrice.length))
          .replace('{month}', monthKey)}
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {drafts.map((d) => (
          <View
            key={d.key}
            style={[styles.card, !d.included && styles.cardOff]}
          >
            <Pressable
              onPress={() => patch(d.key, { included: !d.included })}
              style={styles.checkRow}
            >
              <Text style={styles.check}>{d.included ? '☑' : '☐'}</Text>
              <Text style={styles.matchHint} numberOfLines={1}>
                {d.match
                  ? t('supplierOrderMatched').replace(
                      '{name}',
                      d.match.product.officialName,
                    )
                  : t('supplierOrderNoMatch')}
              </Text>
            </Pressable>
            <TextInput
              value={d.name}
              onChangeText={(name) => patch(d.key, { name })}
              style={styles.input}
              placeholder={t('simpCountAddName')}
              placeholderTextColor={colors.inkFaint}
            />
            <View style={styles.row}>
              <TextInput
                value={d.price}
                onChangeText={(price) => patch(d.key, { price })}
                style={[styles.input, styles.inputHalf]}
                keyboardType="decimal-pad"
                placeholder={t('supplierOrderPricePh')}
                placeholderTextColor={colors.inkFaint}
              />
              <TextInput
                value={d.qty}
                onChangeText={(qty) => patch(d.key, { qty })}
                style={[styles.input, styles.inputHalf]}
                keyboardType="decimal-pad"
                placeholder={t('supplierOrderQtyPh')}
                placeholderTextColor={colors.inkFaint}
              />
            </View>
            <Text style={styles.unitLine}>
              {t('simpCountColUnit')}: {d.unit}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void onAddToInventory()}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>
            {t('supplierOrderAddInventory')}
          </Text>
          <Text style={styles.btnSub}>{t('supplierOrderAddInventorySub')}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnSecondary, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void onRecordsOnly()}
          accessibilityRole="button"
        >
          <Text style={styles.btnSecondaryText}>
            {t('supplierOrderRecordsOnly')}
          </Text>
          <Text style={styles.btnSubDark}>
            {t('supplierOrderRecordsOnlySub')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
  placeWrap: { marginTop: spacing.md },
  meta: {
    marginTop: 10,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  list: { flex: 1 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardOff: { opacity: 0.45 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  check: { fontSize: 18, color: colors.primary },
  matchHint: { flex: 1, fontSize: 12, color: colors.inkMuted },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 8 },
  inputHalf: { flex: 1 },
  unitLine: { fontSize: 12, color: colors.inkFaint },
  actions: { gap: 10, paddingTop: 8 },
  btn: {
    borderRadius: radius.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(11,79,138,0.2)',
  },
  btnDisabled: { opacity: 0.55 },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  btnSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 16,
  },
  btnSubDark: {
    marginTop: 4,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
});
