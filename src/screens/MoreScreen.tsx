import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { InventoryValueModal } from '../components/InventoryValueModal';
import { useInventory } from '../data/store';
import type { RootStackParamList } from '../data/types';
import { useI18n, type Locale } from '../i18n';
import { alertAck, alertConfirm } from '../lib/alertAck';
import { useUnitSystem, type UnitSystem } from '../lib/unitSystem';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

const brandWordmark = require('../../assets/invis-wordmark.png');

export function MoreScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, locale, setLocale } = useI18n();
  const { unitSystem, setUnitSystem } = useUnitSystem();
  const { clearAllInventory } = useInventory();
  const { profile, isMaster, signOut } = useAuth();
  const [valueOpen, setValueOpen] = useState(false);

  const items = [
    {
      title: t('placesTitle'),
      subtitle: t('placesSub'),
      route: 'Places' as const,
    },
    {
      title: t('recentActivityOpen'),
      subtitle: t('recentActivityOpenSub'),
      route: 'RecentActivity' as const,
    },
    {
      title: t('unitsGuide'),
      subtitle: t('unitsGuideSub'),
      route: 'UnitsGuide' as const,
    },
    {
      title: t('priceCompareTitle'),
      subtitle: t('priceCompareSub'),
      route: 'PriceComparison' as const,
    },
    {
      title: t('sheetImportOpen'),
      subtitle: t('sheetImportOpenSub'),
      route: 'SheetImport' as const,
    },
    {
      title: t('monthWrapUpOpen'),
      subtitle: t('monthWrapUpOpenSub'),
      route: 'MonthWrapUp' as const,
    },
    {
      title: t('reportsChat'),
      subtitle: t('reportsChatSub'),
      route: 'ReportsChat' as const,
    },
    {
      title: t('foodWasteLog'),
      subtitle: t('foodWasteHistory'),
      route: 'HavikkiLog' as const,
    },
    {
      title: t('videoDemo'),
      subtitle: t('videoDemoSub'),
      route: 'VideoDemo' as const,
    },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={brandWordmark}
        style={styles.wordmark}
        resizeMode="contain"
        accessibilityLabel={t('appBrand')}
      />
      <Text style={styles.title}>{t('moreTitle')}</Text>
      <Text style={styles.sub}>{t('moreSub')}</Text>
      {profile ? (
        <Text style={styles.signedIn}>
          {t('signedInAs').replace('{name}', profile.displayName)}
        </Text>
      ) : null}
      <Text style={styles.credit}>{t('kruokaPhotoCredit')}</Text>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Feedback', {})}
        accessibilityRole="button"
      >
        <Text style={styles.cardTitle}>{t('feedbackTitle')}</Text>
        <Text style={styles.cardSub}>{t('feedbackMoreSub')}</Text>
      </Pressable>

      {isMaster ? (
        <Pressable
          style={({ pressed }) => [styles.masterCard, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AdminDeck')}
          accessibilityRole="button"
          accessibilityLabel={t('masterDeckTitle')}
        >
          <Text style={styles.masterTitle}>{t('masterDeckTitle')}</Text>
          <Text style={styles.masterSub}>{t('masterDeckMoreSub')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.langCard}>
        <Text style={styles.cardTitle}>{t('language')}</Text>
        <Text style={styles.cardSub}>{t('languageHint')}</Text>
        <View style={styles.langRow}>
          {(['en', 'fi'] as Locale[]).map((code) => {
            const on = locale === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                style={[styles.langBtn, on && styles.langBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.langBtnText, on && styles.langBtnTextOn]}>
                  {code.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.langCard}>
        <Text style={styles.cardTitle}>{t('unitSystem')}</Text>
        <Text style={styles.cardSub}>{t('unitSystemHint')}</Text>
        <View style={styles.langRow}>
          {(
            [
              { id: 'metric' as UnitSystem, label: t('unitSystemMetric') },
              { id: 'imperial' as UnitSystem, label: t('unitSystemImperial') },
            ] as const
          ).map((opt) => {
            const on = unitSystem === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setUnitSystem(opt.id)}
                style={[styles.langBtn, on && styles.langBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.langBtnText, on && styles.langBtnTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={styles.valueCard}
        onPress={() => setValueOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('homeInventoryValue')}
      >
        <Text style={styles.cardTitle}>{t('homeInventoryValue')}</Text>
        <Text style={styles.cardSub}>{t('moreInventoryValueSub')}</Text>
      </Pressable>

      {items.map((item) => (
        <Pressable
          key={item.route}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => navigation.navigate(item.route)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSub}>{item.subtitle}</Text>
        </Pressable>
      ))}

      <Pressable
        style={({ pressed }) => [styles.dangerCard, pressed && styles.pressed]}
        onPress={() => {
          alertConfirm(
            t('startInventoryScratch'),
            t('startInventoryScratchConfirm'),
            {
              destructive: true,
              confirmLabel: t('startInventoryScratch'),
              cancelLabel: t('cancel'),
              onConfirm: () => {
                clearAllInventory();
                alertAck(
                  t('startInventoryScratch'),
                  t('startInventoryScratchDone'),
                );
              },
            },
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={t('startInventoryScratch')}
      >
        <Text style={styles.dangerTitle}>{t('startInventoryScratch')}</Text>
        <Text style={styles.dangerSub}>
          {t('startInventoryScratchConfirm')}
        </Text>
      </Pressable>

      {profile ? (
        <Pressable
          style={({ pressed }) => [styles.signOutCard, pressed && styles.pressed]}
          onPress={() => {
            alertConfirm(t('signOut'), t('signOutConfirm'), {
              confirmLabel: t('signOut'),
              cancelLabel: t('cancel'),
              onConfirm: () => {
                void signOut();
              },
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('signOut')}
        >
          <Text style={styles.cardTitle}>{t('signOut')}</Text>
          <Text style={styles.cardSub}>{t('signOutSub')}</Text>
        </Pressable>
      ) : null}

      <InventoryValueModal
        visible={valueOpen}
        onClose={() => setValueOpen(false)}
      />
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
  wordmark: {
    width: 340,
    height: 104,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  sub: { color: colors.inkMuted, marginTop: 4 },
  signedIn: {
    marginTop: 8,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  credit: {
    color: colors.inkFaint,
    fontSize: 11,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  langCard: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  langBtnOn: {
    backgroundColor: colors.primarySoft,
  },
  langBtnText: {
    fontWeight: '600',
    fontSize: 15,
    color: colors.inkMuted,
    letterSpacing: 0.4,
  },
  langBtnTextOn: { color: colors.primary, fontWeight: '700' },
  valueCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  card: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  adminCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  masterCard: {
    backgroundColor: colors.warning,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  masterTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  masterSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  pressed: { opacity: 0.9 },
  dangerCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  signOutCard: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  cardSub: { marginTop: 4, color: colors.inkMuted, lineHeight: 20 },
  dangerTitle: { fontSize: 17, fontWeight: '700', color: colors.danger },
  dangerSub: { marginTop: 4, color: colors.danger, opacity: 0.85 },
});
