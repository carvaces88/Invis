import React, { useEffect, useState } from 'react';
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
  DEFAULT_EXPORT_PROFILE,
  EXPORT_PROFILES,
  profileHintKey,
  profileTitleKey,
  type ExportProfileId,
} from '../lib/export/profiles';
import { colors, radius, spacing } from '../theme/colors';

type ExportKind = 'xlsx' | 'pdf' | 'docx';

type Props = {
  visible: boolean;
  /** export = Excel/PDF/Word; view = on-screen spreadsheet columns */
  purpose?: 'export' | 'view';
  format?: ExportKind | null;
  /** Profile shown as selected when the sheet opens */
  initialProfile?: ExportProfileId;
  onClose: () => void;
  onConfirm: (profileId: ExportProfileId) => void;
  busy?: boolean;
};

function formatLabel(format: ExportKind | null | undefined): string {
  if (format === 'xlsx') return 'Excel';
  if (format === 'pdf') return 'PDF';
  if (format === 'docx') return 'Word';
  return '';
}

/**
 * Column/profile picker for export or on-screen spreadsheet view.
 */
export function ExportColumnsSheet({
  visible,
  purpose = 'export',
  format = null,
  initialProfile = DEFAULT_EXPORT_PROFILE,
  onClose,
  onConfirm,
  busy,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ExportProfileId>(initialProfile);

  useEffect(() => {
    if (visible) setSelected(initialProfile);
  }, [visible, initialProfile]);

  const isView = purpose === 'view';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>
            {isView ? t('spreadsheetChooseColumns') : t('exportChooseData')}
          </Text>
          <Text style={styles.sub}>
            {isView
              ? t('spreadsheetChooseColumnsSub')
              : t('exportChooseDataSub').replace(
                  '{format}',
                  formatLabel(format),
                )}
          </Text>

          <ScrollView
            style={styles.optionsScroll}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {EXPORT_PROFILES.map((profile) => {
              const on = selected === profile.id;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => setSelected(profile.id)}
                  style={[styles.option, on && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.optionText}>
                    <Text
                      style={[styles.optionTitle, on && styles.optionTitleOn]}
                    >
                      {t(profileTitleKey(profile.id))}
                    </Text>
                    <Text style={styles.optionHint}>
                      {t(profileHintKey(profile.id))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.btnGhostText}>{t('exportCancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(selected)}
              disabled={busy}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && { opacity: 0.9 },
                busy && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>
                {busy
                  ? t('exporting')
                  : isView
                    ? t('spreadsheetApplyColumns')
                    : t('exportContinue')}
              </Text>
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
  optionsScroll: {
    maxHeight: 360,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
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
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  optionTitleOn: { color: colors.primary },
  optionHint: {
    marginTop: 3,
    fontSize: 12,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btnGhost: {
    paddingHorizontal: 16,
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
