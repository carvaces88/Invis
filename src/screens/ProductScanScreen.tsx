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
import { alertInfo } from '../lib/alertAck';
import {
  analyzeInventoryImage,
  isLiveVisionEnabled,
  isRealImageUri,
} from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

/** Single-product photo scan (previous Scan tab body) */
export function ProductScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [uri, setUri] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

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
      alertInfo(
        'Photo required',
        'Take or choose a product photo for live AI analysis.',
      );
      return;
    }
    setBusy(true);
    try {
      const extract = await analyzeInventoryImage(
        uri ?? 'demo',
        hint || undefined,
      );
      navigation.navigate('Confirm', {
        extract,
        imageUri: uri ?? undefined,
      });
    } catch (e) {
      alertInfo(
        'Analysis failed',
        e instanceof Error ? e.message : 'Could not analyze photo',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: spacing.md, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Product photo</Text>
        <Text style={styles.sub}>
          Photo → AI name → catalog match → confirm.
        </Text>
      </View>

      <View style={styles.preview}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>
            Take or choose a photo of the product / label
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

      <Text style={styles.label}>Optional hint (demo aliases)</Text>
      <TextInput
        value={hint}
        onChangeText={setHint}
        placeholder='e.g. “capers” or leave empty for demo'
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
              ? 'Analyze photo'
              : isLiveVisionEnabled()
                ? 'Add a photo to analyze'
                : 'Run demo (offline stub)'}
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
