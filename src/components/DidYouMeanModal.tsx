import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import type { ProductMatch } from '../data/types';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  visible: boolean;
  typedName: string;
  candidates: ProductMatch[];
  onUseExisting: (match: ProductMatch) => void;
  onCreateNew: () => void;
  onDismiss: () => void;
};

/**
 * “Did you mean…?” — merge into existing (add alias) or create a new product.
 */
export function DidYouMeanModal({
  visible,
  typedName,
  candidates,
  onUseExisting,
  onCreateNew,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const name = typedName.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{t('didYouMeanTitle')}</Text>
          <Text style={styles.body}>
            {t('didYouMeanBody').replace('{name}', name)}
          </Text>

          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {candidates.map((item) => (
              <View key={item.product.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>
                    {item.product.officialName}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.product.unit}
                    {item.product.packSize
                      ? ` · ${item.product.packSize}`
                      : ''}
                    {item.matchedOn === 'alias'
                      ? ` · “${item.matchedTerm}”`
                      : ''}
                    {` · ${Math.round(item.score * 100)}%`}
                  </Text>
                </View>
                <Pressable
                  style={styles.useBtn}
                  onPress={() => onUseExisting(item)}
                  accessibilityRole="button"
                >
                  <Text style={styles.useBtnText}>{t('didYouMeanUse')}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Pressable
            style={styles.createBtn}
            onPress={onCreateNew}
            accessibilityRole="button"
          >
            <Text style={styles.createBtnText}>
              {t('didYouMeanCreate').replace('{name}', name)}
            </Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>{t('exportCancel')}</Text>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '70%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    marginTop: 6,
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  useBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  useBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  createBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  cancelBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 15,
  },
});
