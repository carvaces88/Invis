import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../data/types';
import { isVideoAnalysisEnabled } from '../lib/visionStub';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoDemo'>;

/**
 * Stub for paid live-camera / video walkthrough demo.
 * Not enabled on free/trial — architecture hook only.
 */
export function VideoDemoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const enabled = isVideoAnalysisEnabled();

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <Text style={styles.kicker}>Paid demo · not in free/trial</Text>
      <Text style={styles.title}>Live camera walkthrough</Text>
      <Text style={styles.body}>
        Later: stream frames + voice while walking the walk-in. Costs scale with
        session minutes, so this stays behind a paid flag. Image scan remains
        the default path.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <Text style={styles.cardBody}>
          {enabled
            ? 'Video analysis flag is ON'
            : 'Stub only — isVideoAnalysisEnabled() → false'}
        </Text>
      </View>
      <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Back to photo scan</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  body: {
    color: colors.inkMuted,
    marginTop: spacing.md,
    lineHeight: 22,
    fontSize: 15,
  },
  card: {
    marginTop: spacing.xl,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { fontWeight: '700', color: colors.ink },
  cardBody: { marginTop: 8, color: colors.inkMuted },
  btn: {
    marginTop: 'auto',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
