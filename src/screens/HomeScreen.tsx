import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InventoryValueModal } from '../components/InventoryValueModal';
import { useChefNudge } from '../components/ChefNudge';
import type { MainTabParamList, RootStackParamList, ScanMode } from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

const logoMark = require('../../assets/invis-logo.png');

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
  const { width } = useWindowDimensions();
  const gap = spacing.md;
  const pad = spacing.lg;
  const cardWidth = Math.floor((width - pad * 2 - gap) / 2);
  const [valueOpen, setValueOpen] = useState(false);

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
        <Image
          source={logoMark}
          style={styles.logoMark}
          accessibilityLabel={t('appBrand')}
        />
        <View style={styles.brandText}>
          <Text style={styles.greeting}>{t('homeGreeting')}</Text>
          <Text style={styles.subtitle}>
            {t('appBrand')} · {t('kitchenInventory').toLowerCase()}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() =>
          withYesChef(() => navigation.navigate('RecordInventory'))
        }
        style={({ pressed }) => [
          styles.primaryCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('homeRecordInventory')}
      >
        <Text style={styles.primaryTitle}>{t('homeRecordInventory')}</Text>
        <Text style={styles.primarySub}>{t('homeRecordInventorySub')}</Text>
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
  logoMark: {
    width: 52,
    height: 52,
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
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.inkMuted,
  },
  primaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg + 4,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  primaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primarySub: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  inventoryCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  inventoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  inventorySub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 88,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  pressed: { opacity: 0.88 },
  moreButton: {
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  moreButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
});
