import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useI18n } from '../i18n';
import {
  columnHeader,
  type ExportColumnId,
} from '../lib/export/profiles';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  visible: boolean;
  columns: ExportColumnId[];
  onClose: () => void;
  onMoveBy: (col: ExportColumnId, delta: -1 | 1) => void;
  onReset?: () => void;
  canReset?: boolean;
};

/**
 * Touch-friendly column reorder sheet — ▲/▼ per row (no HTML5 drag required).
 */
export function ColumnReorderSheet({
  visible,
  columns,
  onClose,
  onMoveBy,
  onReset,
  canReset,
}: Props) {
  const { t, strings } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('columnReorderTitle')}</Text>
          <Text style={styles.sub}>{t('columnReorderSub')}</Text>

          <ScrollView
            style={styles.list}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {columns.map((col, idx) => {
              const label = columnHeader(col, strings);
              const canUp = idx > 0;
              const canDown = idx < columns.length - 1;
              return (
                <View key={col} style={styles.row}>
                  <Text style={styles.rowLabel} numberOfLines={2}>
                    {label}
                  </Text>
                  <View style={styles.nudgePair}>
                    <Pressable
                      onPress={() => onMoveBy(col, -1)}
                      disabled={!canUp}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('columnMoveLeft')}
                      style={({ pressed }) => [
                        styles.nudgeBtn,
                        (!canUp || pressed) && styles.nudgeDim,
                      ]}
                    >
                      <Text style={styles.nudgeGlyph}>▲</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onMoveBy(col, 1)}
                      disabled={!canDown}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('columnMoveRight')}
                      style={({ pressed }) => [
                        styles.nudgeBtn,
                        (!canDown || pressed) && styles.nudgeDim,
                      ]}
                    >
                      <Text style={styles.nudgeGlyph}>▼</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            {canReset && onReset ? (
              <Pressable
                onPress={onReset}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('columnResetOrder')}
              >
                <Text style={styles.btnGhostText}>{t('columnResetOrder')}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>{t('columnReorderDone')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.line,
    maxHeight: '88%',
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
  },
  sub: {
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  nudgePair: {
    flexDirection: 'row',
    gap: 6,
  },
  nudgeBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  nudgeDim: { opacity: 0.35 },
  nudgeGlyph: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
