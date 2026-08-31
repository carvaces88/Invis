import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedFridgeLogo } from './AnimatedFridgeLogo';
import { useI18n } from '../i18n';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

export type WelcomeStartAction = 'scanFridge' | 'importSheet' | 'catalog';

type Props = {
  onStart: (action: WelcomeStartAction) => void;
  onSkip: () => void;
};

type Option = {
  key: WelcomeStartAction;
  titleKey: 'welcomeScanFridge' | 'welcomeImport' | 'welcomeCatalog';
  subKey: 'welcomeScanFridgeSub' | 'welcomeImportSub' | 'welcomeCatalogSub';
  primary?: boolean;
};

const OPTIONS: Option[] = [
  {
    key: 'scanFridge',
    titleKey: 'welcomeScanFridge',
    subKey: 'welcomeScanFridgeSub',
    primary: true,
  },
  {
    key: 'importSheet',
    titleKey: 'welcomeImport',
    subKey: 'welcomeImportSub',
  },
  {
    key: 'catalog',
    titleKey: 'welcomeCatalog',
    subKey: 'welcomeCatalogSub',
  },
];

/**
 * Soft welcome for empty inventory — sous-chef tone, one calm composition.
 * Does not block forever: Skip reveals the normal Home sheet.
 */
export function WelcomeOnboarding({ onStart, onSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <AnimatedFridgeLogo accessibilityLabel={t('appBrand')} size={72} />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.kicker}>
            {t('appBrand')} · {t('welcomeKicker')}
          </Text>
          <Text style={styles.title}>{t('welcomeTitle')}</Text>
        </View>
      </View>

      <Text style={styles.prompt}>{t('welcomePrompt')}</Text>
      <Text style={styles.filesAsk}>{t('welcomeFilesAsk')}</Text>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => onStart(opt.key)}
            style={({ pressed }) => [
              opt.primary ? styles.primaryCard : styles.secondaryCard,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t(opt.titleKey)}
          >
            <Text
              style={opt.primary ? styles.primaryTitle : styles.secondaryTitle}
            >
              {t(opt.titleKey)}
            </Text>
            <Text
              style={opt.primary ? styles.primarySub : styles.secondarySub}
            >
              {t(opt.subKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onSkip}
        style={({ pressed }) => [
          styles.skipButton,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('welcomeSkip')}
      >
        <Text style={styles.skipText}>{t('welcomeSkip')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  brandMark: {
    marginTop: 2,
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: -0.1,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  prompt: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  filesAsk: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  primaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg + 4,
    paddingHorizontal: spacing.lg,
    ...shadows.float,
  },
  primaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  primarySub: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  secondaryCard: {
    ...surfaces.float,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  secondaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  secondarySub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  skipButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    ...shadows.soft,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.inkMuted,
  },
});
