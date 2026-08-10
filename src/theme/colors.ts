import { Platform, type ViewStyle } from 'react-native';

/** Finnish-inspired blues — cool, minimal, kitchen-safe contrast */
export const colors = {
  bg: '#F7F9FC',
  bgElevated: '#FFFFFF',
  ink: '#0B1F33',
  inkMuted: '#5A6B7D',
  inkFaint: '#8A9AAB',
  line: '#E4EBF2',
  primary: '#0B4F8A',
  primarySoft: '#E6F0F8',
  primaryMid: '#1A6BB0',
  accent: '#2E7D9A',
  success: '#1F7A4D',
  successSoft: '#E6F5EE',
  warning: '#B86E00',
  warningSoft: '#FFF4E5',
  danger: '#B42318',
  dangerSoft: '#FDECEC',
  overlay: 'rgba(11, 31, 51, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

const shadowInk = colors.ink;

/** Soft floating elevation — prefer over heavy borders on interactive surfaces */
function makeShadow(
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
  web: string,
): ViewStyle {
  return {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
    ...(Platform.OS === 'web' ? ({ boxShadow: web } as ViewStyle) : {}),
  };
}

export const shadows = {
  /** Subtle lift for list cards / secondary actions */
  soft: makeShadow(4, 0.06, 14, 2, '0 4px 18px rgba(11, 31, 51, 0.07)'),
  /** Primary interactive surfaces (search pills, hero CTAs) */
  float: makeShadow(8, 0.09, 22, 4, '0 8px 28px rgba(11, 31, 51, 0.1)'),
  /** Tab bar / sticky chrome */
  bar: makeShadow(-2, 0.05, 10, 6, '0 -2px 12px rgba(11, 31, 51, 0.06)'),
} as const;

/** Shared elevated surface recipes — spread into StyleSheet entries */
export const surfaces = {
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 0,
    ...shadows.soft,
  } satisfies ViewStyle,
  cardTight: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 0,
    ...shadows.soft,
  } satisfies ViewStyle,
  float: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 0,
    ...shadows.float,
  } satisfies ViewStyle,
  pill: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    borderWidth: 0,
    ...shadows.float,
  } satisfies ViewStyle,
} as const;
