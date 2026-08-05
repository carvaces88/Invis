import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { VisionCropRegion } from '../data/types';
import { colors, radius } from '../theme/colors';

type Props = {
  uri?: string | null;
  /** Normalized 0–1 crop within the source photo — zooms the thumb onto the product. */
  crop?: VisionCropRegion | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
};

/**
 * Shows a tight zoom of `crop` inside a square thumb (overflow hidden).
 * When crop is missing, falls back to cover of the full image.
 */
export function CroppedImage({
  uri,
  crop,
  size,
  style,
  fallbackColor,
}: Props) {
  const bg = fallbackColor ?? crop?.previewColor ?? colors.primarySoft;

  if (!uri) {
    return (
      <View
        style={[
          styles.box,
          { width: size, height: size, backgroundColor: bg },
          style,
        ]}
      />
    );
  }

  if (!crop || crop.width <= 0 || crop.height <= 0) {
    return (
      <View
        style={[
          styles.box,
          { width: size, height: size, backgroundColor: bg },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Map crop rect → fill the square (zoom into the detected product).
  const imgW = size / crop.width;
  const imgH = size / crop.height;

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, backgroundColor: bg },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={{
          position: 'absolute',
          width: imgW,
          height: imgH,
          left: -crop.x * imgW,
          top: -crop.y * imgH,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
