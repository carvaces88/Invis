import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { alertInfo } from '../lib/alertAck';
import {
  persistPickerAsset,
  visionPickerOptions,
} from '../lib/persistImageUri';
import { analyzePriorStockListImages } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

const MAX_PHOTOS = 8;

/**
 * Multi-photo prior stock list / inventaariopohja → OCR → validate.
 */
export function SheetImportScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function pick(fromCamera: boolean) {
    const remaining = MAX_PHOTOS - uris.length;
    if (remaining <= 0) {
      alertInfo(t('sheetImportTitle'), t('sheetImportMaxPhotos'));
      return;
    }
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alertInfo(t('sheetImportTitle'), t('sheetImportNeedPermission'));
      return;
    }
    if (fromCamera) {
      const result = await ImagePicker.launchCameraAsync(
        visionPickerOptions({ quality: 0.85 }),
      );
      if (!result.canceled && result.assets[0]) {
        const uri = await persistPickerAsset(result.assets[0]);
        setUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(
      visionPickerOptions({
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      }),
    );
    if (!result.canceled && result.assets.length) {
      const next: string[] = [];
      for (const asset of result.assets) {
        next.push(await persistPickerAsset(asset));
      }
      setUris((prev) => [...prev, ...next].slice(0, MAX_PHOTOS));
    }
  }

  function removeAt(index: number) {
    setUris((prev) => prev.filter((_, i) => i !== index));
  }

  async function analyze() {
    if (!uris.length) {
      alertInfo(t('sheetImportTitle'), t('sheetImportNeedPhoto'));
      return;
    }
    setBusy(true);
    try {
      const document = await analyzePriorStockListImages(uris);
      if (!document.lines.length) {
        alertInfo(t('sheetImportTitle'), t('sheetImportEmpty'));
        return;
      }
      navigation.navigate('SheetImportReview', {
        document,
        imageUri: uris[0],
        imageUris: uris,
      });
    } catch (err) {
      alertInfo(
        t('sheetImportTitle'),
        err instanceof Error ? err.message : t('sheetImportFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={styles.kicker}>{t('sheetImportKicker')}</Text>
      <Text style={styles.title}>{t('sheetImportTitle')}</Text>
      <Text style={styles.sub}>{t('sheetImportSub')}</Text>

      <ScrollView
        horizontal
        style={styles.previewScroll}
        contentContainerStyle={styles.previewRow}
        showsHorizontalScrollIndicator={false}
      >
        {uris.length === 0 ? (
          <View style={styles.previewEmpty}>
            <Text style={styles.placeholder}>{t('sheetImportPlaceholder')}</Text>
          </View>
        ) : (
          uris.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeAt(i)}
                accessibilityRole="button"
                accessibilityLabel={t('sheetImportRemovePhoto')}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      {uris.length > 0 ? (
        <Text style={styles.count}>
          {t('sheetImportPhotoCount')
            .replace('{n}', String(uris.length))
            .replace('{max}', String(MAX_PHOTOS))}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => void pick(false)}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>{t('sheetImportUpload')}</Text>
        </Pressable>
        <Pressable
          style={styles.btnGhost}
          onPress={() => void pick(true)}
          accessibilityRole="button"
        >
          <Text style={styles.btnGhostText}>{t('sheetImportCamera')}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.analyze, (!uris.length || busy) && { opacity: 0.65 }]}
        disabled={!uris.length || busy}
        onPress={() => void analyze()}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeText}>{t('sheetImportAnalyze')}</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>{t('sheetImportHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  title: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  previewScroll: {
    maxHeight: 160,
    marginBottom: spacing.sm,
  },
  previewRow: {
    gap: spacing.sm,
    alignItems: 'center',
    minHeight: 140,
  },
  previewEmpty: {
    minWidth: 280,
    height: 140,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  thumbWrap: {
    width: 120,
    height: 140,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  placeholder: {
    color: colors.inkFaint,
    fontSize: 14,
    textAlign: 'center',
  },
  count: {
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnGhostText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  analyze: {
    backgroundColor: colors.success,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  analyzeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  hint: {
    marginTop: spacing.md,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkFaint,
  },
});
