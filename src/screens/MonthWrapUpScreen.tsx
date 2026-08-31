import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import type { RootStackParamList } from '../data/types';
import { useI18n } from '../i18n';
import { formatMoney } from '../lib/alv';
import { alertAck, alertConfirm } from '../lib/alertAck';
import { dismissMonthEndReminder } from '../lib/monthEndReminder';
import {
  buildMonthWrapUpSummary,
  formatMonthLabel,
} from '../lib/monthWrapUpSummary';
import { colors, radius, shadows, spacing, surfaces } from '../theme/colors';

export function MonthWrapUpScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t, locale } = useI18n();
  const {
    session,
    movements,
    recipes,
    periodSnapshot,
    siteName,
    finalizeInventoryMonth,
  } = useInventory();

  const [done, setDone] = useState<{
    closedMonth: string;
    nextMonth: string;
  } | null>(
    periodSnapshot?.lastFinalizedMonth &&
      periodSnapshot.lastFinalizedAt &&
      Date.now() - Date.parse(periodSnapshot.lastFinalizedAt) < 5 * 60 * 1000
      ? {
          closedMonth: periodSnapshot.lastFinalizedMonth,
          nextMonth: periodSnapshot.currentMonth,
        }
      : null,
  );
  const [lockedSummary, setLockedSummary] = useState<ReturnType<
    typeof buildMonthWrapUpSummary
  > | null>(null);

  const openMonthKey =
    done?.closedMonth ??
    periodSnapshot?.currentMonth ??
    session.date.slice(0, 7);

  const liveSummary = useMemo(
    () =>
      buildMonthWrapUpSummary({
        session,
        movements,
        recipes,
        periodSnapshot,
        monthKey: openMonthKey,
      }),
    [session, movements, recipes, periodSnapshot, openMonthKey],
  );
  const summary = lockedSummary ?? liveSummary;

  const monthLabel = formatMonthLabel(openMonthKey, locale);
  const nextLabel = formatMonthLabel(
    done?.nextMonth ?? periodSnapshot?.currentMonth ?? openMonthKey,
    locale,
  );

  function runFinalize() {
    alertConfirm(t('monthWrapUpConfirmTitle'), t('monthWrapUpConfirmBody'), {
      confirmLabel: t('monthWrapUpConfirmAction'),
      cancelLabel: t('cancel'),
      onConfirm: () => {
        setLockedSummary(
          buildMonthWrapUpSummary({
            session,
            movements,
            recipes,
            periodSnapshot,
            monthKey: openMonthKey,
          }),
        );
        const result = finalizeInventoryMonth();
        void dismissMonthEndReminder();
        if (result.ok) {
          setDone({
            closedMonth: result.closedMonth,
            nextMonth: result.nextMonth,
          });
          alertAck(
            t('monthWrapUpDoneTitle'),
            t('monthWrapUpDoneBody')
              .replace('{month}', formatMonthLabel(result.closedMonth, locale))
              .replace('{next}', formatMonthLabel(result.nextMonth, locale)),
          );
        } else {
          setDone({
            closedMonth: result.closedMonth,
            nextMonth: result.nextMonth,
          });
          alertAck(
            t('monthWrapUpAlreadyTitle'),
            t('monthWrapUpAlreadyBody').replace(
              '{month}',
              formatMonthLabel(result.closedMonth, locale),
            ),
          );
        }
      },
    });
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text style={styles.kicker}>{t('monthWrapUpKicker')}</Text>
      <Text style={styles.title}>{t('monthWrapUpTitle')}</Text>
      <Text style={styles.sub}>
        {t('monthWrapUpSub')
          .replace('{month}', monthLabel)
          .replace('{site}', siteName || t('appBrand'))}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('monthWrapUpSummaryTitle')}</Text>
        <Row
          label={t('monthWrapUpRecorded')}
          value={String(summary.recordedLines)}
        />
        {summary.unsetLines > 0 ? (
          <Row
            label={t('monthWrapUpUnset')}
            value={String(summary.unsetLines)}
            muted
          />
        ) : null}
        <Row
          label={t('monthWrapUpClosingValue')}
          value={`${formatMoney(summary.closingValueAlv0)} €`}
        />
        <Row
          label={t('monthWrapUpPurchases')}
          value={String(summary.purchasesQty).replace('.', ',')}
        />
        <Row
          label={t('monthWrapUpUsage')}
          value={
            summary.usageQty == null
              ? '—'
              : String(summary.usageQty).replace('.', ',')
          }
        />
        <Text style={styles.hint}>{t('monthWrapUpValueHint')}</Text>
      </View>

      {done ? (
        <View style={[styles.card, styles.doneCard]}>
          <Text style={styles.doneTitle}>{t('monthWrapUpDoneTitle')}</Text>
          <Text style={styles.doneBody}>
            {t('monthWrapUpDoneBody')
              .replace('{month}', formatMonthLabel(done.closedMonth, locale))
              .replace('{next}', formatMonthLabel(done.nextMonth, locale))}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={runFinalize}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('monthWrapUpFinalize')}
        >
          <Text style={styles.primaryBtnText}>{t('monthWrapUpFinalize')}</Text>
          <Text style={styles.primaryBtnSub}>
            {t('monthWrapUpFinalizeSub').replace('{month}', monthLabel)}
          </Text>
        </Pressable>
      )}

      <Text style={styles.sectionLabel}>{t('monthWrapUpReportSection')}</Text>

      <Pressable
        onPress={() => navigation.navigate('ExportPreview')}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryBtnText}>{t('monthWrapUpExport')}</Text>
        <Text style={styles.secondaryBtnSub}>{t('monthWrapUpExportSub')}</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('ReportsChat')}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryBtnText}>{t('monthWrapUpAskReport')}</Text>
        <Text style={styles.secondaryBtnSub}>
          {t('monthWrapUpAskReportSub')}
        </Text>
      </Pressable>

      {done ? (
        <Text style={styles.footerNote}>
          {t('monthWrapUpNextNote').replace('{next}', nextLabel)}
        </Text>
      ) : (
        <Text style={styles.footerNote}>{t('monthWrapUpBeforeNote')}</Text>
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && styles.rowMuted]}>{label}</Text>
      <Text style={[styles.rowValue, muted && styles.rowMuted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  title: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  card: {
    ...surfaces.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontSize: 14, color: colors.inkMuted, flex: 1, paddingRight: 8 },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowMuted: { color: colors.warning },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkFaint,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.float,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryBtnSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
  },
  doneCard: {
    backgroundColor: colors.successSoft,
  },
  doneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.success,
  },
  doneBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  secondaryBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  secondaryBtnSub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.inkMuted,
  },
  footerNote: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkFaint,
  },
});
