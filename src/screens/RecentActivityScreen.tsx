import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import { useI18n } from '../i18n';
import { formatClockTime, formatUpdatedLabel } from '../lib/relativeTime';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, spacing } from '../theme/colors';

export function RecentActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { recentActivity, places } = useInventory();
  const { formatQty, displayUnit, toDisplayQty } = useUnitSystem();
  const placeById = new Map(places.map((p) => [p.id, p]));

  return (
    <View style={[styles.root, { paddingTop: spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('recentActivityTitle')}</Text>
        <Text style={styles.sub}>{t('recentActivitySub')}</Text>
      </View>
      <FlatList
        data={recentActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 40,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('recentActivityEmpty')}</Text>
        }
        renderItem={({ item }) => {
          const placeName = placeById.get(item.placeId)?.name;
          const updated =
            formatUpdatedLabel(item.createdAt, locale) ??
            formatClockTime(item.createdAt);
          const qty = formatQty(toDisplayQty(item.unit, item.delta));
          const total = formatQty(
            toDisplayQty(item.unit, item.quantityAfter),
          );
          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.officialName}</Text>
              <Text style={styles.meta}>
                +{qty} {displayUnit(item.unit)} → {total}
                {placeName ? ` · ${placeName}` : ''}
              </Text>
              <Text style={styles.time}>{updated}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { marginTop: 4, color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.inkFaint, fontSize: 14 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  meta: { marginTop: 4, color: colors.inkMuted, fontSize: 13 },
  time: { marginTop: 4, color: colors.inkFaint, fontSize: 12 },
});
