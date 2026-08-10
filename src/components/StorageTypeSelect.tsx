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
import { STORAGE_TYPES } from '../data/storageTypes';
import type { StorageType } from '../data/types';
import { useI18n, type MessageKey } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

const STORAGE_LABEL_KEYS: Record<StorageType, MessageKey> = {
  dry_storage: 'storageDry',
  freezer: 'storageFreezer',
  prep_fridge: 'storagePrepFridge',
  drawers: 'storageDrawers',
};

type Props = {
  selected: StorageType | 'all';
  onSelect: (value: StorageType | 'all') => void;
  /** Skip horizontal inset when parent already pads */
  flush?: boolean;
  compact?: boolean;
};

/**
 * Compact storage-type filter — same dropdown pattern as PlaceSelect.
 */
export function StorageTypeSelect({
  selected,
  onSelect,
  flush = false,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (selected === 'all') return t('storageAll');
    return t(STORAGE_LABEL_KEYS[selected]);
  }, [selected, t]);

  function pick(value: StorageType | 'all') {
    onSelect(value);
    setOpen(false);
  }

  return (
    <View
      style={[
        styles.wrap,
        flush && styles.wrapFlush,
        compact && styles.wrapCompact,
      ]}
    >
      <Text style={[styles.label, compact && styles.labelCompact]}>
        {t('storageFilter')}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${t('storageFilter')}: ${selectedLabel}`}
      >
        <Text
          style={[styles.triggerText, compact && styles.triggerTextCompact]}
          numberOfLines={1}
        >
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
            <Text style={styles.title}>{t('storageFilter')}</Text>

            <ScrollView
              style={styles.optionsScroll}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                onPress={() => pick('all')}
                style={[styles.option, selected === 'all' && styles.optionOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === 'all' }}
              >
                <View
                  style={[styles.radio, selected === 'all' && styles.radioOn]}
                >
                  {selected === 'all' ? <View style={styles.radioDot} /> : null}
                </View>
                <Text
                  style={[
                    styles.optionTitle,
                    selected === 'all' && styles.optionTitleOn,
                  ]}
                >
                  {t('storageAll')}
                </Text>
              </Pressable>

              {STORAGE_TYPES.map((type) => {
                const on = selected === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => pick(type)}
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
                      {t(STORAGE_LABEL_KEYS[type])}
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

export function storageTypeLabelKey(type: StorageType): MessageKey {
  return STORAGE_LABEL_KEYS[type];
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  wrapFlush: {
    paddingHorizontal: 0,
  },
  wrapCompact: {
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: spacing.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelCompact: {
    fontSize: 10,
    marginBottom: 2,
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
  triggerCompact: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  triggerTextCompact: {
    fontSize: 14,
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
