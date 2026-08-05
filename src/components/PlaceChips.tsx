import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../data/types';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  places: Place[];
  selectedId: string | 'all' | null;
  onSelect: (placeId: string | 'all') => void;
  /** When true, prepend an “All places” chip */
  includeAll?: boolean;
  allLabel?: string;
  label?: string;
  /** Skip horizontal inset when parent already pads (e.g. Record inventory) */
  flush?: boolean;
};

/** Horizontal place picker chips — Record inventory + Inventaario filter. */
export function PlaceChips({
  places,
  selectedId,
  onSelect,
  includeAll = false,
  allLabel = 'All',
  label,
  flush = false,
}: Props) {
  if (places.length === 0) return null;

  const padH = flush ? 0 : spacing.lg;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { paddingHorizontal: padH }]}>{label}</Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, { paddingHorizontal: padH }]}
        keyboardShouldPersistTaps="handled"
      >
        {includeAll ? (
          <Pressable
            onPress={() => onSelect('all')}
            style={[
              styles.chip,
              selectedId === 'all' && styles.chipOn,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === 'all' }}
          >
            <Text
              style={[
                styles.chipText,
                selectedId === 'all' && styles.chipTextOn,
              ]}
            >
              {allLabel}
            </Text>
          </Pressable>
        ) : null}
        {places.map((place) => {
          const on = selectedId === place.id;
          return (
            <Pressable
              key={place.id}
              onPress={() => onSelect(place.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {place.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  chipTextOn: { color: colors.primary },
});
