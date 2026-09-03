import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  size?: number;
  color?: string;
};

/** Compact calculator glyph for dock / game-mode buttons. */
export function CalcIcon({ size = 22, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Rect
        x="3.5"
        y="2.5"
        width="17"
        height="19"
        rx="3"
        stroke={color}
        strokeWidth="1.75"
        fill="none"
      />
      <Rect x="6" y="5" width="12" height="4" rx="1" fill={color} opacity={0.9} />
      <Path
        d="M7.5 13h2M11.5 13h2M15.5 13h2M7.5 16.5h2M11.5 16.5h2M15.5 16.5h2"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </Svg>
  );
}
