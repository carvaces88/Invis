import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedFridgeLogo } from '../components/AnimatedFridgeLogo';
import { InventoryValueModal } from '../components/InventoryValueModal';
import {
  WelcomeOnboarding,
  type WelcomeStartAction,
} from '../components/WelcomeOnboarding';
import { useChefNudge } from '../components/ChefNudge';
import { useAuth } from '../auth/AuthContext';
import {
  hasRecordedInventory,
  useInventory,
} from '../data/store';
import type { MainTabParamList, RootStackParamList, ScanMode } from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

/** Dismissed for the current empty stretch; cleared once stock is recorded again. */
const WELCOME_DISMISS_KEY = 'invis.welcomeOnboarding.dismissedEmpty';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type SecondaryAction = {
  key: string;
  title: string;
  onPress: () => void;
};

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { yesChef } = useChefNudge();
  const { profile } = useAuth();
  const { session } = useInventory();
  const { width } = useWindowDimensions();
  const gap = spacing.md;
  const pad = spacing.lg;
  const cardWidth = Math.floor((width - pad * 2 - gap) / 2);
  const [valueOpen, setValueOpen] = useState(false);
  /** null = AsyncStorage not loaded yet */
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(
    null,
  );

  const inventoryEmpty = !hasRecordedInventory(session);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WELCOME_DISMISS_KEY);
        if (!cancelled) setWelcomeDismissed(raw === '1');
      } catch {
        if (!cancelled) setWelcomeDismissed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Once the user has counted stock, clear dismiss so the next empty stretch can welcome again.
  useEffect(() => {
    if (inventoryEmpty) return;
    setWelcomeDismissed(false);
    void AsyncStorage.removeItem(WELCOME_DISMISS_KEY).catch(() => {});
  }, [inventoryEmpty]);

  function dismissWelcome() {
    setWelcomeDismissed(true);
    void AsyncStorage.setItem(WELCOME_DISMISS_KEY, '1').catch(() => {});
  }

  function withYesChef(action: () => void) {
    yesChef();
    // Let the bubble read before navigation feels abrupt
    setTimeout(action, 280);
  }

  function goScan(mode: ScanMode) {
    withYesChef(() => navigation.navigate('Scan', { mode }));
  }

  function openInventoryValue() {
    yesChef();
    setTimeout(() => setValueOpen(true), 280);
  }

  function handleWelcomeStart(action: WelcomeStartAction) {
    dismissWelcome();
    withYesChef(() => {
      if (action === 'scanFridge') {
        navigation.navigate('RecordInventory', { heroFridge: true });
      } else if (action === 'importSheet') {
        navigation.navigate('SheetImport');
      } else {
        navigation.navigate('Catalog');
      }
    });
  }

  function handleWelcomeSkip() {
    dismissWelcome();
  }

  const showWelcome =
    inventoryEmpty && welcomeDismissed === false;

  // Hold a blank frame while dismiss flag loads — avoids flashing full Home then welcome.
  if (inventoryEmpty && welcomeDismissed === null) {
    return <View style={styles.root} />;
  }

  const secondary: SecondaryAction[] = [
    {
      key: 'scan',
      title: t('homeScanProduct'),
      onPress: () => goScan('product'),
    },
    {
      key: 'delivery',
      title: t('homeLogDelivery'),
      onPress: () => goScan('delivery'),
    },
    {
      key: 'waste',
      title: t('homeLogWaste'),
      onPress: () => goScan('waste'),
    },
    {
      key: 'find',
      title: t('homeFindProduct'),
      onPress: () => withYesChef(() => navigation.navigate('Catalog')),
    },
    {
      key: 'report',
      title: t('homeAskReport'),
      onPress: () => withYesChef(() => navigation.navigate('ReportsChat')),
    },
    {
      key: 'value',
      title: `${t('homeInventoryValue')} · €`,
      onPress: openInventoryValue,
    },
  ];

  if (showWelcome) {
    return (
      <WelcomeOnboarding
        onStart={handleWelcomeStart}
        onSkip={handleWelcomeSkip}
      />
    );
  }

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
          <Text style={styles.greeting}>
            {t('homeGreeting').replace(
              '{name}',
              profile?.displayName?.trim() || t('homeGreetingNameFallback'),
            )}
          </Text>
          <Text style={styles.subtitle}>
            {t('appBrand')} · {t('kitchenInventory').toLowerCase()}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() =>
          withYesChef(() =>
            navigation.navigate('RecordInventory', { heroFridge: true }),
          )
        }
        style={({ pressed }) => [
          styles.primaryCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('homeScanFridge')}
      >
        <Text style={styles.primaryTitle}>{t('homeScanFridge')}</Text>
        <Text style={styles.primarySub}>{t('homeScanFridgeSub')}</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          withYesChef(() => navigation.navigate('RecordInventory'))
        }
        style={({ pressed }) => [
          styles.secondaryHeroCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('homeRecordInventory')}
      >
        <Text style={styles.secondaryHeroTitle}>{t('homeRecordInventory')}</Text>
        <Text style={styles.secondaryHeroSub}>{t('homeRecordInventorySub')}</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          withYesChef(() => navigation.navigate('Inventaario'))
        }
        style={({ pressed }) => [
          styles.inventoryCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('homeCurrentInventory')}
      >
        <Text style={styles.inventoryTitle}>{t('homeCurrentInventory')}</Text>
        <Text style={styles.inventorySub}>{t('homeCurrentInventorySub')}</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          withYesChef(() =>
            navigation.navigate('VerifyAmounts', { mode: 'pending' }),
          )
        }
        style={({ pressed }) => [
          styles.verifyCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('verifyAmountsOpen')}
      >
        <Text style={styles.verifyTitle}>{t('verifyAmountsOpen')}</Text>
        <Text style={styles.verifySub}>{t('verifyAmountsOpenSub')}</Text>
      </Pressable>

      <View style={[styles.grid, { gap }]}>
        {secondary.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.title}
          >
            <Text style={styles.cardTitle}>{action.title}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => withYesChef(() => navigation.navigate('More'))}
        style={({ pressed }) => [
          styles.moreButton,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('homeMoreSettings')}
      >
        <Text style={styles.moreButtonText}>{t('homeMoreSettings')}</Text>
      </Pressable>

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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandMark: {
    marginTop: 2,
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.inkMuted,
  },
  primaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg + 6,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  primaryTitle: {
    fontSize: 20,
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
  secondaryHeroCard: {
    ...surfaces.float,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  secondaryHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  secondaryHeroSub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  inventoryCard: {
    ...surfaces.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  inventoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  inventorySub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  verifyCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  verifyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: -0.2,
  },
  verifySub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    ...surfaces.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 88,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  moreButton: {
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
  moreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
