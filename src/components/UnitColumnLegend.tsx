import React, { useState } from 'react';
import {
  Modal,
  Platform,
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
 * Unit column header control — one hover/tap menu for all YKSIKKÖ meanings.
 */
export function UnitColumnLegend() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const tipVisible = open || (Platform.OS === 'web' && hovered);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={t('unitColumnLegendA11y')}
        style={({ pressed }) => [
          styles.chip,
          (pressed || tipVisible) && styles.chipOn,
        ]}
      >
        <Text style={styles.label}>{t('unit')}</Text>
        <Text style={styles.q}>?</Text>
      </Pressable>

      {tipVisible && Platform.OS === 'web' ? (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.bubbleTitle}>{t('unitColumnLegendTitle')}</Text>
          {UNIT_GUIDE.map((row) => (
            <View key={row.id} style={styles.bubbleRow}>
              <Text style={styles.bubbleCode}>{row.code}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bubbleFi}>{row.fiName}</Text>
                <Text style={styles.bubbleEn}>{row.enName}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        visible={open && Platform.OS !== 'web'}
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
    zIndex: 30,
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
  bubble: {
    position: 'absolute',
    top: 28,
    left: 0,
    width: 260,
    maxHeight: 420,
    zIndex: 40,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bubbleTitle: {
    color: colors.primarySoft,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 8,
  },
  bubbleCode: {
    width: 36,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  bubbleFi: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bubbleEn: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 1,
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
