import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  MainTabParamList,
  RootStackParamList,
  ScanMode,
} from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius, spacing, surfaces } from '../theme/colors';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Scan'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function navigateScanMode(navigation: Nav, mode: ScanMode) {
  if (mode === 'product') navigation.navigate('ProductScan');
  else if (mode === 'delivery') navigation.navigate('KuormaScan');
  else navigation.navigate('HavikkiScan');
}

/** Scan hub — product / kuorma / hävikki without cluttering the inventaario grid */
export function ScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, 'Scan'>>();
  const { t } = useI18n();

  useFocusEffect(
    useCallback(() => {
      const mode = route.params?.mode;
      if (!mode) return;
      navigation.setParams({ mode: undefined });
      navigateScanMode(navigation, mode);
    }, [navigation, route.params?.mode]),
  );

  const cards = [
    {
      title: t('productPhoto'),
      subtitle: t('productPhotoSub'),
      onPress: () => navigation.navigate('ProductScan'),
      tone: 'primary' as const,
    },
    {
      title: t('delivery'),
      subtitle: t('deliverySub'),
      onPress: () => navigation.navigate('KuormaScan'),
      tone: 'primary' as const,
    },
    {
      title: t('foodWaste'),
      subtitle: t('foodWasteSub'),
      onPress: () => navigation.navigate('HavikkiScan'),
      tone: 'warning' as const,
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.kicker}>{t('capture')}</Text>
      <Text style={styles.title}>{t('scanHub')}</Text>
      <Text style={styles.sub}>{t('scanHubSub')}</Text>
      {cards.map((c) => (
        <Pressable
          key={c.title}
          onPress={c.onPress}
          style={({ pressed }) => [
            styles.card,
            c.tone === 'warning' && styles.cardWarn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.cardTitle}>{c.title}</Text>
          <Text style={styles.cardSub}>{c.subtitle}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => navigation.navigate('VideoDemo')}
        style={styles.link}
      >
        <Text style={styles.linkText}>{t('videoWalkthrough')}</Text>
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
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  sub: { color: colors.inkMuted, marginTop: 6, marginBottom: spacing.lg },
  card: {
    ...surfaces.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardWarn: {
    backgroundColor: colors.warningSoft,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  cardSub: { marginTop: 4, color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.primary, fontWeight: '600' },
});
