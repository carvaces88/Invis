import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { UNIT_GUIDE } from '../data/units';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

/**
 * Unit column header control — one menu for all YKSIKKÖ meanings.
 * Uses a Modal (not an absolute bubble) so Inventory tableHead can keep
 * overflow:'hidden' and horizontal ScrollView pans stay reliable on web.
 */
export function UnitColumnLegend() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t('unitColumnLegendA11y')}
        style={({ pressed }) => [
          styles.chip,
          (pressed || open) && styles.chipOn,
        ]}
      >
        <Text style={styles.label}>{t('unit')}</Text>
        <Text style={styles.q}>?</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('unitColumnLegendTitle')}</Text>
            <ScrollView style={styles.modalScroll}>
              {UNIT_GUIDE.map((row) => (
                <View key={row.id} style={styles.modalRow}>
                  <Text style={styles.modalCode}>{row.code}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalPrimary}>
                      {locale === 'fi' ? row.fiName : row.enName}
                    </Text>
                    <Text style={styles.modalSecondary}>
                      {locale === 'fi' ? row.enName : row.fiName}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.modalDismiss}>{t('unitHintDismiss')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 64,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.bgElevated,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  q: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  modalScroll: { maxHeight: 420 },
  modalRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  modalCode: {
    width: 40,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  modalPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  modalSecondary: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  modalDismiss: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
