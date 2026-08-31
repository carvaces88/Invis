import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
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
import { analyzeInventaarioSheetImage } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

/**
 * Desktop-first: upload a photo of printed inventaariopohja → OCR → validate.
 */
export function SheetImportScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alertInfo(t('sheetImportTitle'), t('sheetImportNeedPermission'));
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.85,
        });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  }

  async function analyze() {
    if (!uri) {
      alertInfo(t('sheetImportTitle'), t('sheetImportNeedPhoto'));
      return;
    }
    setBusy(true);
    try {
      const document = await analyzeInventaarioSheetImage(uri);
      if (!document.lines.length) {
        alertInfo(t('sheetImportTitle'), t('sheetImportEmpty'));
        return;
      }
      navigation.navigate('SheetImportReview', {
        document,
        imageUri: uri,
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

      <View style={styles.preview}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.placeholder}>{t('sheetImportPlaceholder')}</Text>
        )}
      </View>

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
        style={[styles.analyze, (!uri || busy) && { opacity: 0.65 }]}
        disabled={!uri || busy}
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
  preview: {
    flex: 1,
    minHeight: 220,
    maxHeight: 420,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    color: colors.inkFaint,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
