import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import type { UnitCode } from '../data/types';
import type { PackCheckInfo, PackCheckResolve } from '../lib/packUnits';
import {
  baseUnitLabelEn,
  baseUnitLabelFi,
  packUnitLabelEn,
  packUnitLabelFi,
  packUnitSingularEn,
  packUnitSingularFi,
} from '../lib/packUnits';
import { colors, radius, spacing } from '../theme/colors';

type BaseChip = {
  id: string;
  code: UnitCode;
  preferBunch?: boolean;
  labelEn: string;
  labelFi: string;
};

const BASE_CHIPS: BaseChip[] = [
  { id: 'bunch', code: 'KPL', preferBunch: true, labelEn: 'bunch', labelFi: 'nippu' },
  { id: 'piece', code: 'KPL', preferBunch: false, labelEn: 'piece', labelFi: 'kpl' },
  { id: 'kg', code: 'KG', labelEn: 'kg', labelFi: 'kg' },
  { id: 'bottle', code: 'PL', labelEn: 'bottle', labelFi: 'pullo' },
];

type Props = {
  visible: boolean;
  info: PackCheckInfo | null;
  onYesPacks: (resolved?: PackCheckResolve) => void;
  onChangeToPieces: (resolved?: PackCheckResolve) => void;
  /** Dismiss without saving — return to qty/unit form */
  onEdit: () => void;
  /**
   * Count the entered number as loose units (KPL/pieces), not as packs.
   * Does not multiply by unitsPerPack.
   */
  onCountAsUnits?: (resolved?: PackCheckResolve) => void;
};

function formatQty(n: number): string {
  return String(n).replace('.', ',');
}

function chipForInfo(info: PackCheckInfo): BaseChip {
  if (info.preferBunchLabel && info.baseUnit === 'KPL') {
    return BASE_CHIPS[0];
  }
  const match = BASE_CHIPS.find((c) => c.code === info.baseUnit);
  return match ?? BASE_CHIPS[1];
}

