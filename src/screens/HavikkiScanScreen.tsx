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
import { analyzeHavikkiImage } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

export function HavikkiScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState<'A' | 'B'>('A');

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setUri(result.assets[0].uri);
  }

  async function analyze() {
    setBusy(true);
    try {
      const document = await analyzeHavikkiImage(uri ?? 'demo', variant);
      navigation.navigate('BatchConfirm', {
        document,
        imageUri: uri ?? undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: spacing.md, paddingBottom: insets.bottom }]}>
      <Text style={styles.kicker}>Food waste</Text>
      <Text style={styles.title}>Food waste</Text>
      <Text style={styles.sub}>
        Photograph the station waste list → match catalog → confirm subtracts
        stock and logs food waste.
      </Text>

      <View style={styles.preview}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>
            Handwritten / station waste list photo
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.btnPrimary} onPress={() => pick(true)}>
          <Text style={styles.btnPrimaryText}>Camera</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => pick(false)}>
          <Text style={styles.btnGhostText}>Library</Text>
        </Pressable>
      </View>

      <View style={styles.demoRow}>
        <Text style={styles.label}>Demo</Text>
        {(['A', 'B'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setVariant(v)}
            style={[styles.chip, variant === v && styles.chipOn]}
          >
            <Text style={[styles.chipText, variant === v && styles.chipTextOn]}>
              {v}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.analyze, busy && { opacity: 0.7 }]}
        disabled={busy}
        onPress={analyze}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.analyzeText}>
            {uri ? 'Analyze food waste' : `Run food waste demo ${variant}`}
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
  kicker: {
    color: colors.warning,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 4 },
  sub: {
    color: colors.inkMuted,
    marginTop: 6,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  preview: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
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
    paddingHorizontal: 24,
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
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  label: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 12,
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.inkMuted, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  analyze: {
    marginTop: spacing.lg,
    backgroundColor: colors.warning,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  analyzeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
