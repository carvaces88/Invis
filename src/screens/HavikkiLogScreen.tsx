import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import { colors, radius, spacing } from '../theme/colors';

export function HavikkiLogScreen() {
  const insets = useSafeAreaInsets();
  const { havikkiLog } = useInventory();

  return (
    <View style={[styles.root, { paddingTop: spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Food waste log</Text>
        <Text style={styles.sub}>
          Explicit recorded food waste (separate from portioning margin on
          recipes).
        </Text>
      </View>
      <FlatList
        data={havikkiLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 40,
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No food waste yet. Scan a waste list from the Scan hub.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.officialName}</Text>
            <Text style={styles.meta}>
              −{String(item.quantity).replace('.', ',')} {item.unit}
              {item.station ? ` · ${item.station}` : ''} · {item.date}
            </Text>
            {item.notes ? (
              <Text style={styles.notes}>{item.notes}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  empty: { color: colors.inkMuted, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  name: { fontWeight: '700', color: colors.ink },
  meta: { marginTop: 4, color: colors.warning, fontSize: 13 },
  notes: { marginTop: 6, color: colors.inkMuted, fontSize: 12 },
});
