import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { isVideoAnalysisEnabled } from '../lib/vision';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoDemo'>;

/**
 * Live-camera / video walkthrough demo.
 * Paid for normal users; unlocked for investor walkthrough (isPro).
 */
export function VideoDemoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { isPro } = useAuth();
  const flagOn = isVideoAnalysisEnabled();
  const unlocked = isPro || flagOn;

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
      <Text style={[styles.kicker, unlocked && styles.kickerOn]}>
        {unlocked ? t('videoDemoUnlockedKicker') : t('videoDemoLockedKicker')}
      </Text>
      <Text style={styles.title}>{t('videoDemoScreenTitle')}</Text>
      <Text style={styles.body}>
        {unlocked ? t('videoDemoUnlockedBody') : t('videoDemoLockedBody')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('videoDemoStatusTitle')}</Text>
        <Text style={styles.cardBody}>
          {unlocked ? t('videoDemoStatusOn') : t('videoDemoStatusOff')}
        </Text>
      </View>
      <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>{t('videoDemoBack')}</Text>
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
  kickerOn: {
    color: colors.success,
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
