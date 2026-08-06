import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import type {
  InventoryLine,
  RootStackParamList,
  UnitCode,
} from '../data/types';
import { ALL_FRIENDLY_UNIT_OPTIONS } from '../data/units';
import { useI18n } from '../i18n';
import {
  isPackUnit,
  resolvePackBaseUnit,
  resolveUnitsPerPack,
} from '../lib/packUnits';
import { useUnitSystem } from '../lib/unitSystem';
import { colors, radius, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyAmounts'>;

const SWIPE_X = 120;
const SWIPE_Y_UP = -90;

function needsVerify(line: InventoryLine): boolean {
  if (line.quantity == null || line.quantity <= 0) return false;
  if (line.verificationStatus === 'correct') return false;
  if (
    line.verificationStatus === 'pending' ||
    line.verificationStatus === 'incorrect'
  ) {
    return true;
  }
  // Legacy lines without status: only if the user touched them
  return Boolean(line.lastUpdatedAt);
}

export function VerifyAmountsScreen({ route, navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { formatQty } = useUnitSystem();
  const {
    session,
    products,
    places,
    recentActivity,
    setLineVerification,
    updateLineCountDetails,
  } = useInventory();
  const mode = route.params?.mode ?? 'pending';

  const queue = useMemo(() => {
    const lines = session.lines.filter(needsVerify);
    if (mode !== 'recent') {
      return [...lines].sort((a, b) =>
        (b.lastUpdatedAt ?? '').localeCompare(a.lastUpdatedAt ?? ''),
      );
    }
    const recentIds = new Set(
      recentActivity.slice(0, 20).map((a) => `${a.productId}|${a.placeId}`),
    );
    return lines
      .filter((l) => recentIds.has(`${l.productId}|${l.placeId}`))
      .sort((a, b) =>
        (b.lastUpdatedAt ?? '').localeCompare(a.lastUpdatedAt ?? ''),
      );
  }, [session.lines, recentActivity, mode]);

  const [editOpen, setEditOpen] = useState(false);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState<UnitCode>('KPL');

  const line = queue[0] ?? null;
  const product = line
    ? products.find((p) => p.id === line.productId)
    : undefined;
  const placeName =
    places.find((p) => p.id === line?.placeId)?.name ?? line?.placeId ?? '';

  const pan = useRef(new Animated.ValueXY()).current;
  const resetPan = () => pan.setValue({ x: 0, y: 0 });

  const markCorrect = () => {
    if (!line) return;
    setLineVerification(line.id, 'correct');
    resetPan();
  };

  const markIncorrect = () => {
    if (!line) return;
    setLineVerification(line.id, 'incorrect');
    resetPan();
    openEdit();
  };

  const openEdit = () => {
    if (!line) return;
    setEditQty(String(line.quantity ?? ''));
    setEditUnit(line.unit);
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!line) return;
    const n = Number(String(editQty).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return;
    updateLineCountDetails(line.id, { quantity: n, unit: editUnit });
    setEditOpen(false);
    resetPan();
    // Stay on card — still pending until user marks correct
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, g) => {
          if (g.dy < SWIPE_Y_UP && Math.abs(g.dy) > Math.abs(g.dx)) {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
            openEdit();
            return;
          }
          if (g.dx > SWIPE_X) {
            Animated.timing(pan, {
              toValue: { x: 420, y: g.dy },
              duration: 180,
              useNativeDriver: false,
            }).start(() => markCorrect());
            return;
          }
          if (g.dx < -SWIPE_X) {
            Animated.timing(pan, {
              toValue: { x: -420, y: g.dy },
              duration: 180,
              useNativeDriver: false,
            }).start(() => {
              resetPan();
              markIncorrect();
            });
            return;
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pan handlers close over latest line
    [line?.id, pan],
  );

  const rotate = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });
  const correctOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_X],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const incorrectOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_X, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const editOpacity = pan.y.interpolate({
    inputRange: [SWIPE_Y_UP, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const packRisk =
    line && isPackUnit(line.unit)
      ? (() => {
          const per = product ? resolveUnitsPerPack(product) : undefined;
          const base = product ? resolvePackBaseUnit(product) : 'KPL';
          const qty = line.quantity ?? 0;
          if (per && per > 1) {
            return t('verifyPackRiskKnown')
              .replace('{qty}', formatQty(qty))
              .replace('{unit}', line.unit)
              .replace('{inner}', formatQty(qty * per))
              .replace('{base}', base);
          }
          return t('verifyPackRiskUnknown')
            .replace('{qty}', formatQty(qty))
            .replace('{unit}', line.unit);
        })()
      : null;

  const lineTotal =
    line && line.quantity != null
      ? line.quantity * (line.unitPriceAlv0 || 0)
      : 0;

  const done = !line;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + spacing.md }]}>
      <Text style={styles.kicker}>{t('appBrand')}</Text>
      <Text style={styles.title}>{t('verifyAmountsTitle')}</Text>
      <Text style={styles.sub}>{t('verifyAmountsSub')}</Text>

      {done ? (
        <View style={styles.doneBox}>
          <Text style={styles.doneTitle}>{t('verifyAmountsDone')}</Text>
          <Text style={styles.doneBody}>{t('verifyAmountsDoneBody')}</Text>
          <Pressable
            onPress={() => navigation.navigate('ExportPreview')}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>{t('verifyAmountsExport')}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              navigation.navigate('MainTabs', { screen: 'Inventaario' })
            }
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>{t('currentInventory')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.progress}>
            {t('verifyAmountsProgress').replace(
              '{total}',
              String(queue.length),
            )}
          </Text>

          <View style={styles.stage}>
            <Animated.View
              style={[
                styles.card,
                {
                  transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Animated.Text
                style={[styles.stampCorrect, { opacity: correctOpacity }]}
              >
                {t('verifySwipeCorrect')}
              </Animated.Text>
              <Animated.Text
                style={[styles.stampIncorrect, { opacity: incorrectOpacity }]}
              >
                {t('verifySwipeIncorrect')}
              </Animated.Text>
              <Animated.Text
                style={[styles.stampEdit, { opacity: editOpacity }]}
              >
                {t('verifySwipeEdit')}
              </Animated.Text>

              <Text style={styles.place}>{placeName}</Text>
              <Text style={styles.name}>{line.officialName}</Text>
              <Text style={styles.amount}>
                {formatQty(line.quantity ?? 0)}{' '}
                <Text style={styles.unit}>{line.unit}</Text>
              </Text>
              {line.unitPriceAlv0 > 0 ? (
                <Text style={styles.value}>
                  ≈ {lineTotal.toFixed(2).replace('.', ',')} €
                </Text>
              ) : null}
              {packRisk ? (
                <View style={styles.risk}>
                  <Text style={styles.riskText}>{packRisk}</Text>
                </View>
              ) : null}
              {line.verificationStatus === 'incorrect' ? (
                <Text style={styles.flagged}>{t('verifyFlagged')}</Text>
              ) : null}
            </Animated.View>
          </View>

          <Text style={styles.hint}>{t('verifySwipeHint')}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={markIncorrect}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionNo,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionNoText}>{t('verifyBtnIncorrect')}</Text>
            </Pressable>
            <Pressable
              onPress={openEdit}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionEdit,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionEditText}>{t('verifyBtnEdit')}</Text>
            </Pressable>
            <Pressable
              onPress={markCorrect}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionYes,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionYesText}>{t('verifyBtnCorrect')}</Text>
            </Pressable>
          </View>
        </>
      )}

      <Modal visible={editOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('verifyEditTitle')}</Text>
            <Text style={styles.modalSub}>{line?.officialName}</Text>
            <Text style={styles.fieldLabel}>{t('qty')}</Text>
            <TextInput
              value={editQty}
              onChangeText={setEditQty}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.inkFaint}
            />
            <Text style={styles.fieldLabel}>{t('unit')}</Text>
            <View style={styles.unitRow}>
              {ALL_FRIENDLY_UNIT_OPTIONS.filter(
                (o, i, arr) =>
                  arr.findIndex((x) => x.code === o.code) === i,
              ).map((o) => {
                const on = editUnit === o.code;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setEditUnit(o.code)}
                    style={[styles.unitChip, on && styles.unitChipOn]}
                  >
                    <Text style={[styles.unitChipText, on && styles.unitChipTextOn]}>
                      {t(o.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditOpen(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={saveEdit} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.xs,
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
  },
  sub: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  progress: {
    marginTop: spacing.md,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkFaint,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    minHeight: 260,
    justifyContent: 'center',
  },
  stampCorrect: {
    position: 'absolute',
    top: 20,
    left: 16,
    fontSize: 22,
    fontWeight: '900',
    color: colors.success,
    borderWidth: 3,
    borderColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: '-12deg' }],
  },
  stampIncorrect: {
    position: 'absolute',
    top: 20,
    right: 16,
    fontSize: 22,
    fontWeight: '900',
    color: colors.danger,
    borderWidth: 3,
    borderColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: '12deg' }],
  },
  stampEdit: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.warning,
  },
  place: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.md,
  },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  unit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryMid,
  },
  value: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.inkMuted,
  },
  risk: {
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  riskText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.warning,
    fontWeight: '600',
  },
  flagged: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  hint: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionNo: {
    backgroundColor: colors.dangerSoft,
  },
  actionNoText: {
    fontWeight: '700',
    color: colors.danger,
    fontSize: 13,
  },
  actionEdit: {
    backgroundColor: colors.warningSoft,
  },
  actionEditText: {
    fontWeight: '700',
    color: colors.warning,
    fontSize: 13,
  },
  actionYes: {
    backgroundColor: colors.successSoft,
  },
  actionYesText: {
    fontWeight: '700',
    color: colors.success,
    fontSize: 13,
  },
  doneBox: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  doneBody: {
    fontSize: 15,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  modalSub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkFaint,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  unitChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  unitChipTextOn: {
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalCancelText: {
    fontWeight: '700',
    color: colors.inkMuted,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    fontWeight: '700',
    color: '#fff',
  },
});
