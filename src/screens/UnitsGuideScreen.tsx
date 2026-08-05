import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIT_GUIDE } from '../data/units';
import { useI18n } from '../i18n';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, spacing } from '../theme/colors';

export function UnitsGuideScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { unitSystem, displayUnit } = useUnitSystem();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      <Text style={styles.title}>{t('unitsGuideTitle')}</Text>
      <Text style={styles.intro}>{t('unitsGuideIntro')}</Text>
      {unitSystem === 'imperial' ? (
        <Text style={styles.note}>{t('unitsGuideImperialNote')}</Text>
      ) : null}

      <View style={styles.head}>
        <Text style={[styles.headCell, styles.colName]}>
          {t('unitsGuideColFriendly')}
        </Text>
        <Text style={[styles.headCell, styles.colCode]}>
          {t('unitsGuideColCode')}
        </Text>
        <Text style={[styles.headCell, styles.colMeaning]}>
          {t('unitsGuideColMeaning')}
        </Text>
      </View>

      {UNIT_GUIDE.map((row) => {
        const shown = displayUnit(row.code);
        return (
          <View key={row.id} style={styles.row}>
            <View style={styles.colName}>
              <Text style={styles.nameEn}>
                {row.code === 'KG' && unitSystem === 'imperial'
                  ? t('unitChipLb')
                  : row.code === 'L' && unitSystem === 'imperial'
                    ? t('unitChipFloz')
                    : locale === 'fi'
                      ? row.fiName
                      : row.enName}
              </Text>
              <Text style={styles.nameFi}>
                {locale === 'fi' ? row.enName : `${t('unitsGuideColFi')}: ${row.fiName}`}
                {shown !== row.code ? ` · UI: ${shown}` : ''}
              </Text>
            </View>
            <Text style={styles.code}>{row.code}</Text>
            <Text style={styles.meaning}>
              {locale === 'fi' ? row.fiMeaning : row.enMeaning}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  intro: {
    marginTop: 8,
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkMuted,
  },
  note: {
    marginBottom: spacing.lg,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  head: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  headCell: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  colName: { flex: 1.1 },
  colCode: { width: 44 },
  colMeaning: { flex: 1.4 },
  nameEn: { fontSize: 15, fontWeight: '700', color: colors.ink },
  nameFi: { fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  code: {
    width: 44,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 2,
  },
  meaning: {
    flex: 1.4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
});
