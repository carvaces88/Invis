import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DocumentExtract, SheetImportInsight } from '../data/types';
import { useI18n } from '../i18n';
import {
  collectSheetImportInsights,
  formatSheetImportInsightMessage,
} from '../lib/sheetImportInsights';
import { colors, radius, spacing } from '../theme/colors';

type Props = {
  insights?: SheetImportInsight[];
  lines?: DocumentExtract['lines'];
  pageCount: number;
};

/**
 * Small INVIS companion bubbles during sheet import review — cross-page hints only.
 */
export function SheetImportInsightCards({ insights, lines, pageCount }: Props) {
  const { t } = useI18n();
  const visible = collectSheetImportInsights(
    { insights, lines: lines ?? [] },
    pageCount,
  );
  if (!visible.length) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.kicker}>{t('sheetImportInsightKicker')}</Text>
      {visible.map((insight, i) => (
        <View
          key={`${insight.kind}-${insight.itemName}-${i}`}
          style={[
            styles.card,
            insight.kind === 'crossed_off' && styles.cardMuted,
          ]}
        >
          <Text style={styles.cardText}>
            {formatSheetImportInsightMessage(t, insight)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.sm,
    gap: 6,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primaryMid,
  },
  cardMuted: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.ink,
  },
});
