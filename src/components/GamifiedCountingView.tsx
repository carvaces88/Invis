import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalcIcon } from './CalcIcon';
import type { SimplifiedCountItem } from '../data/simplifiedCountingSeed';
import {
  alsoKnownAsLabel,
  itemMatchesQuery,
} from '../data/simplifiedCountingSeed';
import type { UnitCode } from '../data/types';
import { UNIT_CODES } from '../data/units';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme/colors';

const NEO_BG = '#E8ECF1';
const NEO_CARD = '#EEF1F5';
const GRADIENT_TEAL = '#B8E8D8';
const GRADIENT_PINK = '#F5C6D0';
const SWIPE_X = 64;
const FIRE_EMOJIS = ['🔥', '🔥', '✨', '🔥', '🧡', '🔥', '💛', '🔥'] as const;

const neoShadow = Platform.select({
  web: {
    boxShadow:
      '6px 6px 14px rgba(163, 177, 198, 0.45), -5px -5px 12px rgba(255,255,255,0.85)',
  } as object,
  default: {
    shadowColor: '#9AA8B8',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
});

const neoInset = Platform.select({
  web: {
    boxShadow:
      'inset 4px 4px 10px rgba(163, 177, 198, 0.45), inset -4px -4px 10px rgba(255,255,255,0.8)',
  } as object,
  default: {
    backgroundColor: '#E2E7ED',
  },
});

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

type FireSpark = {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  emoji: string;
  size: number;
};

function FireBurst({ burstKey }: { burstKey: number }) {
  const sparks = useMemo(() => {
    if (burstKey <= 0) return [] as FireSpark[];
    return Array.from({ length: 14 }, (_, i) => ({
      id: burstKey * 100 + i,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0.35),
      opacity: new Animated.Value(1),
      emoji: FIRE_EMOJIS[i % FIRE_EMOJIS.length],
      size: 18 + (i % 5) * 4,
    }));
  }, [burstKey]);

  useEffect(() => {
    if (sparks.length === 0) return;
    const anims = sparks.map((p, i) => {
      const drift = ((i % 7) - 3) * 18;
      const rise = -(70 + (i % 5) * 22);
      return Animated.parallel([
        Animated.timing(p.x, {
          toValue: drift,
          duration: 650 + (i % 4) * 80,
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: rise,
          duration: 700 + (i % 5) * 70,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.scale, {
            toValue: 1.15 + (i % 3) * 0.15,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 0.55,
            duration: 480,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 780,
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.stagger(28, anims).start();
  }, [sparks]);

  if (sparks.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.fireLayer}>
      {sparks.map((p) => (
        <Animated.Text
          key={p.id}
          style={[
            styles.fireSpark,
            {
              fontSize: p.size,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale: p.scale },
              ],
            },
          ]}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

type Props = {
  items: SimplifiedCountItem[];
  index: number;
  bottomInset: number;
  topInset: number;
  onIndexChange: (index: number) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onSetUnit: (id: string, unit: UnitCode) => void;
  onExit: () => void;
};

export function GamifiedCountingView({
  items,
  index,
  bottomInset,
  topInset,
  onIndexChange,
  onSetQuantity,
  onSetUnit,
  onExit,
}: Props) {
  const { t, locale } = useI18n();
  const item = items[index] ?? null;
  const [digits, setDigits] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [fireKey, setFireKey] = useState(0);
  const [flashOk, setFlashOk] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fxOpen, setFxOpen] = useState(false);
  const [fxExpr, setFxExpr] = useState('0');
  const namePan = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;

  const searchHits = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [] as { item: SimplifiedCountItem; index: number }[];
    return items
      .map((item, i) => ({ item, index: i }))
      .filter(({ item }) => itemMatchesQuery(item, q))
      .slice(0, 6);
  }, [items, searchQuery]);

  useEffect(() => {
    if (!item) return;
    setDigits(item.quantity > 0 ? formatQty(item.quantity) : '');
    setTyping(false);
    namePan.setValue(0);
  }, [item?.id, namePan]);

  const jumpTo = useCallback(
    (nextIndex: number) => {
      commitDigits();
      onIndexChange(nextIndex);
      setSearchQuery('');
    },
    // commitDigits defined below — wire after
    [onIndexChange],
  );

  const commitDigits = useCallback((): number | null => {
    if (!item) return null;
    const raw = digits.trim().replace(',', '.');
    const n = raw === '' || raw === '.' ? 0 : Number(raw);
    const qty =
      Number.isFinite(n) && n >= 0
        ? Math.round(n * 100) / 100
        : item.quantity;
    onSetQuantity(item.id, qty);
    setTyping(false);
    setDigits(formatQty(qty));
    return qty;
  }, [digits, item, onSetQuantity]);

  const playSuccess = useCallback(() => {
    setFireKey((k) => k + 1);
    setFlashOk(true);
    successScale.setValue(0.92);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1.08,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(successScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => setFlashOk(false), 850);
  }, [successScale]);

  const goNext = useCallback(
    (withCelebration: boolean) => {
      commitDigits();
      if (withCelebration) playSuccess();
      if (index < items.length - 1) onIndexChange(index + 1);
    },
    [commitDigits, index, items.length, onIndexChange, playSuccess],
  );

  const goPrev = useCallback(() => {
    commitDigits();
    if (index > 0) onIndexChange(index - 1);
  }, [commitDigits, index, onIndexChange]);

  const nameResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
        onPanResponderMove: (_, g) => {
          namePan.setValue(Math.max(-80, Math.min(80, g.dx * 0.4)));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_X) {
            Animated.timing(namePan, {
              toValue: 120,
              duration: 140,
              useNativeDriver: true,
            }).start(() => {
              goNext(true);
              namePan.setValue(0);
            });
            return;
          }
          if (g.dx < -SWIPE_X) {
            Animated.timing(namePan, {
              toValue: -120,
              duration: 140,
              useNativeDriver: true,
            }).start(() => {
              goPrev();
              namePan.setValue(0);
            });
            return;
          }
          Animated.spring(namePan, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(namePan, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [goNext, goPrev, namePan],
  );

  if (!item) {
    return (
      <View style={[styles.root, { paddingTop: topInset + 16 }]}>
        <Text style={styles.empty}>{t('simpCountGameEmpty')}</Text>
        <Pressable style={styles.backWide} onPress={onExit}>
          <Text style={styles.backWideText}>{t('simpCountGameBack')}</Text>
        </Pressable>
      </View>
    );
  }

  const name = locale === 'fi' ? item.nameFi : item.nameEn;
  const display = typing
    ? digits === ''
      ? '0'
      : digits
    : formatQty(item.quantity);

  const pushDigit = (key: string) => {
    setTyping(true);
    setDigits((prev) => {
      const base = typing ? prev : '';
      if (key === '.') {
        if (base.includes('.')) return base;
        return base === '' ? '0.' : `${base}.`;
      }
      if (base === '0' && key !== '.') return key;
      if (base.replace('.', '').length >= 8) return base;
      return `${base}${key}`;
    });
  };

  const nudge = (delta: number) => {
    const current = typing
      ? (() => {
          const raw = digits.trim().replace(',', '.');
          const n = raw === '' || raw === '.' ? 0 : Number(raw);
          return Number.isFinite(n) ? n : item.quantity;
        })()
      : item.quantity;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    onSetQuantity(item.id, next);
    setTyping(false);
    setDigits(formatQty(next));
  };

  const openFx = () => {
    const seed = typing
      ? digits === '' || digits === '.'
        ? '0'
        : digits
      : formatQty(item.quantity);
    setFxExpr(seed === '0' ? '0' : seed);
    setFxOpen(true);
  };

  const evalFx = (raw: string): number | null => {
    const cleaned = raw
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/,/g, '.');
    if (!/^[\d.\s+\-*/()]+$/.test(cleaned)) return null;
    try {
      // eslint-disable-next-line no-new-func -- tiny local calculator, input sanitized above
      const n = Function(`"use strict"; return (${cleaned})`)() as unknown;
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const pushFxKey = (key: string) => {
    setFxExpr((prev) => {
      if (key === 'C') return '0';
      if (key === '⌫') {
        const next = prev.slice(0, -1);
        return next === '' ? '0' : next;
      }
      if (key === '=') {
        const n = evalFx(prev);
        if (n == null) return prev;
        return formatQty(Math.round(n * 1000) / 1000);
      }
      if (prev === '0' && /[0-9]/.test(key)) return key;
      if (prev === '0' && key === '.') return '0.';
      if (/[+\-×÷]/.test(key) && /[+\-×÷]$/.test(prev)) {
        return `${prev.slice(0, -1)}${key}`;
      }
      return `${prev}${key}`;
    });
  };

  const applyFx = () => {
    const n = evalFx(fxExpr);
    if (n == null) return;
    const qty = Math.max(0, Math.round(n * 100) / 100);
    onSetQuantity(item.id, qty);
    setTyping(false);
    setDigits(formatQty(qty));
    setFxOpen(false);
  };

  return (
    <View style={[styles.root, { paddingTop: topInset + 10 }]}>
      <Animated.View
        style={[
          styles.heroCard,
          flashOk && styles.heroCardSuccess,
          { transform: [{ scale: successScale }] },
        ]}
      >
        <FireBurst burstKey={fireKey} />
        <View style={styles.heroTop}>
          <Animated.View
            style={[
              styles.nameSwipeZone,
              { transform: [{ translateX: namePan }] },
            ]}
            {...nameResponder.panHandlers}
          >
            <Text style={styles.heroName} numberOfLines={2}>
              {name}
            </Text>
            <Text style={styles.swipeHint}>{t('simpCountGameSwipeHint')}</Text>
          </Animated.View>
          <Pressable
            style={styles.unitPill}
            onPress={() => setUnitOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('simpCountColUnit')}
          >
            <Text style={styles.unitText}>{item.unit}</Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
        </View>
        <View style={styles.displayWell}>
          <Text style={styles.displayText}>{display}</Text>
        </View>
        <Text style={styles.progress}>
          {t('simpCountGameProgress')
            .replace('{n}', String(index + 1))
            .replace('{total}', String(items.length))}
        </Text>
        {flashOk ? (
          <Text style={styles.successLabel}>{t('simpCountGameSuccess')}</Text>
        ) : null}
      </Animated.View>

      <View style={styles.pad}>
        {(
          [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['−', '0', '+'],
          ] as const
        ).map((row) => (
          <View key={row.join('-')} style={styles.padRow}>
            {row.map((key) => (
              <Pressable
                key={key}
                style={styles.padKey}
                onPress={() => {
                  if (key === '−') nudge(-1);
                  else if (key === '+') nudge(1);
                  else pushDigit(key);
                }}
                accessibilityRole="button"
                accessibilityLabel={key}
              >
                <Text style={styles.padKeyText}>{key}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <Pressable
          style={styles.backWide}
          onPress={() => {
            commitDigits();
            onExit();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameBack')}
        >
          <Text style={styles.backWideText}>{t('simpCountGameBack')}</Text>
        </Pressable>

        <Pressable
          style={styles.dockBtn}
          onPress={openFx}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountCalculator')}
        >
          <CalcIcon size={22} color={colors.inkMuted} />
        </Pressable>

        <Pressable
          style={styles.dockBtn}
          onPress={goPrev}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGamePrev')}
        >
          <Text style={styles.dockNav}>‹</Text>
        </Pressable>

        <Pressable
          style={styles.dockBtn}
          onPress={() => goNext(false)}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameNext')}
        >
          <Text style={styles.dockNav}>›</Text>
        </Pressable>

        <Pressable
          style={styles.dockNext}
          onPress={() => goNext(true)}
          accessibilityRole="button"
          accessibilityLabel={t('simpCountGameNextCelebrate')}
        >
          <View style={styles.dockNextWash} />
          <Text style={styles.dockNextGlyph}>+</Text>
        </Pressable>
      </View>

      <Modal
        visible={fxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFxOpen(false)}
      >
        <Pressable style={styles.fxBackdrop} onPress={() => setFxOpen(false)}>
          <Pressable style={styles.fxCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('simpCountCalculator')}</Text>
            <View style={styles.fxDisplay}>
              <Text style={styles.fxDisplayText} numberOfLines={1}>
                {fxExpr}
              </Text>
            </View>
            <View style={styles.fxPad}>
              {(
                [
                  ['7', '8', '9', '÷'],
                  ['4', '5', '6', '×'],
                  ['1', '2', '3', '−'],
                  ['C', '0', '.', '+'],
                ] as const
              ).map((row) => (
                <View key={row.join('-')} style={styles.fxPadRow}>
                  {row.map((key) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.fxKey,
                        /[+\−×÷]/.test(key) && styles.fxKeyOp,
                        key === 'C' && styles.fxKeyClear,
                      ]}
                      onPress={() => pushFxKey(key === '−' ? '-' : key)}
                      accessibilityRole="button"
                      accessibilityLabel={key}
                    >
                      <Text style={styles.fxKeyText}>{key}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={styles.fxPadRow}>
                <Pressable
                  style={styles.fxKey}
                  onPress={() => pushFxKey('⌫')}
                  accessibilityRole="button"
                  accessibilityLabel={t('simpCountCalcBackspace')}
                >
                  <Text style={styles.fxKeyText}>⌫</Text>
                </Pressable>
                <Pressable
                  style={[styles.fxKey, styles.fxKeyEq]}
                  onPress={() => pushFxKey('=')}
                  accessibilityRole="button"
                  accessibilityLabel="="
                >
                  <Text style={styles.fxKeyText}>=</Text>
                </Pressable>
                <Pressable
                  style={[styles.fxKey, styles.fxKeyApply]}
                  onPress={applyFx}
                  accessibilityRole="button"
                  accessibilityLabel={t('simpCountCalcApply')}
                >
                  <Text style={styles.fxApplyText}>{t('simpCountCalcApply')}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={unitOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setUnitOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('simpCountColUnit')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {UNIT_CODES.map((code) => (
                <Pressable
                  key={code}
                  style={[
                    styles.sheetRow,
                    code === item.unit && styles.sheetRowOn,
                  ]}
                  onPress={() => {
                    onSetUnit(item.id, code);
                    setUnitOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      code === item.unit && styles.sheetRowTextOn,
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEO_BG,
    paddingHorizontal: spacing.md,
  },
  empty: {
    fontSize: 16,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: NEO_CARD,
    borderRadius: 28,
    padding: spacing.lg,
    ...neoShadow,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroCardSuccess: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,120,40,0.45)',
    backgroundColor: '#FFF6EE',
  },
  fireLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  fireSpark: {
    position: 'absolute',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  nameSwipeZone: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  swipeHint: {
    marginTop: 4,
    fontSize: 11,
    color: colors.inkFaint,
  },
  unitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  unitText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  chevron: {
    fontSize: 12,
    color: colors.inkFaint,
  },
  displayWell: {
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_BG,
    ...neoInset,
  },
  displayText: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 1,
  },
  progress: {
    marginTop: 10,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  successLabel: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#D9480F',
    textAlign: 'center',
  },
  pad: {
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 88,
  },
  padRow: {
    flexDirection: 'row',
    gap: 12,
  },
  padKey: {
    flex: 1,
    aspectRatio: 1.35,
    maxHeight: 78,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_CARD,
    ...neoShadow,
  },
  padKeyText: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    backgroundColor: NEO_BG,
    gap: 10,
  },
  backWide: {
    flex: 1.4,
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_CARD,
    ...neoShadow,
  },
  backWideText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  dockBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_CARD,
    ...neoShadow,
  },
  dockFx: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    color: colors.inkMuted,
  },
  fxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,51,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  fxCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: NEO_CARD,
    borderRadius: 24,
    padding: spacing.md,
    ...neoShadow,
  },
  fxDisplay: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: NEO_BG,
    ...neoInset,
  },
  fxDisplayText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  fxPad: {
    gap: 8,
  },
  fxPadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fxKey: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEO_BG,
    ...neoShadow,
  },
  fxKeyOp: {
    backgroundColor: 'rgba(184,232,216,0.55)',
  },
  fxKeyClear: {
    backgroundColor: 'rgba(245,198,208,0.55)',
  },
  fxKeyEq: {
    backgroundColor: 'rgba(168,197,240,0.55)',
  },
  fxKeyApply: {
    flex: 2,
    backgroundColor: GRADIENT_TEAL,
  },
  fxKeyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  fxApplyText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  dockNav: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.inkMuted,
    marginTop: -2,
  },
  dockNext: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GRADIENT_TEAL,
    overflow: 'hidden',
    ...neoShadow,
  },
  dockNextWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GRADIENT_PINK,
    opacity: 0.5,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(135deg, ${GRADIENT_TEAL} 0%, ${GRADIENT_PINK} 100%)`,
          opacity: 1,
          backgroundColor: 'transparent',
        } as object)
      : null),
  },
  dockNextGlyph: {
    fontSize: 32,
    fontWeight: '500',
    color: colors.ink,
    marginTop: -2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,31,51,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NEO_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  sheetRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  sheetRowOn: {
    backgroundColor: 'rgba(184,232,216,0.55)',
  },
  sheetRowText: {
    fontSize: 15,
    color: colors.ink,
    fontWeight: '500',
  },
  sheetRowTextOn: {
    fontWeight: '700',
  },
});
