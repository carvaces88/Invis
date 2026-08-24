import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../data/types';
import { friendlyOptionForCode, COMMON_UNIT_OPTIONS } from '../data/units';
import { useInventory } from '../data/store';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import { useUnitSystem } from '../lib/unitSystem';
import {
  analyzeInventoryImage,
  isLiveVisionEnabled,
  isRealImageUri,
} from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

/** Single-product photo scan (previous Scan tab body) */
export function ProductScanScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { displayUnit } = useUnitSystem();
  const { lastRecordUnit } = useInventory();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [uri, setUri] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [photoQty, setPhotoQty] = useState('');
  const [busy, setBusy] = useState(false);

  const unitHintCode =
    friendlyOptionForCode(lastRecordUnit)?.code ??
    COMMON_UNIT_OPTIONS.find((o) => o.id === 'piece')!.code;

  function parsePhotoQty(): number | null {
    const n = Number(photoQty.replace(',', '.'));
    if (Number.isNaN(n) || n < 0 || photoQty.trim() === '') return null;
    return n;
  }

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

  async function analyze() {
    if (isLiveVisionEnabled() && !isRealImageUri(uri)) {
      alertInfo(t('productScanNeedPhotoTitle'), t('productScanNeedPhotoBody'));
      return;
    }
    setBusy(true);
    try {
      const extract = await analyzeInventoryImage(
        uri ?? 'demo',
        hint || undefined,
      );
      const preQty = parsePhotoQty();
      const withQty =
        preQty != null ? { ...extract, quantity: preQty } : extract;
      navigation.navigate('Confirm', {
        extract: withQty,
        imageUri: uri ?? undefined,
      });
    } catch (e) {
      alertInfo(
        t('productScanFailedTitle'),
        e instanceof Error ? e.message : t('addProductAnalyzeFailedBody'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: spacing.md, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('productScanTitle')}</Text>
        <Text style={styles.sub}>{t('productScanSub')}</Text>
      </View>

      <View style={styles.preview}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>{t('productScanPlaceholder')}</Text>
        )}
      </View>

      <View style={styles.photoMeta}>
        <Text style={styles.photoMetaLabel}>{t('photoAmountOnHand')}</Text>
        <View style={styles.photoQtyRow}>
          <TextInput
            value={photoQty}
            onChangeText={setPhotoQty}
            keyboardType="decimal-pad"
            placeholder={t('photoAmountPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            style={[styles.input, styles.photoQtyInput]}
            accessibilityLabel={t('photoAmountOnHand')}
          />
          <Text style={styles.photoUnitHint}>
            {t('photoAmountUnitHint').replace(
              '{unit}',
              displayUnit(unitHintCode),
            )}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.btnPrimary} onPress={() => pick(true)}>
          <Text style={styles.btnPrimaryText}>{t('camera')}</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => pick(false)}>
          <Text style={styles.btnGhostText}>{t('library')}</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.barcodeBtn}
        onPress={() =>
          navigation.navigate('BarcodeScan', {
            purpose: 'confirm',
            quantity: parsePhotoQty(),
          })
        }
        accessibilityRole="button"
        accessibilityLabel={t('scanBarcode')}
      >
        <Text style={styles.barcodeBtnText}>{t('scanBarcode')}</Text>
      </Pressable>

      <Text style={styles.label}>{t('productScanHintLabel')}</Text>
      <TextInput
        value={hint}
        onChangeText={setHint}
        placeholder={t('productScanHintPlaceholder')}
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        autoCapitalize="none"
      />

      <Pressable
        style={[styles.analyze, busy && { opacity: 0.7 }]}
        disabled={busy}
        onPress={analyze}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeText}>
            {uri
              ? t('productScanAnalyze')
              : isLiveVisionEnabled()
                ? t('productScanNeedPhoto')
                : t('productScanDemo')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: { marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  preview: {
    height: 220,
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
  },
  photoMeta: {
    marginTop: spacing.sm,
  },
  photoMetaLabel: {
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  photoQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoQtyInput: {
    flex: 1,
    maxWidth: 120,
  },
  photoUnitHint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
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
  barcodeBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  barcodeBtnText: { color: '#fff', fontWeight: '700' },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '600',
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
  analyze: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryMid,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyzeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
