import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Place } from '../data/types';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  places: Place[];
  selectedId: string | 'all';
  onSelect: (placeId: string | 'all') => void;
  /** When true, prepend an “All places” option */
  includeAll?: boolean;
  allLabel?: string;
  label?: string;
  /** Skip horizontal inset when parent already pads */
  flush?: boolean;
};

/**
 * Compact place picker — single dropdown trigger + bottom sheet.
 * Prefer this over PlaceChips for counting flows (Record / Confirm / Fridge).
 */
export function PlaceSelect({
  places,
  selectedId,
  onSelect,
  includeAll = false,
  allLabel,
  label,
  flush = false,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const resolvedAll = allLabel ?? t('placesAll');
  const resolvedLabel = label ?? t('placesFilter');

  const selectedLabel = useMemo(() => {
    if (selectedId === 'all') return resolvedAll;
    return places.find((p) => p.id === selectedId)?.name ?? resolvedAll;
  }, [places, resolvedAll, selectedId]);

  if (places.length === 0) return null;

  function pick(id: string | 'all') {
    onSelect(id);
    setOpen(false);
  }

  return (
    <View style={[styles.wrap, flush && styles.wrapFlush]}>
      <Text style={styles.label}>{resolvedLabel}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${resolvedLabel}: ${selectedLabel}`}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>{resolvedLabel}</Text>

            <ScrollView
              style={styles.optionsScroll}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {includeAll ? (
                <Pressable
                  onPress={() => pick('all')}
                  style={[
                    styles.option,
                    selectedId === 'all' && styles.optionOn,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedId === 'all' }}
                >
                  <View
                    style={[
                      styles.radio,
                      selectedId === 'all' && styles.radioOn,
                    ]}
                  >
                    {selectedId === 'all' ? (
                      <View style={styles.radioDot} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.optionTitle,
                      selectedId === 'all' && styles.optionTitleOn,
                    ]}
                  >
                    {resolvedAll}
                  </Text>
                </Pressable>
              ) : null}

              {places.map((place) => {
                const on = selectedId === place.id;
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => pick(place.id)}
                    style={[styles.option, on && styles.optionOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text
                      style={[styles.optionTitle, on && styles.optionTitleOn]}
                      numberOfLines={2}
                    >
                      {place.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  wrapFlush: {
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: spacing.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  chevron: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.line,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  optionsScroll: {
    maxHeight: 360,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  optionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTitleOn: { color: colors.primary },
});
