import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lineTotal, sessionTotals, useInventory } from '../data/store';
import { useI18n } from '../i18n';
import {
  FOOD_ALV_RATE,
  foodAlvPercentLabel,
  formatMoney,
  withFoodAlv,
} from '../lib/alv';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function InventoryValueModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { session, places } = useInventory();
  const [showWithAlv, setShowWithAlv] = useState(false);

  const { value, quantity } = sessionTotals(session);
  const counted = session.lines.filter((l) => l.quantity != null).length;
  const displayValue = withFoodAlv(value, showWithAlv);
  const valueWithAlv = withFoodAlv(value, true);
  const alvPct = foodAlvPercentLabel();

  const byPlace = useMemo(() => {
    if (places.length <= 1) return [];
    return places
      .map((p) => {
        const lines = session.lines.filter((l) => l.placeId === p.id);
        const v = lines.reduce((s, l) => s + lineTotal(l), 0);
        const c = lines.filter((l) => l.quantity != null).length;
        return { id: p.id, name: p.name, value: v, counted: c };
      })
      .filter((row) => row.counted > 0 || row.value > 0);
  }, [places, session.lines]);

  const dateLabel = (() => {
    try {
      return new Date(session.date + 'T12:00:00').toLocaleDateString(
        locale === 'fi' ? 'fi-FI' : 'en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' },
      );
    } catch {
      return session.date;
    }
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { marginBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.kicker}>{t('appBrand')}</Text>
          <Text style={styles.title}>{t('inventoryValueTitle')}</Text>
          <Text style={styles.date}>{dateLabel}</Text>

          <Text style={styles.bigMoney} accessibilityRole="text">
            {formatMoney(displayValue)} €
          </Text>
          <Text style={styles.modeLabel}>
            {showWithAlv
              ? t('inventoryValueWithAlv').replace('{rate}', alvPct)
              : t('inventoryValueExclVat')}
          </Text>

          {!showWithAlv ? (
            <Text style={styles.secondaryMoney}>
              {t('inventoryValueAlsoWithAlv')
                .replace('{amount}', formatMoney(valueWithAlv))
                .replace('{rate}', alvPct)}
            </Text>
          ) : (
            <Text style={styles.secondaryMoney}>
              {t('inventoryValueAlsoExcl')
                .replace('{amount}', formatMoney(value))}
            </Text>
          )}

          <Text style={styles.sub}>
            {t('inventoryValueSub')
              .replace('{count}', String(counted))
              .replace('{qty}', String(quantity).replace('.', ','))}
          </Text>

          {byPlace.length > 0 ? (
            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>{t('placesBreakdown')}</Text>
              {byPlace.map((row) => (
                <View key={row.id} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.breakdownValue}>
                    {formatMoney(withFoodAlv(row.value, showWithAlv))} €
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setShowWithAlv(false)}
              style={[styles.toggle, !showWithAlv && styles.toggleOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: !showWithAlv }}
            >
              <Text
                style={[styles.toggleText, !showWithAlv && styles.toggleTextOn]}
              >
                {t('alvZero')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowWithAlv(true)}
              style={[styles.toggle, showWithAlv && styles.toggleOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: showWithAlv }}
            >
              <Text
                style={[styles.toggleText, showWithAlv && styles.toggleTextOn]}
              >
                {t('alvWith')}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {t('alvToggleHint').replace(
              '{rate}',
              String(Math.round(FOOD_ALV_RATE * 100)),
            )}
          </Text>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>{t('inventoryValueClose')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  date: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
  },
  bigMoney: {
    marginTop: spacing.lg,
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.8,
  },
  modeLabel: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  secondaryMoney: {
    marginTop: 6,
    fontSize: 13,
    color: colors.inkFaint,
  },
  sub: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
  breakdown: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: spacing.sm,
  },
  breakdownName: { flex: 1, fontSize: 13, color: colors.ink },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  toggleOn: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  toggleTextOn: { color: colors.primary },
  hint: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.inkFaint,
    lineHeight: 15,
  },
  closeBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