export function PackCheckModal({
  visible,
  info,
  onYesPacks,
  onChangeToPieces,
  onEdit,
  onCountAsUnits,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const [perPackText, setPerPackText] = useState('');
  const [baseChip, setBaseChip] = useState<BaseChip>(BASE_CHIPS[1]);
  const [needPerPackHint, setNeedPerPackHint] = useState(false);
  /** Keep last info so Modal can close via `visible` instead of unmounting mid-tap. */
  const [cached, setCached] = useState<PackCheckInfo | null>(info);

  useEffect(() => {
    if (info) setCached(info);
  }, [info]);

  useEffect(() => {
    if (!info) return;
    setPerPackText(info.unitsPerPack != null ? String(info.unitsPerPack) : '');
    setBaseChip(chipForInfo(info));
    setNeedPerPackHint(false);
  }, [info]);

  const check = info ?? cached;
  if (!check) return null;

  const packInfo = check;
  const preferBunch = baseChip.preferBunch === true;
  const packWord =
    locale === 'fi'
      ? packUnitLabelFi(packInfo.packUnit)
      : packUnitLabelEn(packInfo.packUnit);
  const packOne =
    locale === 'fi'
      ? packUnitSingularFi(packInfo.packUnit)
      : packUnitSingularEn(packInfo.packUnit);
  const baseWord =
    locale === 'fi'
      ? baseUnitLabelFi(baseChip.code, preferBunch)
      : baseUnitLabelEn(baseChip.code, preferBunch);
  const pieceWord =
    locale === 'fi'
      ? baseUnitLabelFi('KPL', false)
      : baseUnitLabelEn('KPL', false);

  const known = !packInfo.needsUnitsPerPack && packInfo.unitsPerPack != null;
  const pieceQty =
    known && packInfo.pieceQty != null
      ? packInfo.pieceQty
      : (() => {
          const per = Number(perPackText.replace(',', '.'));
          if (!Number.isFinite(per) || per <= 1) return null;
          return Math.round(packInfo.packQty * per * 1000) / 1000;
        })();

  function parsePerPack(): number | null {
    const per = Number(perPackText.replace(',', '.'));
    if (!Number.isFinite(per) || per <= 1 || per > 999) return null;
    return per;
  }

  function resolveOrHint(): PackCheckResolve | null {
    if (known && packInfo.unitsPerPack != null) {
      return {
        unitsPerPack: packInfo.unitsPerPack,
        packBaseUnit: packInfo.baseUnit,
      };
    }
    const per = parsePerPack();
    if (per == null) {
      setNeedPerPackHint(true);
      return null;
    }
    return { unitsPerPack: per, packBaseUnit: baseChip.code };
  }

  const body = known
    ? t('packCheckBody')
        .replace('{base}', baseWord)
        .replace('{per}', String(packInfo.unitsPerPack))
        .replace('{packQty}', formatQty(packInfo.packQty))
        .replace('{pack}', packWord)
        .replace('{pieceQty}', formatQty(packInfo.pieceQty ?? 0))
        .replace('{base2}', baseWord)
    : t('packCheckBodyUnknown')
        .replace(/\{packQty\}/g, formatQty(packInfo.packQty))
        .replace(/\{pack\}/g, packWord)
        .replace(/\{base\}/g, baseWord);

  const askPer = t('packCheckAskPerPack')
    .replace('{base}', baseWord)
    .replace('{packOne}', packOne);

  const changeQty = pieceQty ?? packInfo.packQty;
  const changeLabel = known
    ? t('packCheckChange')
        .replace('{n}', formatQty(changeQty))
        .replace('{base}', baseWord)
    : t('packCheckChangeUnknown')
        .replace('{n}', formatQty(packInfo.packQty))
        .replace('{base}', baseWord);

  const countAsLabel = t('packCheckCountAsUnit')
    .replace('{n}', formatQty(packInfo.packQty))
    .replace('{base}', pieceWord);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onEdit}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('packCheckEdit')}
        />
        <View
          style={[styles.card, { marginBottom: insets.bottom + spacing.md }]}
        >
          <Text style={styles.title}>{t('packCheckTitle')}</Text>
          <Text style={styles.body}>{body}</Text>

          {packInfo.needsUnitsPerPack ? (
            <View style={styles.clarify}>
              <Text style={styles.ask}>{askPer}</Text>
              <TextInput
                value={perPackText}
                onChangeText={(v) => {
                  setPerPackText(v);
                  setNeedPerPackHint(false);
                }}
                keyboardType="decimal-pad"
                placeholder={t('packCheckPerPackPlaceholder')}
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {BASE_CHIPS.map((chip) => {
                  const on = baseChip.id === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setBaseChip(chip)}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {locale === 'fi' ? chip.labelFi : chip.labelEn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {needPerPackHint ? (
                <Text style={styles.hint}>{t('packCheckNeedPerPack')}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              if (packInfo.needsUnitsPerPack) {
                const resolved = resolveOrHint();
                if (!resolved) return;
                onYesPacks(resolved);
                return;
              }
              onYesPacks();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {t('packCheckYes')
                .replace('{n}', formatQty(packInfo.packQty))
                .replace('{pack}', packWord)}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              // Known → save converted piece qty. Unknown → reinterpret number as base units.
              // If chef filled per-pack while clarifying, persist it for next time.
              if (packInfo.needsUnitsPerPack) {
                const per = parsePerPack();
                onChangeToPieces({
                  ...(per != null ? { unitsPerPack: per } : {}),
                  packBaseUnit: baseChip.code,
                });
                return;
              }
              onChangeToPieces();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>{changeLabel}</Text>
          </Pressable>

          {onCountAsUnits ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                onCountAsUnits({
                  packBaseUnit: 'KPL',
                })
              }
              accessibilityRole="button"
              accessibilityLabel={countAsLabel}
            >
              <Text style={styles.secondaryBtnText}>{countAsLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.editBtn}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={t('packCheckEdit')}
          >
            <Text style={styles.editBtnText}>{t('packCheckEdit')}</Text>
          </Pressable>
        </View>
      </View>
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
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
  },
  clarify: {
    marginBottom: spacing.md,
  },
  ask: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  chipTextOn: {
    color: colors.primary,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.warning,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  editBtn: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editBtnText: {
    color: colors.inkMuted,
    fontWeight: '600',
    fontSize: 15,
  },
});
