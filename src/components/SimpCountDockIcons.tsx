import React from 'react';
import { Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

type IconProps = {
  size?: number;
  color?: string;
};

const strokeProps = {
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
};

/** Category picker — stacked section rows (not a sun/gear). */
export function CategoryIcon({ size = 22, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Rect
        x="3.5"
        y="4"
        width="17"
        height="4.2"
        rx="1.2"
        stroke={color}
        {...strokeProps}
      />
      <Rect
        x="3.5"
        y="10"
        width="17"
        height="4.2"
        rx="1.2"
        stroke={color}
        {...strokeProps}
      />
      <Rect
        x="3.5"
        y="16"
        width="17"
        height="4.2"
        rx="1.2"
        stroke={color}
        {...strokeProps}
      />
      <Path
        d="M6.2 6.1h3.2M6.2 12.1h3.2M6.2 18.1h3.2"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** @deprecated Use CategoryIcon — kept so old imports don’t break builds. */
export function GearIcon(props: IconProps) {
  return <CategoryIcon {...props} />;
}

/** Edit / hide mode — pencil. */
export function EditIcon({ size = 22, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Path
        d="M5 19l1.1-4.2L16.4 4.5a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8.2 17.9 5 19z"
        stroke={color}
        {...strokeProps}
      />
      <Path d="M13.8 6.2l4 4" stroke={color} {...strokeProps} />
    </Svg>
  );
}

/** List photo / camera scan. */
export function CameraIcon({ size = 22, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Path
        d="M4.5 8.5h2.1l1.2-2h8.4l1.2 2H19.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5z"
        stroke={color}
        {...strokeProps}
      />
      <Circle cx="12" cy="14" r="3.2" stroke={color} {...strokeProps} />
    </Svg>
  );
}

/** Game mode — flame outline (no emoji). */
export function FlameIcon({ size = 22, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Path
        d="M12 20.5c3.7 0 6-2.4 6-5.6 0-3.1-2-5.1-3.5-6.6-.4-.4-1.1-.1-1.1.5 0 1.1-.4 2-1 2.5C12 7.5 10.4 5.3 8.2 3.7c-.5-.4-1.2.1-1 .7.5 1.9.3 3.3-.4 4.4C5.5 10.7 4.5 12.4 4.5 14.6c0 3.3 2.7 5.9 7.5 5.9z"
        stroke={color}
        {...strokeProps}
      />
      <Path
        d="M12 20.5c-1.7 0-3-1.2-3-2.8 0-1.4.8-2.3 1.8-3.1.2 1.1.8 1.8 1.5 2.1.2-1.3.7-2.3 1.7-3.1.2-.2.5 0 .5.3 0 1-.2 1.8.1 2.6.5 1.3.1 4-2.6 4z"
        stroke={color}
        {...strokeProps}
      />
    </Svg>
  );
}

/** +5 nudge — typographic, same ink weight as SVG strokes. */
export function PlusFiveBadge({
  size = 22,
  color = colors.primary,
}: IconProps) {
  return (
    <Text
      style={{
        fontSize: Math.round(size * 0.48),
        fontWeight: '800',
        color,
        letterSpacing: -0.4,
      }}
    >
      +5
    </Text>
  );
}

/** Simple invis — compact count checklist (More entry glyph). */
export function SimpleInvisIcon({
  size = 22,
  color = colors.primary,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Rect
        x="4"
        y="3.5"
        width="16"
        height="17"
        rx="3"
        stroke={color}
        {...strokeProps}
      />
      <Path
        d="M8 8.2h8M8 12h8M8 15.8h5.2"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Path
        d="M15.2 14.6l1.5 1.5 2.8-3"
        stroke={color}
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Tiny spacer so unused Rect import stays available for future glyphs. */
export function DockIconFrame({
  size = 22,
  color = colors.primary,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        stroke={color}
        {...strokeProps}
      />
    </Svg>
  );
}
